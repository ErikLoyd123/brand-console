import { useCallback, useEffect, useRef } from 'react'
import {
  isKnownDownstream,
  type DownstreamFrame,
  type UpstreamMessage,
} from './skill-protocol'

// WebSocket transport for a skill surface, modelled on the lifecycle proven in
// TerminalDrawer.tsx but carrying JSON protocol frames instead of a PTY byte
// stream. It owns the socket, parses/dispatches inbound frames (dropping unknown
// ones), exposes send helpers, and always sends `abort` before closing so the
// engine tears its ephemeral session down promptly.
// Design: 03-skill-surface-component.md "Transport client".
export function useSkillSession(opts: {
  skillName: string
  onMessage: (msg: DownstreamFrame) => void
}) {
  const wsRef = useRef<WebSocket | null>(null)
  const convoRef = useRef<string | null>(null)
  // True once the conversation reached a terminal state (result, user abort, or a
  // surfaced error) so an expected socket close doesn't fire a spurious failure.
  const settledRef = useRef(false)
  // Keep the latest onMessage without re-opening the socket when it changes.
  const onMessageRef = useRef(opts.onMessage)
  useEffect(() => {
    onMessageRef.current = opts.onMessage
  }, [opts.onMessage])

  const open = useCallback(
    (initialInput?: string) => {
      // Guard against a double-open; close any prior socket first.
      settledRef.current = true // prior socket's close is expected
      wsRef.current?.close()
      settledRef.current = false
      convoRef.current = null
      const ws = new WebSocket(`ws://${location.host}/api/skill-surface`)
      wsRef.current = ws

      // `start` is the one frame with no conversationId yet (per 01-protocol): it
      // both opens the session and seeds it. The engine mints the id and returns
      // it on `ready`.
      ws.onopen = () =>
        ws.send(JSON.stringify({ type: 'start', skillName: opts.skillName, initialInput }))

      ws.onmessage = (e) => {
        let msg: unknown
        try {
          msg = JSON.parse(typeof e.data === 'string' ? e.data : '')
        } catch {
          return // non-JSON frame — drop
        }
        if (!isKnownDownstream(msg)) {
          // Forward-compat: an unrecognized type is logged and ignored, never fatal.
          console.debug('[skill-surface] dropping unknown frame', msg)
          return
        }
        if ('conversationId' in msg && msg.conversationId) convoRef.current = msg.conversationId
        if (msg.type === 'result' || msg.type === 'error') settledRef.current = true
        onMessageRef.current(msg)
      }

      ws.onerror = () => {
        if (settledRef.current) return
        settledRef.current = true
        onMessageRef.current({
          type: 'error',
          conversationId: convoRef.current ?? '',
          message: 'Connection to the skill engine failed.',
          kind: 'unreachable',
        })
      }

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null
        // An unexpected close mid-run (engine restarted, network dropped) must not
        // leave the surface spinning forever — surface it so the host falls back.
        if (settledRef.current) return
        settledRef.current = true
        onMessageRef.current({
          type: 'error',
          conversationId: convoRef.current ?? '',
          message: 'The session ended unexpectedly.',
          kind: 'died_midrun',
        })
      }
    },
    [opts.skillName],
  )

  const rawSend = useCallback((msg: UpstreamMessage) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  const sendChoice = useCallback(
    (id: string, selected: string[]) =>
      rawSend({ type: 'choice', conversationId: convoRef.current ?? '', id, selected }),
    [rawSend],
  )

  const sendText = useCallback(
    (id: string, value: string) =>
      rawSend({ type: 'text', conversationId: convoRef.current ?? '', id, value }),
    [rawSend],
  )

  const abort = useCallback(
    (reason?: string) => {
      settledRef.current = true // user-initiated close is expected
      rawSend({ type: 'abort', conversationId: convoRef.current ?? undefined, reason })
      wsRef.current?.close()
      wsRef.current = null
    },
    [rawSend],
  )

  // Cleanup on unmount: abort + close so the engine doesn't leak a session.
  useEffect(() => () => abort('unmount'), [abort])

  return { open, sendChoice, sendText, abort }
}
