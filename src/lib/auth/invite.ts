// Invite codes are user-readable: uppercase Crockford-ish alphabet (no 0/O/1/I)
// + digits. 10 chars over a 32-char alphabet is ~50 bits — fine for invites.

import { customAlphabet } from 'nanoid'

export const generateInviteCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10)
