import { useEffect, useMemo, useState } from 'preact/hooks'

interface ByDay {
    day: number
    n: number
}
interface TopItem {
    shortname: string
    filters: number
}
interface TopBox {
    boxImagePath: string
    n: number
}
interface TopOrg {
    id: string
    name: string
    members: number
}
interface TopUserFilters {
    id: string
    username: string
    filters: number
}
interface TopUserCategories {
    id: string
    username: string
    categories: number
}
interface RecentUser {
    id: string
    username: string
    email: string | null
    orgRole: string | null
    createdAt: number
    lastSeenAt: number | null
}
interface RecentlyActiveUser {
    id: string
    username: string
    lastSeenAt: number | null
}
interface EventCount {
    type: string
    n: number
}
interface RecentEvent {
    id: number
    userId: string | null
    username: string | null
    type: string
    targetId: string | null
    metadata: string | null
    createdAt: number
}

interface Stats {
    generatedAt: number
    users: {
        total: number
        newToday: number
        newWeek: number
        newMonth: number
        dau: number
        wau: number
        mau: number
        withOrg: number
        withoutOrg: number
        withEmail: number
        registrationsByDay: ByDay[]
        recent: RecentUser[]
        recentlyActive: RecentlyActiveUser[]
        topByFilters: TopUserFilters[]
        topByCategories: TopUserCategories[]
    }
    orgs: { total: number; top: TopOrg[] }
    content: {
        categories: number
        subcategories: number
        filters: number
        openCores: number
        filterItems: number
        filtersNewWeek: number
        filtersEditedWeek: number
        filtersByDay: ByDay[]
        avgItemsPerFilter: number
        maxItemsInOneFilter: number
        filtersAtCap: number
        deployment: { boxes: number; conveyors: number; storage: number }
        shared: { filters: number; categories: number; openCores: number }
        topItems: TopItem[]
        topBoxes: TopBox[]
    }
    events: {
        total: number
        countsWeek: EventCount[]
        countsMonth: EventCount[]
        recent: RecentEvent[]
    }
}

function fmt(n: number): string {
    return new Intl.NumberFormat('en').format(n)
}

function relTime(ms: number | null | undefined): string {
    if (!ms) return '—'
    const diff = Date.now() - ms
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    const days = Math.floor(diff / 86_400_000)
    if (days < 30) return `${days}d ago`
    return new Date(ms).toLocaleDateString()
}

function dateLabel(dayBucket: number): string {
    const d = new Date(dayBucket * 86_400_000)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function InfoDot({ tip }: { tip: string }) {
    // Tailwind 'group-hover' on the parent reveals the bubble. Plain CSS, no
    // portal/positioning lib — the absolute child anchors to the card.
    return (
        <span
            class="relative ml-2 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-600 text-[9px] font-bold text-slate-400 hover:border-teal-400 hover:text-teal-300"
            tabIndex={0}
            aria-label="What is this?"
        >
            ?
            <span class="pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden w-64 -translate-x-1/2 rounded border border-slate-700 bg-slate-950/95 p-2 text-[11px] leading-snug whitespace-normal text-slate-200 shadow-lg group-hover:block peer-focus:block">
                {tip}
            </span>
        </span>
    )
}

function Card({
    title,
    tip,
    children,
}: {
    title: string
    tip?: string
    children: preact.ComponentChildren
}) {
    return (
        <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h3 class="group mb-3 flex items-center text-xs font-semibold tracking-wider text-slate-400 uppercase">
                <span>{title}</span>
                {tip ? <InfoDot tip={tip} /> : null}
            </h3>
            {children}
        </section>
    )
}

function Stat({
    label,
    value,
    hint,
    tip,
}: {
    label: string
    value: string | number
    hint?: string
    tip?: string
}) {
    return (
        <div
            class="rounded border border-slate-800 bg-slate-900/60 px-3 py-2"
            title={tip}
        >
            <div class="flex items-center text-[10px] tracking-wider text-slate-500 uppercase">
                <span>{label}</span>
                {tip ? (
                    <span
                        class="ml-1 cursor-help text-slate-600 hover:text-slate-300"
                        aria-label={tip}
                    >
                        ⓘ
                    </span>
                ) : null}
            </div>
            <div class="text-xl font-semibold text-slate-100">
                {typeof value === 'number' ? fmt(value) : value}
            </div>
            {hint ? <div class="mt-0.5 text-[10px] text-slate-500">{hint}</div> : null}
        </div>
    )
}

// Tiny bar chart for daily counts — pure SVG, no deps.
function DailyBars({ data, days = 30 }: { data: ByDay[]; days?: number }) {
    const today = Math.floor(Date.now() / 86_400_000)
    const series = useMemo(() => {
        const map = new Map(data.map((d) => [d.day, d.n]))
        const out: ByDay[] = []
        for (let i = days - 1; i >= 0; i--) {
            const day = today - i
            out.push({ day, n: map.get(day) ?? 0 })
        }
        return out
    }, [data, days, today])
    const max = Math.max(1, ...series.map((s) => s.n))
    const W = 600
    const H = 80
    const bw = W / series.length
    return (
        <div class="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H + 18}`} class="h-24 w-full min-w-[280px]">
                {series.map((s, i) => {
                    const h = (s.n / max) * H
                    return (
                        <g key={s.day}>
                            <rect
                                x={i * bw + 1}
                                y={H - h}
                                width={Math.max(bw - 2, 1)}
                                height={h}
                                fill="#2dd4bf"
                                opacity={s.n === 0 ? 0.15 : 0.85}
                            >
                                <title>{`${dateLabel(s.day)} — ${s.n}`}</title>
                            </rect>
                        </g>
                    )
                })}
                <text x="2" y={H + 14} fill="#64748b" font-size="10">
                    {dateLabel(series[0].day)}
                </text>
                <text
                    x={W - 2}
                    y={H + 14}
                    fill="#64748b"
                    font-size="10"
                    text-anchor="end"
                >
                    {dateLabel(series[series.length - 1].day)}
                </text>
            </svg>
        </div>
    )
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/stats')
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }
            const data = (await res.json()) as Stats
            setStats(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
    }, [])

    if (loading && !stats) {
        return <div class="text-sm text-slate-400">Loading metrics…</div>
    }
    if (error) {
        return (
            <div class="rounded border border-rose-900/50 bg-rose-950/30 p-3 text-sm text-rose-300">
                Failed to load: {error}
            </div>
        )
    }
    if (!stats) return null

    const s = stats
    return (
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <p class="text-xs text-slate-500">
                    Generated {relTime(s.generatedAt)} · last 30 days where shown
                </p>
                <button
                    type="button"
                    onClick={() => void load()}
                    class="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                >
                    Refresh
                </button>
            </div>

            {/* ------- Users ------- */}
            <Card
                title="Users"
                tip="Registered accounts and activity metrics. last_seen_at is bumped on every authenticated request (throttled to 60s), so any interaction counts — not just logins."
            >
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Total" value={s.users.total} />
                    <Stat
                        label="DAU (24h)"
                        value={s.users.dau}
                        tip="Daily Active Users — unique users seen in the last 24h."
                    />
                    <Stat
                        label="WAU (7d)"
                        value={s.users.wau}
                        tip="Weekly Active Users — unique users seen in the last 7 days."
                    />
                    <Stat
                        label="MAU (30d)"
                        value={s.users.mau}
                        tip="Monthly Active Users — unique users seen in the last 30 days. The DAU/MAU ratio is the 'stickiness' indicator (>0.2 is healthy for an occasional-use tool)."
                    />
                    <Stat label="New today" value={s.users.newToday} />
                    <Stat label="New this week" value={s.users.newWeek} />
                    <Stat label="New this month" value={s.users.newMonth} />
                    <Stat
                        label="In a clan"
                        value={s.users.withOrg}
                        hint={`${s.users.withoutOrg} without`}
                        tip="Users with org_id != NULL. The rest operate in their personal space."
                    />
                </div>
                <div class="mt-4">
                    <div class="mb-1 text-[11px] text-slate-500">
                        Registrations · last 30 days
                    </div>
                    <DailyBars data={s.users.registrationsByDay} />
                </div>
            </Card>

            {/* ------- Content ------- */}
            <Card
                title="Content"
                tip="Aggregate counts of the user-generated tree (categories → subcategories → filters → items), plus recent growth and edits. 'Edited' is computed as updated_at > created_at."
            >
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Categories" value={s.content.categories} />
                    <Stat label="Subcategories" value={s.content.subcategories} />
                    <Stat label="Filters" value={s.content.filters} />
                    <Stat label="Open Cores" value={s.content.openCores} />
                    <Stat label="Filter items" value={s.content.filterItems} />
                    <Stat
                        label="Avg items/filter"
                        value={s.content.avgItemsPerFilter.toFixed(1)}
                        hint={`max ${fmt(s.content.maxItemsInOneFilter)}`}
                        tip="Mean number of slots used per filter. The game caps this at 30."
                    />
                    <Stat
                        label="Filters at cap (30)"
                        value={s.content.filtersAtCap}
                        tip="Filters that have hit the 30-item limit. Signals users bumping into the ceiling."
                    />
                    <Stat
                        label="New / edited (7d)"
                        value={`${fmt(s.content.filtersNewWeek)} / ${fmt(s.content.filtersEditedWeek)}`}
                        tip="Filters created / filters with updated_at > created_at in the last 7 days."
                    />
                </div>
                <div class="mt-4">
                    <div class="mb-1 text-[11px] text-slate-500">
                        Filters created · last 30 days
                    </div>
                    <DailyBars data={s.content.filtersByDay} />
                </div>
            </Card>

            {/* ------- Deployment & shared ------- */}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card
                    title="Deployment totals (game-side)"
                    tip="Sum of the box_count / conveyor_count / storage_adaptor_count each filter declares. Approximates how much industrial infrastructure your user base is planning."
                >
                    <div class="grid grid-cols-3 gap-2">
                        <Stat label="Boxes" value={s.content.deployment.boxes} />
                        <Stat label="Conveyors" value={s.content.deployment.conveyors} />
                        <Stat
                            label="Storage adaptors"
                            value={s.content.deployment.storage}
                        />
                    </div>
                </Card>
                <Card
                    title="Shared with clan"
                    tip="Rows with shared_with_org = 1 — visible to other members of the same clan. Useful to gauge how much content is collaborative vs. private."
                >
                    <div class="grid grid-cols-3 gap-2">
                        <Stat label="Filters" value={s.content.shared.filters} />
                        <Stat label="Categories" value={s.content.shared.categories} />
                        <Stat label="Open Cores" value={s.content.shared.openCores} />
                    </div>
                </Card>
            </div>

            {/* ------- Clans ------- */}
            <Card
                title="Clans"
                tip="Organisations created + top 10 by member count. 'Avg members' ignores users without a clan."
            >
                <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat label="Total clans" value={s.orgs.total} />
                    <Stat
                        label="Avg members"
                        value={
                            s.orgs.total
                                ? (s.users.withOrg / s.orgs.total).toFixed(1)
                                : '0'
                        }
                        tip="Average members per clan (only counts users with an org_id)."
                    />
                </div>
                {s.orgs.top.length ? (
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-[10px] tracking-wider text-slate-500 uppercase">
                                <th class="py-1">Clan</th>
                                <th class="py-1 text-right">Members</th>
                            </tr>
                        </thead>
                        <tbody>
                            {s.orgs.top.map((o) => (
                                <tr key={o.id} class="border-t border-slate-800/60">
                                    <td class="py-1 text-slate-200">{o.name}</td>
                                    <td class="py-1 text-right text-slate-300">{fmt(o.members)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p class="text-sm text-slate-500">No clans yet.</p>
                )}
            </Card>

            {/* ------- Top items / boxes ------- */}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card
                    title="Top items (by # filters using them)"
                    tip="Items that appear in the most distinct filters (each filter counts once, not per slot). Good signal of which resources the user base cares about."
                >
                    {s.content.topItems.length ? (
                        <ol class="space-y-1 text-sm">
                            {s.content.topItems.map((it, i) => (
                                <li
                                    key={it.shortname}
                                    class="flex items-center gap-2 border-b border-slate-800/40 py-1 last:border-0"
                                >
                                    <span class="w-5 text-right text-xs text-slate-500">
                                        {i + 1}.
                                    </span>
                                    <img
                                        src={`/items/tiny/${it.shortname}.webp`}
                                        alt=""
                                        loading="lazy"
                                        class="h-6 w-6 rounded bg-slate-800/40"
                                        onError={(e) => {
                                            ;(e.currentTarget as HTMLImageElement).style.visibility =
                                                'hidden'
                                        }}
                                    />
                                    <span class="flex-1 truncate text-slate-200">
                                        {it.shortname}
                                    </span>
                                    <span class="text-xs text-slate-400">
                                        {fmt(it.filters)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p class="text-sm text-slate-500">No items yet.</p>
                    )}
                </Card>
                <Card
                    title="Top boxes"
                    tip="Storage boxes most often picked when designing filters (the image users associate with each filter). Reflects which containers people prefer for their presets."
                >
                    {s.content.topBoxes.length ? (
                        <ol class="space-y-1 text-sm">
                            {s.content.topBoxes.map((b, i) => (
                                <li
                                    key={b.boxImagePath}
                                    class="flex items-center gap-2 border-b border-slate-800/40 py-1 last:border-0"
                                >
                                    <span class="w-5 text-right text-xs text-slate-500">
                                        {i + 1}.
                                    </span>
                                    <img
                                        src={`/boxes/${b.boxImagePath}.webp`}
                                        alt=""
                                        loading="lazy"
                                        class="h-6 w-6 rounded bg-slate-800/40 object-contain"
                                        onError={(e) => {
                                            ;(e.currentTarget as HTMLImageElement).style.visibility =
                                                'hidden'
                                        }}
                                    />
                                    <span class="flex-1 truncate text-slate-200">
                                        {b.boxImagePath}
                                    </span>
                                    <span class="text-xs text-slate-400">{fmt(b.n)}</span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p class="text-sm text-slate-500">No boxes yet.</p>
                    )}
                </Card>
            </div>

            {/* ------- Top users ------- */}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card
                    title="Top users — by filters"
                    tip="Users with the most filters created. Includes private filters (not only the ones shared to the clan)."
                >
                    {s.users.topByFilters.length ? (
                        <table class="w-full text-sm">
                            <tbody>
                                {s.users.topByFilters.map((u) => (
                                    <tr key={u.id} class="border-t border-slate-800/60">
                                        <td class="py-1 text-slate-200">{u.username}</td>
                                        <td class="py-1 text-right text-slate-300">
                                            {fmt(u.filters)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p class="text-sm text-slate-500">—</p>
                    )}
                </Card>
                <Card
                    title="Top users — by categories"
                    tip="Users with the most categories (the roots of the tree). Indicates who organises their content into the most groups."
                >
                    {s.users.topByCategories.length ? (
                        <table class="w-full text-sm">
                            <tbody>
                                {s.users.topByCategories.map((u) => (
                                    <tr key={u.id} class="border-t border-slate-800/60">
                                        <td class="py-1 text-slate-200">{u.username}</td>
                                        <td class="py-1 text-right text-slate-300">
                                            {fmt(u.categories)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p class="text-sm text-slate-500">—</p>
                    )}
                </Card>
            </div>

            {/* ------- Recent users ------- */}
            <Card
                title="Newest users (last 20)"
                tip="Last 20 registered accounts (ordered by created_at DESC). Email shows only if the user provided one at registration."
            >
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-left text-[10px] tracking-wider text-slate-500 uppercase">
                            <th class="py-1">User</th>
                            <th class="py-1">Email</th>
                            <th class="py-1">Clan role</th>
                            <th class="py-1">Joined</th>
                            <th class="py-1">Last seen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {s.users.recent.map((u) => (
                            <tr key={u.id} class="border-t border-slate-800/60">
                                <td class="py-1 text-slate-200">{u.username}</td>
                                <td class="py-1 text-slate-400">{u.email ?? '—'}</td>
                                <td class="py-1 text-slate-400">{u.orgRole ?? '—'}</td>
                                <td class="py-1 text-slate-400">{relTime(u.createdAt)}</td>
                                <td class="py-1 text-slate-400">{relTime(u.lastSeenAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            {/* ------- Recently active ------- */}
            <Card
                title="Recently active users"
                tip="Top 10 by last_seen_at descending. Every authenticated request bumps the timestamp (throttled to 60s), so this shows who is using the app right now."
            >
                {s.users.recentlyActive.length ? (
                    <ol class="space-y-1 text-sm">
                        {s.users.recentlyActive.map((u) => (
                            <li
                                key={u.id}
                                class="flex items-center justify-between border-b border-slate-800/40 py-1 last:border-0"
                            >
                                <span class="text-slate-200">{u.username}</span>
                                <span class="text-xs text-slate-400">{relTime(u.lastSeenAt)}</span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p class="text-sm text-slate-500">No activity yet.</p>
                )}
            </Card>

            {/* ------- Events ------- */}
            <Card
                title={`Events · ${fmt(s.events.total)} total`}
                tip="Usage event log (registrations, logins, clones, JSON exports, shared-content views, filter create/delete…). Grouped by type across the two time windows."
            >
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <div class="mb-1 text-[11px] text-slate-500">Last 7 days</div>
                        {s.events.countsWeek.length ? (
                            <table class="w-full text-sm">
                                <tbody>
                                    {s.events.countsWeek.map((c) => (
                                        <tr
                                            key={c.type}
                                            class="border-t border-slate-800/60"
                                        >
                                            <td class="py-1 font-mono text-xs text-slate-300">
                                                {c.type}
                                            </td>
                                            <td class="py-1 text-right text-slate-300">
                                                {fmt(c.n)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p class="text-sm text-slate-500">No events.</p>
                        )}
                    </div>
                    <div>
                        <div class="mb-1 text-[11px] text-slate-500">Last 30 days</div>
                        {s.events.countsMonth.length ? (
                            <table class="w-full text-sm">
                                <tbody>
                                    {s.events.countsMonth.map((c) => (
                                        <tr
                                            key={c.type}
                                            class="border-t border-slate-800/60"
                                        >
                                            <td class="py-1 font-mono text-xs text-slate-300">
                                                {c.type}
                                            </td>
                                            <td class="py-1 text-right text-slate-300">
                                                {fmt(c.n)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p class="text-sm text-slate-500">No events.</p>
                        )}
                    </div>
                </div>
            </Card>

            <Card
                title="Recent events (last 50)"
                tip="Chronological stream of the latest events. Metadata is a small JSON blob each emitter writes (e.g. itemCount on filter_export_json, ownerId on category_clone)."
            >
                {s.events.recent.length ? (
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-left text-[10px] tracking-wider text-slate-500 uppercase">
                                    <th class="py-1">When</th>
                                    <th class="py-1">Type</th>
                                    <th class="py-1">User</th>
                                    <th class="py-1">Target</th>
                                    <th class="py-1">Metadata</th>
                                </tr>
                            </thead>
                            <tbody>
                                {s.events.recent.map((e) => (
                                    <tr key={e.id} class="border-t border-slate-800/60">
                                        <td class="py-1 whitespace-nowrap text-slate-400">
                                            {relTime(e.createdAt)}
                                        </td>
                                        <td class="py-1 font-mono text-xs text-slate-300">
                                            {e.type}
                                        </td>
                                        <td class="py-1 text-slate-300">
                                            {e.username ?? '—'}
                                        </td>
                                        <td class="py-1 font-mono text-xs text-slate-500">
                                            {e.targetId ?? '—'}
                                        </td>
                                        <td class="py-1 font-mono text-[10px] text-slate-500">
                                            {e.metadata ?? ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p class="text-sm text-slate-500">No events yet.</p>
                )}
            </Card>
        </div>
    )
}
