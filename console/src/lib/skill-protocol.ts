// Console-side copy of the page/skill message contract. Mirrors the server's
// src/server/skill-protocol.ts (there is no shared TS project across the Vite app
// and the Express API). Design:
// docs/cadence/designs/2026-07-03-console-skill-surface/01-protocol.md

// --- Downstream (server/skill -> page) --------------------------------------

// An image the question is about (e.g. a rendered graphic awaiting approval),
// inlined as a data URI so the page can show it with no extra route or fetch.
export interface AskImage {
  src: string
  alt?: string
}

export interface AskChoiceOption {
  label: string
  description: string
  preview?: string
  // Present when the option IS an image (a generated candidate among several):
  // the page renders a labeled gallery, one figure per option, above the buttons.
  image?: AskImage
}

export interface AskChoice {
  type: 'ask_choice'
  conversationId: string
  id: string
  prompt: string
  options: AskChoiceOption[]
  multiSelect?: boolean
  allowFreeText?: boolean
  image?: AskImage
}

export interface AskText {
  type: 'ask_text'
  conversationId: string
  id: string
  prompt: string
  placeholder?: string
  image?: AskImage
}

export interface Status {
  type: 'status'
  conversationId: string
  message: string
}

export interface Result {
  type: 'result'
  conversationId: string
  summary: string
  link?: string
  done: true
}

// Live, streaming glimpse of the model's reasoning/narration while it works.
// Ephemeral like `status`: the page shows the latest text and never persists it.
export interface Thought {
  type: 'thought'
  conversationId: string
  text: string
}

export interface Ready {
  type: 'ready'
  conversationId: string
}

export interface ErrorMessage {
  type: 'error'
  conversationId: string
  message: string
  kind: 'spawn_failed' | 'died_midrun' | 'unreachable'
}

export type DownstreamMessage = AskChoice | AskText | Status | Result
export type DownstreamFrame = DownstreamMessage | Ready | ErrorMessage | Thought

// --- Upstream (page -> server/skill) ----------------------------------------

export interface Start {
  type: 'start'
  skillName: string
  initialInput?: string
  // Optional Claude model override for this session (alias or full model id,
  // e.g. "claude-opus-4-8"). Omitted = the engine's default.
  model?: string
}

export interface Choice {
  type: 'choice'
  conversationId: string
  id: string
  selected: string[]
}

export interface Text {
  type: 'text'
  conversationId: string
  id: string
  value: string
}

export interface Abort {
  type: 'abort'
  conversationId?: string
  reason?: string
}

export type UpstreamMessage = Start | Choice | Text | Abort

// The seven-plus-two known downstream discriminators; anything else is dropped by
// the transport (forward-compat, per 01-protocol#Forward compatibility).
const KNOWN_DOWNSTREAM = new Set([
  'ask_choice',
  'ask_text',
  'status',
  'result',
  'ready',
  'error',
  'thought',
])

export function isKnownDownstream(msg: unknown): msg is DownstreamFrame {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as { type: unknown }).type === 'string' &&
    KNOWN_DOWNSTREAM.has((msg as { type: string }).type)
  )
}
