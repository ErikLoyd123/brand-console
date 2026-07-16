// The image-model bake-off: the evidence behind the "Choosing an image model" doc.
//
// Every model listed here was given the SAME prompt at the same size (1024x1024), one
// image per model, no cherry-picking — the two diffusion models also shared a seed per
// category. The renders are committed as web assets because they're a property of the
// MODELS, not of any user: a fresh clone shows the same comparison. (They're generic by
// construction — no personal data — which is what makes committing them legal under the
// repo's boundary rules.)
//
// Adding a category = drop four <model>.webp files in a new
// `assets/model-examples/<id>/` folder and add an entry below. The glob picks them up.

export type ModelId = 'flux2-klein' | 'flux1-schnell' | 'claude-opus' | 'claude-sonnet'

export type Family = 'diffusion' | 'composed'

export interface ModelMeta {
  id: ModelId
  label: string
  family: Family
}

// Display order across every row: the two diffusion models, then the two Claude tiers.
export const MODELS: ModelMeta[] = [
  { id: 'flux2-klein', label: 'FLUX.2 [klein]', family: 'diffusion' },
  { id: 'flux1-schnell', label: 'FLUX.1 [schnell]', family: 'diffusion' },
  { id: 'claude-opus', label: 'Claude Opus', family: 'composed' },
  { id: 'claude-sonnet', label: 'Claude Sonnet', family: 'composed' },
]

export const FAMILY_LABEL: Record<Family, string> = {
  diffusion: 'Local diffusion — paints a picture',
  composed: 'Claude — authors HTML, rasterized by Chromium',
}

export interface ExampleCategory {
  // Folder name under assets/model-examples/, e.g. '01-text-ui'.
  id: string
  title: string
  // Does the reader have to read something in this image? The whole routing rule.
  readable: boolean
  // The verbatim prompt every model received.
  prompt: string
  // Winning model, or 'tie-composed' when both Claude tiers win equally.
  winner: ModelId | 'tie-composed'
  // One line on what the images show. Plain language; this is user-facing.
  verdict: string
}

export const CATEGORIES: ExampleCategory[] = [
  {
    id: '01-text-ui',
    title: 'Dashboard card',
    readable: true,
    prompt:
      'A clean SaaS dashboard card on a light grey background, centered. The card has the heading "Cloud Spend" in bold sans-serif, the large number "$1.24M" beneath it, and a small green label reading "down 18% MoM". A simple bar chart sits at the bottom of the card. Crisp UI screenshot style, sharp legible text.',
    winner: 'claude-opus',
    verdict:
      'Both Claude tiers rendered every character exactly. FLUX.2 wrote "Cloud Spand"; FLUX.1 got the heading but turned $1.24M into $1.222M.',
  },
  {
    id: '02-portrait',
    title: 'Photoreal portrait',
    readable: false,
    prompt:
      'Photorealistic close-up portrait of a woman in her 40s with short curly grey hair, wearing a navy blazer, holding a white coffee mug with both hands visible. Soft window light from the left, shallow depth of field, natural skin texture, 85mm lens.',
    winner: 'flux2-klein',
    verdict:
      'The hard boundary. Claude cannot photograph — both tiers produced uncanny vector figures. FLUX.2 got both hands and the light direction right.',
  },
  {
    id: '03-diagram',
    title: 'Explainer diagram',
    readable: true,
    prompt:
      'A flat vector explainer diagram on a white background showing three labeled boxes connected left to right by arrows. The boxes read "INGEST", "REVIEW", and "PUBLISH" in clean uppercase sans-serif. Minimal two-color design, navy and orange, plenty of white space, no clutter.',
    winner: 'claude-opus',
    verdict:
      'Opus nailed the labels, the arrows, and the exact two colors asked for. FLUX.2 produced "INGSEST" and "PUBLISSH".',
  },
  {
    id: '04-spatial',
    title: 'Spatial flat-lay',
    readable: false,
    prompt:
      'A wooden desk photographed from directly above. On the left side, exactly three red apples in a row. In the center, a closed silver laptop. On the right side, a single tall glass of water. A yellow pencil lies diagonally across the bottom edge of the frame. Natural daylight, top-down flat lay.',
    winner: 'flux2-klein',
    verdict:
      'Four spatial constraints; only FLUX.2 satisfied all four. FLUX.1 floated the glass on top of the laptop and laid the pencil straight.',
  },
  {
    id: '05-illustration',
    title: 'Illustration (flat vector)',
    readable: false,
    prompt:
      'A whimsical flat illustration of an astronaut sitting cross-legged on a crescent moon, fishing with a rod into a sea of stars. Muted pastel palette, textured grain, bold simple shapes, children’s book poster style.',
    winner: 'claude-opus',
    verdict:
      'The upset: Opus beat both diffusion models. It was the only one to read "a sea of stars" as an actual sea. Sonnet, same brief, left out the moon entirely.',
  },
  {
    id: '06-landscape',
    title: 'Photoreal landscape',
    readable: false,
    prompt:
      'Photorealistic landscape at golden hour: a winding gravel road cutting through rolling green hills, low mist in the valley, dramatic clouds catching orange light, a lone oak tree on the right ridge. Wide angle, high dynamic range, sharp detail throughout.',
    winner: 'flux2-klein',
    verdict:
      'FLUX.2 is the more faithful photograph — mist low in the valley, real gravel, a leafy oak. FLUX.1 is punchier but over-cooked, and its tree is bare.',
  },
  {
    id: '07-comparison-table',
    title: 'Comparison table',
    readable: true,
    prompt:
      'A clean side-by-side comparison table on a white background, titled "Reserved vs On-Demand". Two columns headed "RESERVED" and "ON-DEMAND", and four labeled rows reading "Commitment", "Discount", "Flexibility", and "Best for". Crisp legible sans-serif text, thin grey rules, navy accents, generous padding.',
    winner: 'claude-opus',
    verdict:
      'Opus is publishable. Both diffusion models are unusable — FLUX.1 left the entire right column empty; FLUX.2 scattered row labels into the wrong cells.',
  },
  {
    id: '08-quote-card',
    title: 'Quote card',
    readable: true,
    prompt:
      'A pull-quote card on a deep navy background. Large white serif text reading "Most cloud waste is a forecasting problem, not an engineering problem." with a smaller attribution line beneath reading "A. Rivera, CFO". A thin orange rule above the quote. Elegant, lots of breathing room.',
    winner: 'tie-composed',
    verdict:
      'A full sentence destroys both diffusion models: "Most cloud wase is a forrecstuing problem, not an engginesnening problomm." Short words sometimes survive; sentences never do.',
  },
  {
    id: '09-data-chart',
    title: 'Data chart',
    readable: true,
    prompt:
      'A single clean bar chart on a white background showing monthly cloud spend falling over six months. Six vertical navy bars labeled "Jan" through "Jun" along the bottom, a y-axis labeled "$M" with gridlines, and the final bar highlighted in orange with the value "1.24" printed above it. Minimal, no legend, no clutter.',
    winner: 'tie-composed',
    verdict:
      'The clearest result in the test. Both Claude tiers are correct and truthful. FLUX.1’s axis reads 1500, 500, 400, 500, 250, 200 with months labeled "Jam, Uarm, Sun, Surn, Mott, Jun"; FLUX.2 drew three bars instead of six, rising instead of falling.',
  },
  {
    id: '10-abstract-metaphor',
    title: 'Abstract metaphor',
    readable: false,
    prompt:
      'An abstract conceptual image representing financial drift: a grid of precise glowing blue lines that gradually loosens, warps and frays toward the right side of the frame, dissolving into scattered orange particles against a dark background. No text, no people, moody, high contrast, cinematic.',
    winner: 'flux2-klein',
    verdict:
      'The best image in the entire test, and the other end of the boundary. No text to spell means diffusion is playing to its strength. Claude competes but reads busier and less cinematic.',
  },
]

// Eager glob: 40 small webp files resolved at build time and hashed by Vite. Keyed
// '<category-id>/<model-id>'.
const files = import.meta.glob('../assets/model-examples/*/*.webp', {
  import: 'default',
  eager: true,
}) as Record<string, string>

const byKey: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  const parts = path.split('/')
  const model = (parts.pop() ?? '').replace(/\.webp$/, '')
  const category = parts.pop() ?? ''
  byKey[`${category}/${model}`] = url
}

// Returns undefined when a render is missing, so the view can say so rather than
// showing a broken image.
export function exampleImage(categoryId: string, model: ModelId): string | undefined {
  return byKey[`${categoryId}/${model}`]
}

export const TOTALS = {
  categories: CATEGORIES.length,
  models: MODELS.length,
  images: CATEGORIES.length * MODELS.length,
}
