import { Google } from 'arctic'

import { serverEnv } from './env/server'

export const google = new Google(
    serverEnv.GOOGLE_CLIENT_ID,
    serverEnv.GOOGLE_CLIENT_SECRET,
    serverEnv.GOOGLE_REDIRECT_URI,
)
