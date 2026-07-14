import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';

// One shared WebSocket-upgrade router per http.Server. Each WS endpoint registers
// its pathname -> WebSocketServer here; a single 'upgrade' listener routes the
// socket to the matching server and destroys anything unrecognized.
//
// This exists because installing several independent `server.on('upgrade', …)`
// listeners, each guarding its own path, is buggy: a listener that `destroy()`s
// non-matching paths tears down another endpoint's socket before that endpoint's
// listener can claim it. Routing through one listener keyed on a registry avoids
// that — every path is either handled by exactly one registered server or
// destroyed once.
const registries = new WeakMap<Server, Map<string, WebSocketServer>>();

export function registerUpgrade(server: Server, pathname: string, wss: WebSocketServer): void {
  let routes = registries.get(server);
  if (!routes) {
    routes = new Map<string, WebSocketServer>();
    registries.set(server, routes);
    server.on('upgrade', (req, socket, head) => {
      const { pathname: p } = new URL(req.url ?? '', 'http://localhost');
      const target = routes!.get(p);
      if (!target) {
        socket.destroy();
        return;
      }
      target.handleUpgrade(req, socket, head, (ws) => {
        target.emit('connection', ws, req);
      });
    });
  }
  routes.set(pathname, wss);
}
