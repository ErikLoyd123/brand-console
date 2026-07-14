---
title: Publishing to LinkedIn
category: Setup
order: 3
---

Once LinkedIn is connected (see **Connect LinkedIn**), a LinkedIn idea's queue card gains a **Publish to LinkedIn** button.

Publishing is a deliberate action, not a click. You have to type `PUBLISH` (exact capitals) into a field before the button will fire. That's a hard gate on purpose: nothing goes out to a real audience by accident.

If you'd rather not connect LinkedIn at all, or you just want to publish somewhere else, the **Copy** button on the queue card stays available either way. It copies the finished post text to your clipboard so you can paste it wherever you publish from.

## Publishing to Reddit

Reddit is a **manual copy-paste channel** — there's no API connection, no OAuth, and no direct-submit button. Reddit locked down self-serve Data API app creation, so the console doesn't automate Reddit at all.

The flow is simple:

1. Draft the Reddit post in the console like any other. The editor and preview understand Reddit self-posts — a plain title (with the 300-character title-length cue) plus a markdown body — so what you see is what you'll paste.
2. Hit **Copy** on the queue card, paste the finished text wherever you publish, then hit **Publish** on the card to record it in **Published**.
3. Open Reddit, start a post in the subreddit or on your `u/` profile, and paste. You choose the destination, set any required flair, and submit — by hand.

Because you're posting it yourself, you're the one clearing each subreddit's rules (flair, title limits, allowed content). The console can't preflight those without the API, so give the subreddit's posting rules a quick read before you submit — an accidental rule break can get you banned.

The subreddits you post to can still be listed under `reddit.destinations` in your profile's `identity.yaml` (in `profiles/<slug>/`) as a personal reference, but nothing in the console reads them anymore — they're just notes to yourself now.
