---
title: Connect LinkedIn
category: Setup
order: 2
---

Connecting LinkedIn lets you publish drafts straight from the console instead of copying them out by hand. It's optional. The manual copy path always works, connected or not.

Setup takes about five minutes. You create a LinkedIn developer app, add two self-serve products, and paste three values into a `.env` file. No LinkedIn review, no waiting.

## Quick links

- [Create a new app](https://www.linkedin.com/developers/apps/new)
- [My apps](https://www.linkedin.com/developers/apps) (to get back to an app you already made)
- [LinkedIn Developer Portal home](https://www.linkedin.com/developers/)

## Step 1 — Create the app

Open [Create a new app](https://www.linkedin.com/developers/apps/new) and fill in:

- **App name** — anything, e.g. `Brand Console`.
- **LinkedIn Page** — your company page (see the note below on why this is required). Enter the page name or its URL.
- **Privacy policy URL** — optional, leave it blank.
- **App logo** — required. Upload any square image; it only shows on the consent screen.
- Check **I have read and agree to these terms**, then **Create app**.

### Why it asks for a Company Page

LinkedIn ties every developer app to a Company Page as its administrative owner, and it will not accept a personal profile here. **This does not change where your posts go.** You are posting to your own personal feed. The app just needs a page to "belong" to for verification. If you already have a company page, use it. Doing so does not post anything as that company. When the console publishes, it authenticates as *you* and sets the post's author to your personal profile, never the page.

## Step 2 — Add the two products

On the app's **Products** tab, request access to both. Both are self-serve and grant instantly:

- **Sign In with LinkedIn using OpenID Connect** — confirms who you are (name, photo).
- **Share on LinkedIn** — lets the console post on your behalf.

## Step 3 — Set the redirect URL

On the app's **Auth** tab, under **OAuth 2.0 settings → Authorized redirect URLs for your app**, add exactly:

```
http://localhost:5174/api/auth/linkedin/callback
```

It has to match character-for-character or the sign-in will fail.

## Step 4 — Copy the credentials into `.env`

Still on the **Auth** tab, copy the **Client ID** and the **Primary Client Secret**. In the repository root, copy `.env.example` to a new file named `.env` and fill in all three — the console needs the redirect URI as an env var too, not just the client id and secret. If any of the three is missing, the LinkedIn connection silently stays off.

```
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-primary-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:5174/api/auth/linkedin/callback
```

## Step 5 — Restart and connect

Restart the server (`make dev`), then click **Connect LinkedIn** on the Connections page. A LinkedIn tab opens, you approve, and it closes itself. The Connections card flips to connected when you come back.

## What you're granting

The connection asks for four scopes: `openid`, `profile`, `email`, and `w_member_social`. Together these let the app confirm who you are and post to LinkedIn on your behalf. It cannot read your feed, your connections, or your messages.

## Where the secrets live

The `.env` file and the tokens LinkedIn issues stay server-side. They never reach the browser, and the console never displays them. If you need to rotate the secret, update `.env` and restart the server; there's nothing to change in the console itself.
