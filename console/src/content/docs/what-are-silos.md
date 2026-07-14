---
title: What intents (silos) are
category: Reference
order: 3
---

Every post has two independent axes. A **pillar** is what a post is *about* (your topics —
brewing, sourcing, and so on). A **silo** — the post's **intent** — is *why it exists* and
what response it's built to earn. They're orthogonal: a "teach" post and a "conversation"
post can both be about the same pillar.

The intent is what decides a post's **shape**: how it opens, how long it runs, and whether
it can carry an ask. It is a **fixed roster per platform** — LinkedIn has four
(conversation / teach / win / curate) and Reddit has five (discuss / help / share / ask /
curate). You pick one per post, but you don't add or remove them (see "Why the set is
fixed" below).

Long-form has its own roster on the same axis: the `web` platform's **piece kinds**
(how-to, explainer, comparison, thought piece, whitepaper) are the silos of the long-form web
lane. They're covered in **Long-form articles** in this Docs section.

## The LinkedIn intents

| Intent | What it's for | Shape rules |
|---|---|---|
| **Conversation** | Opens a loop — a thought or question built to pull replies | May open with a question; runs shorter; **no ask** |
| **Teach** | Delivers one useful, specific takeaway | Leads with the useful thing; longer body; the **only** intent that can carry a product ask |
| **Win** | A short, warm celebration where **someone else** is the hero | Brief story; the owner is never the aggressive hero; **no ask** |
| **Curate** | Boosts someone else's work, credited | Generous pointer; must credit the source; **no ask** |

## The Reddit intents

Reddit rewards different moves than LinkedIn, so it ships its own intents. There is no
**win** (celebration reads as self-promotion in most subreddits); its warmth folds into
**share**. **Ask** is Reddit-only.

| Intent | What it's for | Shape rules |
|---|---|---|
| **Discuss** | Opens a genuine discussion thread | May open with a question; conversational; **no ask** |
| **Help** | Answers a real problem with something concrete | Leads with the useful thing; the intent that can carry a restrained product mention where relevant |
| **Share** | Recounts your own experience or result, plainly | First-person story; no hero posturing; **no ask** |
| **Ask** | Asks the subreddit a real question you want answered | Short; ends on the question; **no ask/CTA** |
| **Curate** | Points to someone else's work, credited | Generous pointer; must credit the source; **no ask** |

## How the intent gets set

- When you **promote** an item from **Discovery** into the queue, you choose its intent with
  the intent picker (feed items default to **Teach**).
- The **spark** skill infers an intent from a raw spark and confirms it with you.
- You can see and filter by intent in the **Queue**, and browse each platform's intents with
  live counts in the **Intent** screen.

Downstream, the drafter (`queue`) shapes the post by its intent, and the reviewer
(`content-reviewer`) grades it by the matching rules — so the intent you pick genuinely
changes the post you get.

## Why the set is fixed

Intents aren't freeform labels like tags. Each one triggers **different drafting and review
behavior that lives in code** — the four shapes above are hardwired into how posts are
written and checked. A fifth, made-up intent would have no shape and no rules for the engine
to follow. That's why the roster is committed product structure (the same for everyone),
while your *pillars* and *tags* — which are just labels the engine treats uniformly — are
yours to edit freely.

If you ever want to *change* what an intent means, that's a code change, not a settings
toggle.
