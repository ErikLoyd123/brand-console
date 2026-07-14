import { Router, type Response as ExpressResponse } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { drafts, ideaQueueItems, linkedinTokens, publishedPosts } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';
import { getImage, imageAbsPath } from '../../images/store';
import { linkedinConfigured } from '../env';

const router = Router();

const UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';
const ASSETS_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload';
const SOCIAL_ACTIONS_URL = 'https://api.linkedin.com/v2/socialActions';

const NOT_A_LINKEDIN_POST_ERROR =
  'This post was not published through LinkedIn, so it cannot be deleted here.';

type LinkedinTokenRow = typeof linkedinTokens.$inferSelect;

// Shared guard for every route below: LinkedIn must be configured, a token
// row must exist, and it must not have expired. On failure this writes the
// error response itself and returns null — callers must return immediately
// when they get null back. Takes the active profile id so callers that also
// need it elsewhere (the draft lookup below) resolve it once per request.
function loadValidToken(res: ExpressResponse, pid: string): LinkedinTokenRow | null {
  if (!linkedinConfigured()) {
    res.status(503).json({ error: 'LinkedIn not configured. Add credentials to .env.' });
    return null;
  }

  const token = db
    .select()
    .from(linkedinTokens)
    .where(eq(linkedinTokens.profileId, pid))
    .get();
  if (!token) {
    res.status(409).json({ error: 'LinkedIn is not connected.' });
    return null;
  }
  if (token.expiresAt != null && token.expiresAt < Date.now()) {
    res.status(401).json({ error: 'LinkedIn session expired. Reconnect on the Connections page.' });
    return null;
  }
  return token;
}

// POST /api/publish/linkedin — publish a draft to LinkedIn via the UGC Posts
// API using the connected account's stored token, then record the result as a
// published_posts row (same shape the manual publish route in drafts.ts uses).
//
// Optional body fields add media support on top of the plain-text post:
// `linkUrl` shares an article link, `image` uploads a binary image through
// LinkedIn's 3-step asset flow — either inline bytes (`dataBase64`) or, for an
// image already attached to the idea's card, its `imageId` (the server reads
// the file from data/images/ itself, alt text defaulting to the stored row's).
// Precedence when more than one is present: image > linkUrl > text.
router.post('/linkedin', async (req, res) => {
  const pid = getActiveProfileId();
  const token = loadValidToken(res, pid);
  if (!token) return;

  const { draftId, visibility, linkUrl, image } = req.body as {
    draftId?: string;
    visibility?: 'PUBLIC' | 'CONNECTIONS';
    linkUrl?: string;
    image?: { dataBase64?: string; mimeType?: string; alt?: string; imageId?: string };
  };

  const draft = db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, draftId ?? ''), eq(drafts.profileId, pid)))
    .get();
  if (!draft) {
    return res.status(404).json({ error: 'draft not found' });
  }

  const text = [draft.hookOptions[0] ?? '', '', draft.body, '', draft.close]
    .join('\n')
    .trim();

  let specificContent: Record<string, unknown>;

  let imageBinary: Buffer | null = null;
  let imageAlt: string | undefined;
  if (image) {
    if (image.imageId) {
      const row = getImage(image.imageId);
      if (!row) return res.status(404).json({ error: 'attached image not found' });
      const abs = imageAbsPath(row.path);
      if (!existsSync(abs)) {
        return res.status(410).json({ error: 'attached image file is missing on disk' });
      }
      imageBinary = readFileSync(abs);
      imageAlt = image.alt ?? row.alt;
    } else if (typeof image.dataBase64 === 'string' && image.dataBase64.length > 0) {
      imageBinary = Buffer.from(image.dataBase64, 'base64');
      imageAlt = image.alt;
    } else {
      return res.status(400).json({ error: 'image needs an imageId or dataBase64' });
    }

    // Step 1: register the upload to get a one-time upload URL + asset URN.
    let registerRes: Response;
    try {
      registerRes = await fetch(ASSETS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: `urn:li:person:${token.memberSub}`,
            serviceRelationships: [
              { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
            ],
          },
        }),
      });
    } catch (err) {
      return res.status(502).json({ error: 'LinkedIn rejected the image upload: request failed' });
    }

    if (!registerRes.ok) {
      const bodyText = await registerRes.text();
      return res
        .status(502)
        .json({ error: `LinkedIn rejected the image upload: ${bodyText.slice(0, 300)}` });
    }

    const registerJson = (await registerRes.json()) as {
      value?: {
        uploadMechanism?: Record<string, { uploadUrl?: string } | undefined>;
        asset?: string;
      };
    };
    const uploadUrl =
      registerJson.value?.uploadMechanism?.[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ]?.uploadUrl;
    const asset = registerJson.value?.asset;
    if (!uploadUrl || !asset) {
      return res
        .status(502)
        .json({ error: 'LinkedIn did not return an upload URL for the image.' });
    }

    // Step 2: PUT the binary to the upload URL.
    let uploadRes: Response;
    try {
      uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token.accessToken}` },
        body: new Uint8Array(imageBinary!),
      });
    } catch (err) {
      return res.status(502).json({ error: 'LinkedIn rejected the image upload: request failed' });
    }
    if (!uploadRes.ok) {
      return res
        .status(502)
        .json({ error: `LinkedIn rejected the image upload: HTTP ${uploadRes.status}` });
    }

    // Step 3: reference the uploaded asset in the ugcPosts call below.
    specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            media: asset,
            ...(imageAlt ? { description: { text: imageAlt } } : {}),
          },
        ],
      },
    };
  } else if (linkUrl) {
    specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'ARTICLE',
        media: [{ status: 'READY', originalUrl: linkUrl }],
      },
    };
  } else {
    specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    };
  }

  let linkedinRes: Response;
  try {
    linkedinRes = await fetch(UGC_POSTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: `urn:li:person:${token.memberSub}`,
        lifecycleState: 'PUBLISHED',
        specificContent,
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': visibility ?? 'PUBLIC',
        },
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'LinkedIn rejected the post: request failed' });
  }

  if (!linkedinRes.ok) {
    const bodyText = await linkedinRes.text();
    return res
      .status(502)
      .json({ error: `LinkedIn rejected the post: ${bodyText.slice(0, 300)}` });
  }

  const urn = linkedinRes.headers.get('x-restli-id') ?? linkedinRes.headers.get('x-linkedin-id');
  const permalink = urn ? `https://www.linkedin.com/feed/update/${urn}` : null;

  const inserted = db
    .insert(publishedPosts)
    .values({
      draftId: draft.id,
      permalink,
      linkedinUrn: urn ?? null,
      publishedAt: Date.now(),
    })
    .returning()
    .all();

  // The queue is the review phase: a shipped idea leaves it.
  db.update(ideaQueueItems)
    .set({ status: 'published' })
    .where(eq(ideaQueueItems.id, draft.ideaId))
    .run();

  res.status(201).json(inserted[0]);
});

// DELETE /api/publish/linkedin/:postId — delete a post from LinkedIn (postId
// is our published_posts.id) and, only once LinkedIn confirms, drop the local
// row too. Posts that were only tracked manually (no linkedinUrn) can't be
// deleted this way since there's nothing on LinkedIn to remove.
router.delete('/linkedin/:postId', async (req, res) => {
  const token = loadValidToken(res, getActiveProfileId());
  if (!token) return;

  const post = db
    .select()
    .from(publishedPosts)
    .where(eq(publishedPosts.id, req.params.postId))
    .get();
  if (!post) {
    return res.status(404).json({ error: 'published post not found' });
  }
  const linkedinUrn = post.linkedinUrn;
  if (!linkedinUrn) {
    return res.status(400).json({ error: NOT_A_LINKEDIN_POST_ERROR });
  }

  let linkedinRes: Response;
  try {
    linkedinRes = await fetch(`${UGC_POSTS_URL}/${encodeURIComponent(linkedinUrn)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
  } catch (err) {
    return res.status(502).json({ error: 'LinkedIn refused the delete: request failed' });
  }

  if (!linkedinRes.ok) {
    const bodyText = await linkedinRes.text();
    return res
      .status(502)
      .json({ error: `LinkedIn refused the delete: ${bodyText.slice(0, 300)}` });
  }

  db.delete(publishedPosts).where(eq(publishedPosts.id, post.id)).run();
  res.status(204).end();
});

// POST /api/publish/linkedin/:postId/comment — comment on the post as the
// connected member, using the same w_member_social scope as publishing.
router.post('/linkedin/:postId/comment', async (req, res) => {
  const token = loadValidToken(res, getActiveProfileId());
  if (!token) return;

  const post = db
    .select()
    .from(publishedPosts)
    .where(eq(publishedPosts.id, req.params.postId))
    .get();
  if (!post) {
    return res.status(404).json({ error: 'published post not found' });
  }
  const linkedinUrn = post.linkedinUrn;
  if (!linkedinUrn) {
    return res.status(400).json({ error: NOT_A_LINKEDIN_POST_ERROR });
  }

  const { text } = req.body as { text?: string };
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }

  let linkedinRes: Response;
  try {
    linkedinRes = await fetch(
      `${SOCIAL_ACTIONS_URL}/${encodeURIComponent(linkedinUrn)}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actor: `urn:li:person:${token.memberSub}`,
          message: { text },
        }),
      },
    );
  } catch (err) {
    return res.status(502).json({ error: 'LinkedIn rejected the comment: request failed' });
  }

  if (!linkedinRes.ok) {
    const bodyText = await linkedinRes.text();
    return res
      .status(502)
      .json({ error: `LinkedIn rejected the comment: ${bodyText.slice(0, 300)}` });
  }

  const bodyText = await linkedinRes.text();
  let json: unknown = { ok: true };
  if (bodyText) {
    try {
      json = JSON.parse(bodyText);
    } catch {
      json = { ok: true };
    }
  }
  res.status(201).json(json);
});

// POST /api/publish/linkedin/:postId/like — like the post as the connected
// member. LinkedIn's "already liked" error is treated as success since the
// end state the caller wants (a like on the post) already holds.
router.post('/linkedin/:postId/like', async (req, res) => {
  const token = loadValidToken(res, getActiveProfileId());
  if (!token) return;

  const post = db
    .select()
    .from(publishedPosts)
    .where(eq(publishedPosts.id, req.params.postId))
    .get();
  if (!post) {
    return res.status(404).json({ error: 'published post not found' });
  }
  const linkedinUrn = post.linkedinUrn;
  if (!linkedinUrn) {
    return res.status(400).json({ error: NOT_A_LINKEDIN_POST_ERROR });
  }

  let linkedinRes: Response;
  try {
    linkedinRes = await fetch(`${SOCIAL_ACTIONS_URL}/${encodeURIComponent(linkedinUrn)}/likes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actor: `urn:li:person:${token.memberSub}` }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'LinkedIn rejected the like: request failed' });
  }

  if (linkedinRes.ok) {
    return res.status(201).json({ ok: true });
  }

  const bodyText = await linkedinRes.text();
  const alreadyLiked =
    linkedinRes.status === 409 || /already/i.test(bodyText) || /duplicate/i.test(bodyText);
  if (alreadyLiked) {
    return res.status(200).json({ ok: true, already: true });
  }

  return res.status(502).json({ error: `LinkedIn rejected the like: ${bodyText.slice(0, 300)}` });
});

export default router;
