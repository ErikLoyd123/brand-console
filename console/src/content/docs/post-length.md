---
title: How long a post runs
category: Reference
order: 4
---

A post has a fourth axis next to its pillar (topic), its intent (silo), and its register
(platform and tone): its **length band**. The band is chosen per post, not per intent, and
it is chosen from the material rather than from a rule. One gap or one claim is a short
post. A mechanism is a medium post. A mechanism plus the mistake people make plus the fix
is a long post.

| Band | Body characters | What fits |
|---|---|---|
| **Short** | 300 to 600 | One claim, one specific, one line to land it. No sections. |
| **Medium** | 700 to 1100 | The claim, the mechanism in two or three paragraphs, the one thing to do. |
| **Long** | 1300 to 1900 | The full mechanism plus the mistake plus the fix. Only when the idea needs all three. |

The counts are the body only; the hook and the close sit outside them. LinkedIn cuts the
preview after about three lines, so the first two lines carry the claim at every length.

## Where the band comes from

- **The intent sets a default.** Teach (and Reddit's help) lean medium; conversation, win,
  curate, promote, and the Reddit intents lean short. An item with no band drafts at its
  intent's default, and the card shows that default in parentheses.
- **The `spark` skill recommends one and asks**, after the interview, from how much
  material came out of it. The `queue` skill does the same when it writes an item that has
  no band yet.
- **You can set it on the card.** The picker sits with the intent, pillar, and tag badges.
  It writes to the item (the `length` column), the same field the skills set.

## What reads it

- The drafting procedure shapes the body to the band. The old rule that every teach post
  ran 1300 to 1900 characters is now just the definition of the long band.
- The console's live checks show a `length-band` warning when the body falls outside its
  band. It is a warning, not a failure: a few characters either side is not a defect.
- The reviewer judges length against the band, and fails a draft on judgment only when the
  body is padded past its band or is missing the mechanism its band promises.

Bands are LinkedIn-shaped. Reddit posts use them loosely, and web articles carry their own
length target on the article instead. The roster lives in code (`src/core/lengths.ts`) and
is the same for every profile.
