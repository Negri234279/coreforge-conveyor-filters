const LS_KEY = 'cf_recent_boxes'

export function getRecentBoxes(): string[] {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
    } catch {
        return []
    }
}

export function addRecentBox(key: string): void {
    const recent = getRecentBoxes().filter((k) => k !== key)
    recent.unshift(key)
    localStorage.setItem(LS_KEY, JSON.stringify(recent))
}
