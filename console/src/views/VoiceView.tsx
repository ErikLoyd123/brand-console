import { useState } from 'react'
import { api, type Profile } from '../lib/api'
import { useResource } from '../lib/useResource'
import { PageHeader } from '../components/kit'
import { Markdown } from '../components/Markdown'
import { PillarBadge } from '../components/PillarBadge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/input'
import { SkillSurface } from '../components/SkillSurface'
import { Pencil, Sparkles, Check, X } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/card'

// Ambient hints for the voice walk's working state (see SkillSurface.workingHints).
const EDIT_VOICE_HINTS = [
  'Reading your voice card',
  'Finding the right section',
  'Drafting the change',
  'Saving to your profile',
]

// Ambient hints while the setup interview runs (see SkillSurface.workingHints).
const SETUP_HINTS = [
  'Starting the interview',
  'Asking about your voice',
  'Distilling the voice card',
  'Filling the identity knobs',
]

// The Voice page makes the "brain" of the content engine visible: the voice card
// every drafter and reviewer reads first, plus the pillars, CTA policy, and feed
// sources it is built from. The card is editable two ways — the `voice`
// skill (AI surface up top) or the manual markdown editor floor on the card itself —
// so new rules, hooks, and patterns can be added over time without re-running setup.
//
// For an INCOMPLETE active profile (a fresh clone, or a just-created brand), this page
// doubles as the setup surface: the skill surface runs `setup` instead of `voice`, a
// checklist card shows exactly what's still missing, and the console lands here on load
// (App.tsx) — so a new user is walked into the interview without knowing any skill names.
export function VoiceView() {
  const { data: profile, loading, error, reload } = useResource(() => api.getProfile())
  const { data: profiles, reload: reloadProfiles } = useResource(() => api.getProfiles())

  const activeProfile = profiles?.find((p) => p.active) ?? null
  const needsSetup = activeProfile != null && !activeProfile.complete

  if (needsSetup) {
    return (
      <SetupSurface
        profile={activeProfile}
        onChanged={() => {
          reload()
          reloadProfiles()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inputs · Voice"
        title="Voice card"
        description="The single source of truth every draft and review reads first. Edit it with AI or by hand below."
      />

      {/* AI mode: the voice skill (add a rule/hook/pattern, refine a section, or
          refresh the card). The rendered card + its manual editor below are the permanent
          plain floor, so this surface is aiOnly (no toggle); on each step it reloads so the
          card reflects what the skill wrote. */}
      <SkillSurface
        skillName="voice"
        aiOnly
        workingHints={EDIT_VOICE_HINTS}
        resultActions={{ resetLabel: 'Edit something else' }}
        onProgress={() => reload()}
        onResult={() => reload()}
        onPlainSubmit={() => {
          /* No plain path here — the manual editor below is the floor; aiOnly never calls this. */
        }}
        fallback={({ start, disabled }) => (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-strong">Edit your voice card with AI</p>
                <p className="text-xs text-text-subtle">
                  Add a hard rule, hook formula, voice pattern, or AI-tell — or refine a section.
                  It slots the change into the right place and writes the same{' '}
                  <code className="font-mono text-[11px]">voice-card.md</code> you can edit by hand
                  below.
                </p>
              </div>
            </div>
            <Button size="sm" disabled={disabled} onClick={() => start('')}>
              Start
            </Button>
          </div>
        )}
      />

      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="h-6 w-40 skeleton rounded" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-40 skeleton rounded-lg" />
            <div className="h-40 skeleton rounded-lg" />
          </div>
          <div className="h-64 skeleton rounded-lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load your profile. {error}
        </div>
      ) : profile ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            {profile.pillars.map((p) => (
              <PillarBadge key={p.key} pillar={p.key} />
            ))}
            <a
              href="#/pillars"
              className="text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
            >
              Manage pillars →
            </a>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>CTA policy</CardTitle>
                <CardDescription>How asks show up in a post · set with the setup skill.</CardDescription>
              </CardHeader>
              <CardContent>
                {profile.ctaPolicy ? (
                  <p className="text-sm text-text-muted">{profile.ctaPolicy}</p>
                ) : (
                  <p className="text-sm text-text-subtle">No CTA policy written yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feed sources</CardTitle>
                <CardDescription>What discovery reads · stored in the database, managed on the Feeds tab.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {profile.feedSources.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {profile.feedSources.map((source) => (
                      <li key={source} className="font-mono text-xs text-text-muted">
                        {source}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-subtle">No feeds configured.</p>
                )}
                <a
                  href="#/feeds"
                  className="self-start text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
                >
                  Manage feeds →
                </a>
              </CardContent>
            </Card>
          </div>

          <VoiceCardEditor voiceCard={profile.voiceCard} onSaved={reload} />
        </div>
      ) : null}
    </div>
  )
}

// The Voice page's incomplete-profile mode: the setup on-ramp. Shows what the
// completeness check says is missing and hosts the `setup` skill surface — the guided
// interview (personal or brand, per the profile's kind) plus the identity knob-walk.
// When setup finishes, the parent's reloads flip this page back to the normal voice view.
// A profile with saved interview answers (interviewStarted) gets resume copy, not
// fresh-start copy — the interview appends to interview.md after every question, so an
// interrupted session picks up where it left off rather than starting over.
function SetupSurface({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const brand = profile.kind === 'brand'
  const resuming = profile.interviewStarted
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inputs · Voice"
        title={`Set up ${profile.name}`}
        description={
          resuming
            ? 'Setup is underway — the interview answers given so far are saved in this profile. Resuming continues from where it left off; nothing already answered is asked again.'
            : brand
              ? 'This brand profile is empty. The setup interview captures its positioning, audience, banned claims, and product naming — then distills the voice card every draft and review reads.'
              : 'This profile is empty. The setup interview captures your story, opinions, and how you talk — then distills the voice card every draft and review reads.'
        }
      />

      <SkillSurface
        skillName="setup"
        aiOnly
        workingHints={SETUP_HINTS}
        resultActions={{ resetLabel: 'Continue setup' }}
        onProgress={onChanged}
        onResult={onChanged}
        onPlainSubmit={() => {
          /* aiOnly — there is no plain path for the interview. */
        }}
        fallback={({ start, disabled }) => (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-strong">
                  {resuming ? 'Resume the setup interview' : 'Run the setup interview'}
                </p>
                <p className="text-xs text-text-subtle">
                  {resuming ? (
                    <>
                      Your answers so far are saved in{' '}
                      <code className="font-mono text-[11px]">profiles/{'<slug>'}/interview.md</code>;
                      resuming continues from the first unanswered question, then writes{' '}
                      <code className="font-mono text-[11px]">voice-card.md</code> and{' '}
                      <code className="font-mono text-[11px]">identity.yaml</code>.
                    </>
                  ) : (
                    <>
                      A guided conversation — one question at a time
                      {brand ? ', shaped for a company voice' : ''}. It writes{' '}
                      <code className="font-mono text-[11px]">profiles/{'<slug>'}/voice-card.md</code>{' '}
                      and <code className="font-mono text-[11px]">identity.yaml</code>; re-running it
                      later is safe.
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button size="sm" disabled={disabled} onClick={() => start('')}>
              {resuming ? 'Resume setup' : 'Start setup'}
            </Button>
          </div>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>What&rsquo;s still missing</CardTitle>
          <CardDescription>
            The completeness check reads this profile&rsquo;s{' '}
            <code className="font-mono text-xs">profiles/&lt;slug&gt;/</code> files; every content
            skill stays gated until this list is empty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5">
            {(profile.missing ?? []).map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
                <X className="mt-0.5 size-3.5 shrink-0 text-warning-fg" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// The voice card, in view or edit mode. View renders the markdown (today's behavior);
// Edit swaps in a raw-markdown textarea beside a live preview and a Save that PUTs
// through api.saveVoiceCard. The draft is local state seeded on entering edit mode, so
// an AI edit reloading the parent won't clobber a hand-edit in progress. Empty saves are
// rejected server-side; the message surfaces inline.
function VoiceCardEditor({ voiceCard, onSaved }: { voiceCard: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function startEdit() {
    setDraft(voiceCard ?? '')
    setErr(null)
    setSaved(false)
    setEditing(true)
  }

  async function save() {
    if (draft.trim() === '') {
      setErr('Voice card cannot be empty.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await api.saveVoiceCard(draft)
      setSaved(true)
      setEditing(false)
      onSaved()
    } catch (e) {
      // Pull the server's {"error":"..."} out of the thrown http() message.
      const s = String((e as Error)?.message ?? e)
      const m = s.match(/\{.*\}$/)
      setErr(m ? (JSON.parse(m[0]).error ?? s) : s)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Voice card</CardTitle>
          <CardDescription>
            Authored by the setup skill&rsquo;s voice interview, refined with the{' '}
            <code className="font-mono text-xs">voice</code> skill or by hand here · stored in{' '}
            <code className="font-mono text-xs">the profile's voice-card.md</code>.
          </CardDescription>
        </div>
        {!editing && voiceCard && (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">
                  Markdown
                </span>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-[32rem] resize-none font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">
                  Preview
                </span>
                <div className="h-[32rem] overflow-y-auto rounded-md bg-surface-sunken p-4">
                  {draft.trim() ? (
                    <Markdown>{draft}</Markdown>
                  ) : (
                    <p className="text-sm text-text-subtle">Nothing to preview yet.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" disabled={saving} onClick={save}>
                <Check className="size-3.5" /> {saving ? 'Saving…' : 'Save card'}
              </Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
                <X className="size-3.5" /> Cancel
              </Button>
              {err && <span className="text-xs text-error-fg">{err}</span>}
            </div>
          </div>
        ) : voiceCard ? (
          <div className="flex flex-col gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1 self-start text-xs text-success-fg">
                <Check className="size-3.5" /> Saved to the profile's voice-card.md
              </span>
            )}
            <Markdown>{voiceCard}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-text-subtle">
            Voice card not written yet. Use the AI editor above, or run the{' '}
            <code className="font-mono text-xs">setup</code> skill&rsquo;s voice interview.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
