import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import * as pty from 'node-pty';
import { REPO_ROOT } from '../profile/loader';
import { registerUpgrade } from './ws-upgrade';

// How to launch the `claude` CLI, resolved at spawn time. Three layers, first wins:
//   1. CLAUDE_BIN env override — escape hatch for non-standard installs or Windows.
//   2. Windows — spawn `claude` directly; node-pty uses ConPTY and resolves via PATH.
//   3. POSIX — launch through a login+interactive shell so claude resolves via the
//      user's own PATH. Claude Code installs to ~/.local/bin, which is added to PATH
//      in an interactive rc file (~/.zshrc) the server process may not have sourced;
//      `exec` replaces the shell with claude so exit/teardown semantics stay clean.
function resolveClaudeLaunch(): { file: string; args: string[] } {
  if (process.env.CLAUDE_BIN) return { file: process.env.CLAUDE_BIN, args: [] };
  if (process.platform === 'win32') return { file: 'claude.cmd', args: [] };
  const shell = process.env.SHELL || '/bin/zsh';
  return { file: shell, args: ['-lic', 'exec claude'] };
}

// Attach a WebSocket transport for a live `claude` pty session at /api/terminal.
// One pty per socket, one socket per open drawer; teardown is symmetric and idempotent.
export function attachTerminal(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Route only /api/terminal upgrades here; the shared router (ws-upgrade.ts)
  // dispatches by path and destroys anything unrecognized, so terminal and the
  // skill-surface endpoint coexist without one tearing down the other's socket.
  registerUpgrade(server, '/api/terminal', wss);

  wss.on('connection', (ws: WebSocket) => {
    let term: pty.IPty;
    try {
      // Resolve how to launch claude (override / platform / login-shell), then spawn.
      const { file, args } = resolveClaudeLaunch();
      term = pty.spawn(file, args, {
        name: 'xterm-color',
        cwd: REPO_ROOT,
        env: process.env as Record<string, string>,
      });
    } catch (err) {
      // pty.spawn threw (e.g. claude not on PATH, node-pty broken): send a
      // distinguishable error frame so the client routes to the clipboard fallback.
      const reason = err instanceof Error ? err.message : String(err);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', reason }));
      }
      ws.close();
      return;
    }

    // Guard against double-teardown: whichever side ends first tears down the other,
    // and this flag prevents a kill() on an already-exited pty or a re-close.
    let torndown = false;
    const teardown = () => {
      if (torndown) return;
      torndown = true;
      try {
        term.kill();
      } catch {
        // pty already exited; nothing to kill.
      }
    };

    // pty -> WS: forward the raw byte stream verbatim.
    term.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    // pty exits (claude quit or spawned-then-died, e.g. ENOENT): close the WS so
    // the client shows the session ended / falls back.
    term.onExit(() => {
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });

    // WS -> pty: a JSON {type:'resize',cols,rows} frame resizes; every other frame
    // is raw input written straight to the pty.
    ws.on('message', (data) => {
      const text = data.toString();
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.type === 'resize') {
          term.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON: treat as raw keystrokes.
      }
      term.write(text);
    });

    // WS drops (drawer closed, crash, network): kill the pty.
    ws.on('close', teardown);
    ws.on('error', teardown);
  });
}
