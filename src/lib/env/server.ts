type EnvMap = Record<string, string | undefined>

const importMetaEnv = import.meta.env as unknown as EnvMap

const readServerEnv = (name: string): string | undefined => {
    const runtimeValue = process.env[name]
    if (typeof runtimeValue === 'string' && runtimeValue.trim().length > 0) {
        return runtimeValue.trim()
    }

    const buildValue = importMetaEnv[name]
    if (typeof buildValue === 'string' && buildValue.trim().length > 0) {
        return buildValue.trim()
    }

    return undefined
}

const requireServerEnv = (name: string): string => {
    const value = readServerEnv(name)
    if (!value) {
        throw new Error(`[env] Missing required server env: ${name}`)
    }
    return value
}

const normalizeGoogleRedirectUri = (rawValue: string): string => {
    let parsed: URL
    try {
        parsed = new URL(rawValue)
    } catch {
        throw new Error('[env] GOOGLE_REDIRECT_URI must be an absolute URL')
    }

    // Avoid accidental trailing slash mismatch in OAuth providers.
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    }

    return parsed.toString()
}

export const serverEnv = Object.freeze({
    GOOGLE_CLIENT_ID: requireServerEnv('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: requireServerEnv('GOOGLE_CLIENT_SECRET'),
    GOOGLE_REDIRECT_URI: normalizeGoogleRedirectUri(requireServerEnv('GOOGLE_REDIRECT_URI')),
})
