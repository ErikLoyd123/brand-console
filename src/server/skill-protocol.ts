// The typed message contract between a console page and the skill running behind
// it. Server-side copy of the protocol defined in
// docs/cadence/designs/2026-07-03-console-skill-surface/01-protocol.md.
// The console mirrors these shapes in console/src/lib/skill-protocol.ts — keep the
// two in sync (there is no shared TS project across the API and the Vite app).

// --- Downstream (server/skill -> page) --------------------------------------

export interface AskChoiceOption {
  label: string;
  description: string;
  preview?: string;
}

// An image the question is about (e.g. a rendered graphic awaiting approval),
// inlined as a data URI so the page can show it with no extra route or fetch.
export interface AskImage {
  src: string;
  alt?: string;
}

export interface AskChoice {
  type: 'ask_choice';
  conversationId: string;
  id: string;
  prompt: string;
  options: AskChoiceOption[];
  multiSelect?: boolean;
  allowFreeText?: boolean;
  image?: AskImage;
}

export interface AskText {
  type: 'ask_text';
  conversationId: string;
  id: string;
  prompt: string;
  placeholder?: string;
  image?: AskImage;
}

export interface Status {
  type: 'status';
  conversationId: string;
  message: string;
}

export interface Result {
  type: 'result';
  conversationId: string;
  summary: string;
  link?: string;
  done: true;
}

// Live, streaming glimpse of the model's reasoning/narration while it works.
// Ephemeral like `status`: the page shows the latest text and never persists it.
export interface Thought {
  type: 'thought';
  conversationId: string;
  text: string;
}

export interface Ready {
  type: 'ready';
  conversationId: string;
}

export interface ErrorMessage {
  type: 'error';
  conversationId: string;
  message: string;
  kind: 'spawn_failed' | 'died_midrun' | 'unreachable';
}

export type DownstreamMessage = AskChoice | AskText | Status | Result;
export type DownstreamFrame = DownstreamMessage | Ready | ErrorMessage | Thought;

// --- Upstream (page -> server/skill) ----------------------------------------

export interface Start {
  type: 'start';
  skillName: string;
  initialInput?: string;
}

export interface Choice {
  type: 'choice';
  conversationId: string;
  id: string;
  selected: string[];
}

export interface Text {
  type: 'text';
  conversationId: string;
  id: string;
  value: string;
}

export interface Abort {
  type: 'abort';
  conversationId?: string;
  reason?: string;
}

export type UpstreamMessage = Start | Choice | Text | Abort;
