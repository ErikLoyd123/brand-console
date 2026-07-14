---
title: "Long-form articles"
category: Reference
order: 4
---

Long-form web pieces ride the same spine as your short posts — a topic pillar, an intent,
and your voice — and they live in the same place: the **Queue**, which is the review phase
for every lane. There is no separate Articles screen; a web piece is a queue card whose
content is the whole article as **one markdown document**, plus the SEO fields that ride
into its export. Nothing here publishes for you; the last step is a file you place yourself.

## How a piece flows

1. **Intake.** You start a piece the same two ways you start any post — a **spark** (pick
   **Web** on the Spark form, and a **piece kind** if you already know it) or a
   **Discovery** item (work it up and choose the `web` lane). The interview draws out your
   take and captures the two SEO inputs — the one **target keyword** and who's searching
   for it (**search intent**) — and saves everything before any writing starts.
2. **The write.** The same AI run then writes the full article: one light check on the
   section structure, then the whole piece as a single markdown document (headings
   inline), with the **meta description** and **slug** filled. It lands on the idea's
   Queue card. Your take is the spine throughout — the AI never invents your argument, and
   any fact you haven't supplied is a `[FILL: …]` marker, never a guess.
3. **Review — on the queue card.** Read the piece in the card's content box. Edit it (and
   the meta description / slug) by hand, or **Write with AI** again to revise a part of it.
   **Review with AI** runs the `content-reviewer` gate: your voice card's rules, the piece
   kind's own guidance (a comparison must actually compare; a how-to must leave you able to
   do the thing), and a plain SEO sanity check (keyword in the title, the lead heading, and
   the meta description; meta the right length). The verdict shows as the card's review
   badge; any edit resets it to pending. It reports; you decide.
4. **Publish = export.** When it's good to go, **Publish** on the card writes the piece to
   a local file at `data/exports/<profile>/<slug>.md` with an SEO frontmatter block —
   title, meta description, target keyword, slug, and the date — and moves it to the
   **Published** screen, where the row shows the file's path. The file is the shipped
   artifact: take it to whatever site or CMS you use.

## What each field is for

| Field | What it is | When it's set |
|---|---|---|
| **Title** | The piece's working title; becomes the `# H1` and frontmatter `title` | Intake, editable throughout |
| **Target keyword** | The one phrase the piece targets | Intake |
| **Search intent** | Who's searching and why, in your words | Intake |
| **Body** | The whole article, one markdown document with `##` headings inline | The write; edit any time on the card |
| **Meta description** | The search-result snippet; frontmatter `description` | The write; editable on the card |
| **Slug** | The URL slug and export filename | The write; editable on the card |
| **Review status** | Whether it passed the voice + SEO gate — the same badge posts carry | Set by review, or reset by your edits |

Everything belongs to the **active profile**. Switching profiles in the sidebar re-scopes
the Queue to that brand's pieces, and each brand's exports land in its own folder, so two
brands never collide on a shared slug. Deleting the idea from its queue card removes the
article with it — unless the piece was already exported; shipped history stays.
