import type { Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { query, tool, createSdkMcpServer, AbortError } from '@anthropic-ai/claude-agent-sdk';
import { REPO_ROOT } from '../profile/loader';
import { registerUpgrade } from './ws-upgrade';
import type {
  DownstreamFrame,
  UpstreamMessage,
  AskChoiceOption,
} from './skill-protocol';

// The headless counterpart to the interactive PTY terminal (src/server/terminal.ts).
// Where the terminal streams raw bytes to an xterm, this engine runs a headless,
// structured Claude session via the Agent SDK and speaks the JSON protocol in
// src/server/skill-protocol.ts. Full design:
// docs/cadence/designs/2026-07-03-console-skill-surface/02-headless-engine.md.

const SKILLS_DIR = resolve(REPO_ROOT, '.claude', 'skills');

// One-line instruction prepended to the skill so the model routes its questions
// through the ask_user tool instead of printing them. The skill markdown itself
// is loaded verbatim and never edited.
const PREAMBLE =
  'You are running the skill below inside a headless session whose only channel to ' +
  'the user is the `ask_user` tool. When the skill says to ask the user something — a ' +
  'question, a set of options to pick from, anything needing their input — you MUST call ' +
  'the `ask_user` tool instead of printing the question, and use the tool result as the ' +
  "user's answer before continuing. Do not print questions as prose; the user cannot see " +
  'your text, only ask_user calls and the final outcome. Each ask_user prompt renders as ' +
  'a small question card: keep it to one plain-language question of a sentence or two — ' +
  'no headings, section labels, bullet lists, or jargon the sentence does not explain — ' +
  "and put any teaching or examples in the options' descriptions instead. " +
  'Follow the skill exactly.';

// Answer + overall run guards so a wedged model turn or an unanswered question
// cannot orphan a session (design: Lifecycle — lazy and ephemeral).
const ANSWER_TIMEOUT_MS = 10 * 60 * 1000;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;

// When a session is torn down mid-flight (abort, disconnect, timeout), the Agent
// SDK's control transport can throw a benign AbortError from an un-awaited internal
// promise — it never reaches the driver's own try/catch, so without this it becomes
// an unhandledRejection and crashes the whole API. Swallow exactly that, and only
// that, preserving fail-fast for every other unhandled rejection.
function isBenignAbort(reason: unknown): boolean {
  return (
    reason instanceof AbortError ||
    (reason instanceof Error && reason.message === 'Operation aborted')
  );
}

let abortGuardInstalled = false;
function installAbortGuard(): void {
  if (abortGuardInstalled) return;
  abortGuardInstalled = true;
  process.on('unhandledRejection', (reason) => {
    if (isBenignAbort(reason)) return;
    throw reason; // re-raise genuine unhandled rejections (default crash semantics)
  });
}

// Capability probe for GET /api/skill-surface/health. Non-spawning: it answers
// "could a session start?" by checking for a usable Claude credential/auth, never
// by opening a session. Mirrors the honest-health idiom used elsewhere.
export function probeClaudeAvailable(): boolean {
  if (process.env.ANTHROPIC_API_KEY) return true;
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return true;
  if (process.env.CLAUDE_BIN) return true;
  // Claude Code stores its auth under ~/.claude; its presence means the bundled
  // CLI the SDK drives can authenticate without an explicit API key.
  try {
    if (existsSync(resolve(homedir(), '.claude'))) return true;
  } catch {
    // homedir/statting failed — fall through to unavailable.
  }
  return false;
}

// Read a skill's SKILL.md verbatim, selected by frontmatter/dir name. Reuses the
// same on-disk layout GET /api/skills scans. Returns null when the skill is unknown.
function loadSkillMarkdown(skillName: string): string | null {
  // Guard against path traversal via the client-supplied skill name.
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(skillName)) return null;
  const file = resolve(SKILLS_DIR, skillName, 'SKILL.md');
  if (!file.startsWith(SKILLS_DIR) || !existsSync(file)) return null;
  return readFileSync(file, 'utf8');
}

// Drives exactly one skill session for one socket. All protocol I/O for the
// conversation flows through here; teardown is idempotent.
function driveSession(ws: WebSocket, skillName: string, initialInput: string | undefined): void {
  const conversationId = nanoid();
  const send = (frame: DownstreamFrame) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
  };

  const skillMd = loadSkillMarkdown(skillName);
  if (skillMd === null) {
    send({
      type: 'error',
      conversationId,
      message: `Skill "${skillName}" not found.`,
      kind: 'spawn_failed',
    });
    ws.close();
    return;
  }

  // Pending ask_user resolvers, keyed by the correlation id sent to the page. At
  // most one is outstanding at a time (the model's turn blocks on the awaited
  // tool), but the map still guards a stale answer after an abort/restart.
  const pending = new Map<string, { resolve: (v: string) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  const abortController = new AbortController();

  let torndown = false;

  // Streamed reasoning buffer. Thinking/text deltas accumulate here and a throttled
  // flush pushes the latest snapshot as a `thought` frame — so the page shows the
  // model actually reasoning, without a WebSocket frame per token.
  let thoughtBuf = '';
  let thoughtDirty = false;
  const thoughtFlush = setInterval(() => {
    if (thoughtDirty && !torndown) {
      thoughtDirty = false;
      send({ type: 'thought', conversationId, text: thoughtBuf });
    }
  }, 120);

  const teardown = (reason?: Error) => {
    if (torndown) return;
    torndown = true;
    disarmRunTimer();
    clearInterval(thoughtFlush);
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(reason ?? new Error('session torn down'));
    }
    pending.clear();
    try {
      abortController.abort();
    } catch {
      // already aborted / nothing to abort
    }
  };

  // The single tool the session gets. A call becomes a downstream ask frame; the
  // page's answer resolves the awaited promise, which the SDK feeds back as the
  // tool result so the model's run resumes exactly where it suspended.
  const askUser = tool(
    'ask_user',
    'Ask the profile owner a question and wait for their answer. Provide `options` for a ' +
      'multiple-choice question (each with a label and a one-line description), or omit ' +
      'options for a free-text question. Every choice question also shows the user a ' +
      'free-text box, so the answer may be one of your option labels or the user\'s own ' +
      'words — treat an off-menu answer as a valid response, not an error. Returns the ' +
      'answer as text.',
    {
      prompt: z.string().describe('The question shown to the user.'),
      options: z
        .array(
          z.object({
            label: z.string(),
            description: z.string(),
            preview: z.string().optional(),
          }),
        )
        .optional()
        .describe('Present => a choice question. Absent/empty => free text.'),
      multiSelect: z.boolean().optional(),
    },
    async (args) => {
      const answer = await new Promise<string>((resolvePromise, rejectPromise) => {
        if (torndown) {
          rejectPromise(new Error('session torn down'));
          return;
        }
        // The turn is now the user's: stop their think-time counting against the run.
        disarmRunTimer();
        const id = nanoid();
        const timer = setTimeout(() => {
          pending.delete(id);
          send({
            type: 'error',
            conversationId,
            message: 'Timed out waiting for an answer.',
            kind: 'died_midrun',
          });
          rejectPromise(new Error('answer timeout'));
          teardown();
          ws.close();
        }, ANSWER_TIMEOUT_MS);
        pending.set(id, { resolve: resolvePromise, reject: rejectPromise, timer });

        // A question is on the way — clear any streamed thinking so it doesn't
        // linger under the question the user is answering.
        thoughtBuf = '';
        thoughtDirty = false;
        send({ type: 'thought', conversationId, text: '' });

        const opts = args.options as AskChoiceOption[] | undefined;
        if (opts && opts.length > 0) {
          send({
            type: 'ask_choice',
            conversationId,
            id,
            prompt: args.prompt,
            options: opts,
            multiSelect: args.multiSelect,
            // Always on: the user must never be boxed into the offered options.
            allowFreeText: true,
          });
        } else {
          send({ type: 'ask_text', conversationId, id, prompt: args.prompt });
        }
      });
      // Answer in hand — the model holds the turn again; restart its budget fresh.
      if (!torndown) armRunTimer();
      return { content: [{ type: 'text' as const, text: answer }] };
    },
  );

  const askServer = createSdkMcpServer({
    name: 'skill-surface',
    version: '1.0.0',
    tools: [askUser],
  });

  // Route upstream answers to the matching pending resolver. Unknown types are
  // ignored (forward-compat, per 01-protocol).
  ws.on('message', (data) => {
    let msg: UpstreamMessage;
    try {
      msg = JSON.parse(data.toString()) as UpstreamMessage;
    } catch {
      return; // non-JSON frame — drop
    }
    if (msg.type === 'abort') {
      teardown();
      ws.close();
      return;
    }
    if (msg.type === 'choice' || msg.type === 'text') {
      const p = pending.get(msg.id);
      if (!p) return; // stale/unknown correlation id — drop
      pending.delete(msg.id);
      clearTimeout(p.timer);
      p.resolve(msg.type === 'choice' ? msg.selected.join(', ') : msg.value);
    }
    // `start` never arrives here — it was consumed by attachSkillSurface.
  });

  ws.on('close', () => teardown());
  ws.on('error', () => teardown());

  // Overall run guard, counted only while the model holds the turn. It pauses
  // whenever a question is waiting on the user — think-time is theirs and must not
  // burn the budget (a several-question interview used to blow the whole limit and
  // die mid-run); the unanswered-question case has its own ANSWER_TIMEOUT_MS guard.
  let runTimer: NodeJS.Timeout | undefined;
  const disarmRunTimer = () => clearTimeout(runTimer);
  const armRunTimer = () => {
    disarmRunTimer();
    runTimer = setTimeout(() => {
      if (torndown) return;
      send({
        type: 'error',
        conversationId,
        message: 'Session exceeded its time limit.',
        kind: 'died_midrun',
      });
      teardown();
      ws.close();
    }, RUN_TIMEOUT_MS);
  };
  armRunTimer();

  // Kick off the headless run. The skill markdown rides in the appended system
  // prompt (verbatim); initialInput is the first user turn.
  (async () => {
    try {
      send({ type: 'ready', conversationId });
      // 'Thinking…' is the client's ambient trigger — it rotates spark-flavored
      // hints until a concrete tool beat replaces them.
      send({ type: 'status', conversationId, message: 'Thinking…' });

      const run = query({
        prompt: initialInput && initialInput.trim() !== '' ? initialInput : 'Begin.',
        options: {
          cwd: REPO_ROOT,
          abortController,
          mcpServers: { 'skill-surface': askServer },
          // Headless, single-user, local: no human is present to approve each
          // step, so the session runs the skill's own commands (e.g. spark's
          // `npx tsx src/ingest/capture.ts`) without prompting.
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code',
            append: `${PREAMBLE}\n\n=== SKILL: ${skillName} ===\n\n${skillMd}`,
          },
          // Make the model actually reason (spark routes questions through the tool,
          // so its thinking is where the substance is), and stream tokens so the
          // page can show that reasoning live.
          maxThinkingTokens: 6000,
          includePartialMessages: true,
        },
      });

      let finalText = '';
      for await (const message of run) {
        if (torndown) break;
        if (message.type === 'stream_event') {
          // Token-level deltas: accumulate the model's live reasoning/narration into
          // the thought buffer; the throttled flush relays it to the page.
          const ev = message.event as unknown as {
            type?: string;
            content_block?: { type?: string };
            delta?: { type?: string; thinking?: string; text?: string };
          };
          if (ev?.type === 'content_block_start') {
            // A new reasoning/narration block: keep the running transcript and add a
            // separator rather than wiping it — wiping made the panel flicker back to
            // empty between blocks. The transcript is cleared only when a question
            // renders (in the ask handler).
            const bt = ev.content_block?.type;
            if (
              (bt === 'thinking' || bt === 'redacted_thinking' || bt === 'text') &&
              thoughtBuf &&
              !thoughtBuf.endsWith('\n')
            ) {
              thoughtBuf += '\n\n';
              thoughtDirty = true;
            }
          } else if (ev?.type === 'content_block_delta') {
            const d = ev.delta;
            if (d?.type === 'thinking_delta' && typeof d.thinking === 'string') {
              thoughtBuf += d.thinking;
              thoughtDirty = true;
            } else if (d?.type === 'text_delta' && typeof d.text === 'string') {
              thoughtBuf += d.text;
              thoughtDirty = true;
            }
          }
          continue;
        }
        if (message.type === 'assistant') {
          // Reflect what the skill is actually doing this turn: a concrete beat
          // for a recognized tool, ambient 'Thinking…' otherwise, or nothing when
          // it's about to ask (the ask frame renders itself).
          const { label, suppress } = statusFromAssistant(message);
          if (!suppress) {
            send({ type: 'status', conversationId, message: label ?? 'Thinking…' });
          }
        } else if (message.type === 'result') {
          finalText =
            'result' in message && typeof message.result === 'string'
              ? message.result
              : finalText;
        }
      }

      if (torndown) return;
      disarmRunTimer();
      send({
        type: 'result',
        conversationId,
        summary: finalText.trim() !== '' ? finalText.trim() : 'Done.',
        link: resultLink(skillName, finalText),
        done: true,
      });
      teardown();
      ws.close();
    } catch (err) {
      disarmRunTimer();
      if (torndown) return;
      const reason = err instanceof Error ? err.message : String(err);
      send({ type: 'error', conversationId, message: reason, kind: 'died_midrun' });
      teardown();
      ws.close();
    }
  })();
}

// Map a real tool call in the session's stream to an honest, human status line —
// so the working state reflects what the skill is actually doing (checking the
// profile, writing the seed) rather than a canned label. Returns null to leave the
// client on its ambient "thinking" rotation (nothing concrete worth naming).
function statusForTool(name: string, input: unknown): string | null {
  const cmd =
    input && typeof input === 'object' && 'command' in input
      ? String((input as { command: unknown }).command)
      : '';
  if (name === 'Bash') {
    // Order matters: the register write lives under src/profile, so its "Saving your
    // register" beat must win before the broader profile/identity read pattern below.
    if (/write-pillars/i.test(cmd)) return 'Saving your pillars';
    if (/develop-idea/i.test(cmd)) return 'Developing your idea';
    if (/promote-item/i.test(cmd)) return 'Promoting to the queue';
    if (/update-draft/i.test(cmd)) return 'Revising your draft';
    if (/draft-store/i.test(cmd)) return 'Writing the draft';
    if (/write-register|write-identity/i.test(cmd)) return 'Saving your register';
    if (/write-voice-card/i.test(cmd)) return 'Saving your voice card';
    if (/create-article/i.test(cmd)) return 'Creating the article';
    if (/capture\.ts|ingest\/capture/i.test(cmd)) return 'Saving to the queue';
    if (/completeness|checkCompleteness|identity|\bprofile\b/i.test(cmd)) return 'Checking your setup';
    return 'Working through it';
  }
  return null; // Read/Grep/Glob/ask_user etc. — no concrete beat; stay ambient
}

// Derive a single status from one assistant message's content blocks. Returns the
// most specific tool beat, `{ambient:true}` for pure thinking, or `{suppress:true}`
// when the model is about to ask (the ask frame renders itself — no flash).
function statusFromAssistant(message: unknown): { label?: string; suppress?: boolean } {
  const content =
    message && typeof message === 'object' && 'message' in message
      ? (message as { message?: { content?: unknown } }).message?.content
      : undefined;
  const blocks = Array.isArray(content) ? (content as Array<Record<string, unknown>>) : [];
  let label: string | undefined;
  for (const b of blocks) {
    if (b.type === 'tool_use') {
      if (String(b.name ?? '').includes('ask_user')) return { suppress: true };
      const s = statusForTool(String(b.name ?? ''), b.input);
      if (s) label = s;
    }
  }
  return { label };
}

// Where a finished skill's result should deep-link, if anywhere. The console is
// hash-routed (#/queue). spark files an item into the queue, so it links there — to the
// specific created item (#/queue?item=<id>) when its id is parseable, else the queue
// itself. Skills that only mutate local config (e.g. `register` writing identity.yaml)
// file nothing to the queue: they stay on their own page and carry no link, so the
// result card shows just a summary. Default: no link. Keyed on skillName so adding a
// tenant is one explicit line, not a parsing heuristic.
function resultLink(skillName: string, finalText: string): string | undefined {
  // spark files a spark into the queue; discovery promotes a discovered item into it. Both
  // land a new idea, so both deep-link to the created item (else the queue). But spark can
  // now carry on past the seed: when its final report names an article (web long-form) or a
  // draft, the work product lives on that screen, so land there instead of the queue.
  if (skillName === 'spark' || skillName === 'discovery') {
    if (/\barticle\b/i.test(finalText)) return '#/articles';
    if (/\bdraft\b/i.test(finalText)) return '#/drafts';
    const ideaId = extractIdeaId(finalText);
    return ideaId ? `#/queue?item=${ideaId}` : '#/queue';
  }
  // The queue skill does three things: develop (shapes the idea — stay on the Queue, deep-linked
  // to the item), or draft/revise (lands or changes a draft — go to the Drafts screen). The final
  // report names a draft only in the draft/revise branches, so that word disambiguates.
  if (skillName === 'queue') {
    if (/\bdraft\b/i.test(finalText)) return '#/drafts';
    const ideaId = extractIdeaId(finalText);
    return ideaId ? `#/queue?item=${ideaId}` : '#/queue';
  }
  // The drafts skill revises a draft in place on the Drafts screen — no navigation needed.
  return undefined;
}

// Pull the created idea id out of the skill's final report. spark reports
// "…spark `<sparkId>` → idea `<ideaId>`", so prefer an id labeled "idea", and
// otherwise take the last backtick-wrapped id-shaped token (the idea is reported
// last). Ids are nanoids: [A-Za-z0-9_-].
function extractIdeaId(text: string): string | undefined {
  const labeled = /idea[^`]{0,12}`([A-Za-z0-9_-]{12,})`/i.exec(text);
  if (labeled) return labeled[1];
  const all = [...text.matchAll(/`([A-Za-z0-9_-]{12,})`/g)];
  return all.length ? all[all.length - 1][1] : undefined;
}

// Attach the /api/skill-surface WebSocket transport alongside /api/terminal. Its
// own noServer WebSocketServer + upgrade guard keyed on pathname, so the two
// endpoints coexist without interfering.
export function attachSkillSurface(server: Server): void {
  installAbortGuard();
  const wss = new WebSocketServer({ noServer: true });

  // The shared upgrade router dispatches /api/skill-surface to this server and
  // /api/terminal to the terminal's, destroying anything else exactly once.
  registerUpgrade(server, '/api/skill-surface', wss);

  wss.on('connection', (ws: WebSocket) => {
    // Lazy: the socket may open on mount, but no session spawns until the client
    // sends `start`. The `start` frame both opens and seeds the run.
    const onFirst = (data: import('ws').RawData) => {
      let msg: UpstreamMessage;
      try {
        msg = JSON.parse(data.toString()) as UpstreamMessage;
      } catch {
        return; // wait for a well-formed frame
      }
      if (msg.type !== 'start') return; // ignore anything before start
      ws.off('message', onFirst);
      driveSession(ws, msg.skillName, msg.initialInput);
    };
    ws.on('message', onFirst);
  });
}
