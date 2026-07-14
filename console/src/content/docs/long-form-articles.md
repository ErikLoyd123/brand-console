---
title: "Long-form articles"
category: Reference
order: 4
---

The **Articles** screen is the long-form lane. It rides the same spine as your short posts —
a topic pillar, an intent, and your voice — but a long piece is too big for a single
hook/body/close, so it gets its own workbench: an outline of sections, SEO fields, and a
Markdown export. Nothing here publishes for you; the last step is a file you place yourself.

## How a piece flows

A long-form piece moves through the same shape as a short post, one size up:

1. **Intake.** You start a piece the same two ways you start any post — a **spark** (your own
   idea) or a **Discovery** item (something you read) — and choose the **`web`** platform and a
   **piece kind** (how-to, explainer, comparison, thought piece, whitepaper). You also type the
   one **target keyword** and who's searching for it (**search intent**). That creates the queue
   item and the article together.
2. **Outline.** Build the argument's shape: an ordered list of **sections**, each with a heading
   and a one-line **intent** (what that section must accomplish). Do it by hand, or use **Develop
   the outline with AI** — it reads your idea and the piece kind's guidance and drafts the
   headings and intents for you to approve. Bodies stay empty at this stage.
3. **Sectioned draft.** Write each section's body in your voice — **Draft a section with AI**
   writes them one at a time from each section's intent, so a long piece never has to land in a
   single generation. This is also where the **meta description** gets filled. Loop back with
   **Refine with AI** to sharpen any one section.
4. **Review.** The same voice gate that reads your short posts reads this one, against your active
   profile's voice card. Long-form adds two checks on top: the piece kind's own guidance (a
   comparison must actually compare; a how-to must leave you able to do the thing) and a plain SEO
   sanity check (is the keyword in the title, the lead heading, and the meta description, and is
   the meta the right length). It reports; you decide.
5. **Export.** **Export as Markdown** writes the piece to a local file at
   `data/exports/<profile>/<slug>.md` with an SEO frontmatter block — title, meta description,
   target keyword, slug, and the date — and shows you the path. Re-exporting overwrites the same
   file. Publishing is a **manual Markdown drop**: take that file to whatever site or CMS you use.

## What each field is for

| Field | What it is | When it's set |
|---|---|---|
| **Title** | The piece's working title; becomes the `# H1` and frontmatter `title` | Intake, editable throughout |
| **Target keyword** | The one phrase the piece targets | Intake |
| **Search intent** | Who's searching and why, in your words | Intake |
| **Meta description** | The search-result snippet; frontmatter `description` | Draft |
| **Slug** | The URL slug and export filename | Outline |
| **Length target** | A target word count — guidance, never a gate | Defaulted per kind; you override |
| **Stage** | Where the piece is (outlining → exported); advance it by hand or let a skill move it | Throughout |
| **Review status** | Whether it passed the voice gate — the same badge your drafts carry | Set by review, or by your edits |

Everything on this screen belongs to the **active profile**. Switching profiles in the sidebar
re-scopes the Articles list to that brand's pieces, and each brand's exports land in its own
folder, so two brands never collide on a shared slug.
