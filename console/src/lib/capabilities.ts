import { useEffect, useState } from 'react'
import type { PlatformKey } from './api'

// The single registry of what a linked platform can do. The Connections page
// renders this per connected platform; feature surfaces (Drafts publish, the
// Published post actions) gate on the per-capability toggle. Adding a future
// platform is a data entry here and nothing else is platform-specific — the UI
// and the toggles are all driven off this table.
export interface Capability {
  key: string
  label: string
  description: string
  // Available only if the connection granted every one of these scopes.
  requiresScopes?: string[]
  // If set, the capability can never be turned on (rendered as unavailable with
  // this reason, no toggle) regardless of scopes — e.g. it needs a review-gated
  // API we can't get on a personal app.
  unavailable?: string
  // Default toggle state when the capability is available. Defaults to on.
  defaultOn?: boolean
}

export const PLATFORM_CAPABILITIES: Partial<Record<PlatformKey, Capability[]>> = {
  linkedin: [
    {
      key: 'publish',
      label: 'Publish posts',
      description: 'Post text, a link, or an image to your feed from the Drafts editor.',
      requiresScopes: ['w_member_social'],
    },
    {
      key: 'comment',
      label: 'Comment on your posts',
      description: 'Add a comment to a post you published — handy for the link-in-first-comment move.',
      requiresScopes: ['w_member_social'],
    },
    {
      key: 'like',
      label: 'Like your posts',
      description: 'React to a post you published from the console.',
      requiresScopes: ['w_member_social'],
    },
    {
      key: 'delete',
      label: 'Delete your posts',
      description: 'Remove a post you published from LinkedIn. This is irreversible.',
      requiresScopes: ['w_member_social'],
    },
  ],
  // Reddit intentionally has no capabilities: it's a manual copy-paste channel
  // with no API connection, so there's nothing to toggle on the Connections page.
}

export function getCapabilities(platform: string): Capability[] {
  return PLATFORM_CAPABILITIES[platform as PlatformKey] ?? []
}

// Whether the granted scopes satisfy a capability (unavailable ones are never available).
export function capabilityAvailable(cap: Capability, grantedScopes: string[]): boolean {
  if (cap.unavailable) return false
  return (cap.requiresScopes ?? []).every((s) => grantedScopes.includes(s))
}

const CAP_EVENT = 'console-capabilities-change'
const storageKey = (platform: string, capKey: string) => `console-cap-${platform}-${capKey}`

// The raw toggle state (localStorage). A benign UI preference, never a secret.
// An unavailable capability always reads off.
export function toggleOn(platform: string, capKey: string): boolean {
  const cap = getCapabilities(platform).find((c) => c.key === capKey)
  if (!cap || cap.unavailable) return false
  const v = localStorage.getItem(storageKey(platform, capKey))
  return v === null ? cap.defaultOn ?? true : v === '1'
}

export function setToggle(platform: string, capKey: string, on: boolean): void {
  localStorage.setItem(storageKey(platform, capKey), on ? '1' : '0')
  // Notify feature surfaces mounted elsewhere so they gate live, no reload.
  window.dispatchEvent(new CustomEvent(CAP_EVENT))
}

// Reactive read of a capability toggle, for feature surfaces (Drafts, Published)
// that must reflect a switch flipped on the Connections page without a reload.
export function useCapabilityToggle(platform: string, capKey: string): boolean {
  const [on, setOn] = useState(() => toggleOn(platform, capKey))
  useEffect(() => {
    const handler = () => setOn(toggleOn(platform, capKey))
    window.addEventListener(CAP_EVENT, handler)
    return () => window.removeEventListener(CAP_EVENT, handler)
  }, [platform, capKey])
  return on
}
