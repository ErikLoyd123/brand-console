import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { PageHeader, SectionHeading, StatTile } from '../components/kit'
import { PipelineFlow } from '../components/PipelineFlow'
import { PillarBadge } from '../components/PillarBadge'
import { TagBadge } from '../components/TagBadge'
import { ArrowRight } from 'lucide-react'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function OverviewView({
  onNavigate,
  counts,
}: {
  onNavigate: (key: string) => void
  counts?: Record<string, number>
}) {
  const { data, loading, error } = useResource(() => api.getOverview())
  // Owner display name comes from the loaded profile (identity.yaml), never hardcoded.
  // Degrades to a bare greeting when the profile has no name or hasn't loaded yet.
  const { data: profile } = useResource(() => api.getProfile())
  const title = profile?.name ? `${greeting()}, ${profile.name}` : greeting()

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-20 skeleton rounded-lg" />
        <div className="h-32 skeleton rounded-lg" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Content engine" title={title} />
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load the overview. {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  // Prefer real list-endpoint counts for the pipeline. Both the prop counts and
  // data.funnel are real, so they can differ only by freshness, never fabrication.
  const funnel = counts
    ? data.funnel.map((s) => ({ ...s, count: counts[s.key] ?? s.count }))
    : data.funnel
  const stageCount = (key: string) => funnel.find((s) => s.key === key)?.count ?? 0

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="Content engine"
          title={title}
          description="Here's what the agents surfaced and where every idea sits in the pipeline. Nothing publishes without you."
        />
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
        <PipelineFlow stages={funnel} onNavigate={onNavigate} />
      </div>

      <div className="grid animate-fade-up grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: '120ms' }}>
        <StatTile label="In queue" value={stageCount('queue')} />
        <StatTile label="Published" value={stageCount('published')} />
        <StatTile
          label="Review pass rate"
          value={data.reviewPassRate}
          unit="%"
          hint="Share of reviewed drafts that passed the voice gate (passed or edited), all time. 0 until something has been reviewed."
        />
        <StatTile
          label="Cadence"
          value={data.cadencePerWeek}
          unit="/ wk"
          hint="Average posts published per week over the trailing 8 weeks."
        />
      </div>

      <div className="grid animate-fade-up gap-6 lg:grid-cols-2" style={{ animationDelay: '180ms' }}>
        <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm">
          <SectionHeading
            title="Needs your take"
            action={
              <button
                type="button"
                onClick={() => onNavigate('queue')}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:text-primary-hover"
              >
                Open queue <ArrowRight className="size-3.5" />
              </button>
            }
          />
          <div className="flex flex-col divide-y divide-border">
            {data.needsTake.length === 0 && (
              <p className="py-6 text-sm text-text-muted">Nothing waiting. The queue is clear.</p>
            )}
            {data.needsTake.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate('queue')}
                className="group flex items-start gap-3 py-3 text-left outline-none"
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <p className="font-serif text-[15px] leading-snug text-text-strong group-hover:text-primary-ink">
                    {item.proposedAngle}
                  </p>
                  <div className="flex items-center gap-2">
                    <PillarBadge pillar={item.pillar} />
                    <TagBadge tag={item.tag} />
                  </div>
                </div>
                <span className="font-mono text-xs tabular-nums text-text-subtle">{item.score}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm">
          <SectionHeading
            title="Recently published"
            action={
              <button
                type="button"
                onClick={() => onNavigate('published')}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:text-primary-hover"
              >
                Archive <ArrowRight className="size-3.5" />
              </button>
            }
          />
          <div className="flex flex-col divide-y divide-border">
            {data.recent.length === 0 && (
              <p className="py-6 text-sm text-text-muted">No published posts yet.</p>
            )}
            {data.recent.map((post) => (
              <div key={post.id} className="flex items-center gap-3 py-3">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm text-text">
                    {new Date(post.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  {/* Real channel off published_posts.platform; legacy rows without one read as LinkedIn. */}
                  <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">
                    {post.platform === 'reddit' ? 'Reddit' : 'LinkedIn'}
                  </span>
                </div>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary-ink hover:text-primary-hover"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
