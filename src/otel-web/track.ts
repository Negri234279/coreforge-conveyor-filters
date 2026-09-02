// Client-side event tracking → Grafana Faro (kind=event in Loki, tied to the
// RUM session). Mirrors business events that also hit /api/events/log so the
// same action is visible both in the append-only events table and in the RUM
// session timeline. Safe to call unconditionally: when RUM is disabled the
// Faro API is never initialized and this is a no-op.

import { faro } from '@grafana/faro-web-sdk'
import type { EventType } from '../lib/events'

// Business events reuse the server-side EventType taxonomy; UI-only
// interactions (modals, toggles, aborted flows) use an explicit `ui_` prefix
// so they never collide with — or pollute — the business event namespace.
export type TrackName = EventType | `ui_${string}`

export function trackEvent(name: TrackName, attributes?: Record<string, string>): void {
    try {
        faro.api?.pushEvent(name, attributes)
    } catch {
        // RUM must never break the page.
    }
}
