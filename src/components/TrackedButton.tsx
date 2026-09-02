// Drop-in <button> that fires a Faro RUM event (kind=event in Loki, tied to
// the session) before delegating to onClick. Use it for buttons whose click
// IS the business action (clone, copy, share…). For flows where the outcome
// is conditional (async success/failure), call trackEvent from the success
// path instead — see FilterForm.onExport. For confirm-modal flows, pass
// `track` to ConfirmDeleteModal so the CONFIRM click is what's tracked.

import type { ButtonHTMLAttributes, TargetedMouseEvent } from 'preact'

import { trackEvent, type TrackName } from '../otel-web/track'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    track: TrackName
    trackAttrs?: Record<string, string>
}

export default function TrackedButton({ track, trackAttrs, onClick, ...rest }: Props) {
    function handleClick(event: TargetedMouseEvent<HTMLButtonElement>) {
        trackEvent(track, trackAttrs)
        if (typeof onClick === 'function') onClick(event)
    }

    return <button {...rest} onClick={handleClick} />
}
