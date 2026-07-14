---
title: The AI assistants & the terminal
category: Reference
order: 5
---

Everything AI-powered in this console — the guided setup, the per-page assistants, the
embedded terminal — runs the **real Claude Code CLI on your machine**, on your own
subscription. Nothing is reimplemented, nothing goes through a third-party middleman, and
no credentials pass through the console.

## The per-page assistants

Most pipeline pages carry their own assistant, scoped to that page's job:

- **Spark** shapes a raw one-liner into a seeded queue item, then writes the full piece
  onto its queue card.
- **Discovery**'s "Work up with AI" reads a found article, draws out your take and
  points, promotes it into the queue, and writes the full piece.
- **Queue** develops an idea's points, writes the full piece (post or long-form article)
  from your take, and revises what's written, in your voice.
- **Voice** hosts the setup interview and targeted voice-card edits.
- **Feeds**, **Pillars**, and **Tags** each have an assistant for managing their own data.

Each assistant is one of the repo's skills (`.claude/skills/`), surfaced in-app. They all
read the **active profile's** voice card and identity first, so switching profiles
switches whose voice they work in.

## The embedded terminal

The top-right **Terminal** button opens a live Claude Code session inside the console.
A chip per skill and agent types its command into the session for you; you can also just
chat. The chips are generated automatically from each skill's name and description —
the same skills the page assistants run.

## What it needs

- **Claude Code installed and on your PATH.** The console launches the `claude` binary
  through your login shell, the same way your own terminal finds it. If it can't be
  found (unusual install, custom PATH, Windows), set `CLAUDE_BIN` to its absolute path
  in `.env` — see `.env.example`.
- **On macOS, the Xcode command-line tools** (`xcode-select --install`) — the terminal's
  native `node-pty` module needs them at install time. If the terminal can't start, the
  drawer says so, and its chips fall back to copying the command for you to paste into
  your own terminal.

Without Claude Code the console still runs — pages, editing, publishing all work — but
the assistants and terminal won't.
