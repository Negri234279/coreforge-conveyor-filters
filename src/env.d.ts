/// <reference types="astro/client" />

import type { DbUser } from './db/schema'

export type SafeUser = Pick<DbUser, 'id' | 'username' | 'email' | 'orgId' | 'orgRole'> & {
    isAdmin: boolean
}

declare global {
    namespace App {
        interface Locals {
            user: SafeUser | null
        }
    }
}

declare module '*.sql?raw' {
    const content: string
    export default content
}
