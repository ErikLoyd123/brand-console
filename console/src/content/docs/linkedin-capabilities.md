---
title: What the LinkedIn connection can do
category: Reference
order: 2
---

Once LinkedIn is connected, the console can do a specific, small set of things. This page is the honest ceiling: what the API permits with the scopes we requested, what the console actually builds on top of that, and what is simply not available to a personal app.

The connection uses four scopes: `openid`, `profile`, `email` (read your own identity) and `w_member_social` (act on your behalf). Everything below follows from those.

## What the connection can do

These are allowed by our scopes:

- **Read your identity.** Your name, first and last name, profile picture, email, locale, and your LinkedIn member id. This is what fills the author identity on the draft preview and the "Connected" card.
- **Post on your behalf.** Create a post on your personal feed. LinkedIn's API supports text, a link/article, an image, or a video.
- **Comment and like on your behalf.** The same `w_member_social` permission technically covers commenting and liking as you.

That is the whole surface. Notably it does **not** include your headline, which LinkedIn does not return through this sign-in method.

## What the console builds on it today

Of the above, the console currently implements:

- **Connect / disconnect**, showing your real name and avatar.
- **Publish**, behind the type-`PUBLISH` gate, from the Drafts editor: a text post, a link/article, or an image (with alt text).
- **Delete, comment on, or like** a post you published through the console, from the Published page. These only appear on posts the console published (it has the post's id); manually tracked posts have no such actions.

Not built: video posts. That is the only part of the scope still left on the table.

## What it cannot do

None of the following is available with a self-serve personal app. They require LinkedIn's review-gated products (the Marketing and Community Management APIs), which are built for approved partner platforms:

- **Read your feed, your connections, or follower counts.**
- **Read or send messages / InMail.**
- **Post as, or manage, a Company Page.** (Your app is *associated* with a company page for ownership, but it only ever posts to your personal profile.)
- **Read anything about other members.**

## The short version

The connection is deliberately narrow: it confirms who you are and lets you post as you. Anything that reads LinkedIn back to you, or touches a company page or other members, is out of reach for a local personal tool by design.
