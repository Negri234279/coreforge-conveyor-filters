import { Google } from 'arctic'

export const google = new Google(
    import.meta.env.GOOGLE_CLIENT_ID ?? '',
    import.meta.env.GOOGLE_CLIENT_SECRET ?? '',
    import.meta.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/google/callback',
)
