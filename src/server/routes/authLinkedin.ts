import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { linkedinTokens } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';
import { linkedinConfig, linkedinConfigured } from '../env';

const router = Router();

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const SCOPES = 'openid profile email w_member_social';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes is plenty for a user to log into LinkedIn.

// In-memory CSRF state store. This is a local single-user app and the server
// process owns the whole OAuth handshake lifetime, so a module-level Map is
// sufficient — no need for persistence across restarts.
const pendingStates = new Map<string, number>();

function issueState(): string {
  const state = crypto.randomUUID();
  pendingStates.set(state, Date.now() + STATE_TTL_MS);
  return state;
}

function consumeState(state: string | undefined): boolean {
  if (!state) return false;
  const expiresAt = pendingStates.get(state);
  pendingStates.delete(state);
  if (!expiresAt) return false;
  return Date.now() <= expiresAt;
}

function errorPage(message: string): string {
  return `<!doctype html>
<html>
  <head><title>LinkedIn connection failed</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 2rem; color: #1a1a1a;">
    <h1>LinkedIn connection failed</h1>
    <p>${message}</p>
    <p><a href="http://localhost:3001/">Return to the console</a></p>
  </body>
</html>`;
}

// GET /api/auth/linkedin — entry point the Connect button hits. Redirects to
// LinkedIn's authorization screen, or 503s if credentials aren't configured
// (LinkedIn is optional; the console must otherwise work with no .env).
router.get('/linkedin', (_req, res) => {
  if (!linkedinConfigured() || !linkedinConfig) {
    return res.status(503).json({ error: 'LinkedIn not configured. Add credentials to .env.' });
  }
  const state = issueState();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: linkedinConfig.clientId,
    redirect_uri: linkedinConfig.redirectUri,
    state,
    scope: SCOPES,
  });
  res.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
});

// GET /api/auth/linkedin/callback — LinkedIn redirects the browser here after
// the user approves (or denies) access. The browser lands on this page
// directly, so errors render friendly HTML rather than JSON.
router.get('/linkedin/callback', async (req, res) => {
  if (!linkedinConfigured() || !linkedinConfig) {
    return res.status(503).send(errorPage('LinkedIn is not configured on this server.'));
  }

  const { code, state, error, error_description: errorDescription } = req.query as Record<
    string,
    string | undefined
  >;

  if (error) {
    return res.status(400).send(errorPage(errorDescription ?? error));
  }

  if (!consumeState(state)) {
    return res.status(400).send(errorPage('This authorization request expired or was already used. Please try connecting again.'));
  }

  if (!code) {
    return res.status(400).send(errorPage('LinkedIn did not return an authorization code.'));
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: linkedinConfig.clientId,
      client_secret: linkedinConfig.clientSecret,
      redirect_uri: linkedinConfig.redirectUri,
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenJson.access_token) {
      return res
        .status(400)
        .send(errorPage(tokenJson.error_description ?? tokenJson.error ?? 'Token exchange failed.'));
    }

    const accessToken = tokenJson.access_token;

    const userinfoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userinfo = (await userinfoRes.json()) as {
      sub?: string;
      name?: string;
      picture?: string;
    };

    if (!userinfoRes.ok || !userinfo.sub) {
      return res.status(400).send(errorPage('Failed to fetch LinkedIn identity.'));
    }

    const pid = getActiveProfileId();
    db.delete(linkedinTokens).where(eq(linkedinTokens.profileId, pid)).run();
    db.insert(linkedinTokens)
      .values({
        profileId: pid,
        memberSub: userinfo.sub,
        name: userinfo.name ?? null,
        avatarUrl: userinfo.picture ?? null,
        headline: null,
        accessToken,
        expiresAt: tokenJson.expires_in ? Date.now() + tokenJson.expires_in * 1000 : null,
        scopes: ['openid', 'profile', 'email', 'w_member_social'],
      })
      .run();

    res.send(`<!doctype html>
<html>
  <head><title>LinkedIn connected</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 2rem; color: #1a1a1a;">
    <h1>LinkedIn connected</h1>
    <p>You can close this tab and return to the console.</p>
    <p><a href="http://localhost:3001/">Return to the console</a></p>
    <script>window.close();</script>
  </body>
</html>`);
  } catch (err) {
    res.status(500).send(errorPage('Unexpected error connecting to LinkedIn.'));
  }
});

// POST /api/auth/linkedin/disconnect — drop the single stored token row.
router.post('/linkedin/disconnect', (_req, res) => {
  db.delete(linkedinTokens).where(eq(linkedinTokens.profileId, getActiveProfileId())).run();
  res.status(204).end();
});

export default router;
