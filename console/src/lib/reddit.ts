// Reddit self-post helpers: pure, DOM-free title helpers shared by the preview
// (and the "Copy to publish" flow that copies from it). Mirrors lib/linkedin.ts
// (which owns the LinkedIn fold/tokenizer) so each platform's client-side text
// rules live in one file. Reddit is a manual copy-paste channel — there is no
// OAuth connect path and no token anywhere in the console.

// Reddit caps a submission title at 300 characters. Unlike LinkedIn there is no
// "…see more" fold — the whole self-post body renders — so the client-side cue is
// a hard title limit plus a markdown body, not a char/line fold.
export const REDDIT_TITLE_MAX = 300

// Title-length cue for the editor/preview: current length, how many characters
// remain, and whether the title has run past Reddit's hard cap.
export function titleStatus(title: string): { length: number; remaining: number; over: boolean } {
  const length = title.length
  return { length, remaining: REDDIT_TITLE_MAX - length, over: length > REDDIT_TITLE_MAX }
}
