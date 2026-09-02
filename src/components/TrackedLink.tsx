// Drop-in <a> that fires a Faro RUM event before the navigation. Only for
// links inside Preact islands whose click carries business meaning beyond the
// resulting page view (Faro already tracks page views/navigations on its
// own — plain internal navigation does NOT need this). Static links in
// .astro markup can't use this wrapper; use window.__cfTrack from an inline
// script there (see the landing CTA tracker in index.astro).

import type { AnchorHTMLAttributes, TargetedMouseEvent } from 'preact'

import { trackEvent, type TrackName } from '../otel-web/track'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
    track: TrackName
    trackAttrs?: Record<string, string>
}

export default function TrackedLink({ track, trackAttrs, onClick, ...rest }: Props) {
    function handleClick(event: TargetedMouseEvent<HTMLAnchorElement>) {
        trackEvent(track, trackAttrs)
        if (typeof onClick === 'function') onClick(event)
    }

    return <a {...rest} onClick={handleClick} />
}
