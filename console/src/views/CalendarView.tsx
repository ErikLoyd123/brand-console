import { useMemo, useState } from 'react'
import { api, type PublishedPost, type ScheduledPost } from '../lib/api'
import { useResource } from '../lib/useResource'
import { PageHeader } from '../components/kit'
import { cn } from '../lib/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarView() {
  const { data, error } = useResource(() => api.getPosts())
  const schedRes = useResource(() => api.getScheduled())
  const posts = data ?? []
  const scheduled = schedRes.data ?? []
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const postsByDay = new Map<number, PublishedPost[]>()
  for (const p of posts) {
    const d = new Date(p.publishedAt)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = postsByDay.get(d.getDate()) ?? []
      list.push(p)
      postsByDay.set(d.getDate(), list)
    }
  }

  // Real planned slots from scheduled_posts, bucketed by day of the shown month.
  const scheduledByDay = new Map<number, ScheduledPost[]>()
  for (const s of scheduled) {
    if (s.plannedFor == null) continue
    const d = new Date(s.plannedFor)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = scheduledByDay.get(d.getDate()) ?? []
      list.push(s)
      scheduledByDay.set(d.getDate(), list)
    }
  }

  const monthPosts = [...postsByDay.values()].reduce((s, l) => s + l.length, 0)
  const monthPlanned = [...scheduledByDay.values()].reduce((s, l) => s + l.length, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Calendar"
        description="Your posting cadence across the month. Published posts come from the published archive; planned slots are scheduled posts stored in the database."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="rounded-lg bg-surface p-2 text-text-muted shadow-control outline-none transition-shadow hover:shadow-control-hover"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-36 text-center font-serif text-base font-semibold text-text-heading">
              {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="rounded-lg bg-surface p-2 text-text-muted shadow-control outline-none transition-shadow hover:shadow-control-hover"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-4 font-mono text-xs tabular-nums text-text-subtle">
        <span>{monthPosts} published this month</span>
        {monthPlanned > 0 && <span>{monthPlanned} planned</span>}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> published
        </span>
        <span
          className="inline-flex cursor-help items-center gap-1.5"
          title="Planned slots come from the scheduled_posts table — stored in the database (browse it in the Database view)"
        >
          <span className="size-2 rounded-full border border-dashed border-border-strong" /> planned
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load published posts. {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-surface p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-2 text-center font-mono text-[10px] font-medium uppercase tracking-wide text-text-subtle">
              {w}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="min-h-24 rounded-md bg-surface-nested/40" />
            const dayPosts = postsByDay.get(date.getDate()) ?? []
            const dayPlanned = scheduledByDay.get(date.getDate()) ?? []
            const isToday = sameDay(date, today)
            return (
              <div
                key={i}
                className={cn(
                  'flex min-h-24 flex-col gap-1 rounded-md p-2 transition-colors',
                  isToday ? 'bg-selected-bg ring-1 ring-primary/30' : 'bg-surface-nested hover:bg-row-hover',
                )}
              >
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    isToday ? 'font-semibold text-primary-ink' : 'text-text-subtle',
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="flex flex-col gap-1">
                  {dayPosts.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 rounded bg-primary-soft px-1.5 py-0.5" title="Published">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate font-mono text-[10px] text-primary-ink">
                        {p.platform === 'reddit' ? 'Reddit' : 'LinkedIn'}
                      </span>
                    </div>
                  ))}
                  {dayPlanned.map((s) => (
                    <div
                      key={s.id}
                      className="rounded border border-dashed border-border-strong px-1.5 py-0.5"
                      title={s.title ?? 'Planned post'}
                    >
                      <span className="truncate font-mono text-[10px] text-text-subtle">
                        {s.title ?? 'planned'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
