import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// Service-role client so we can read/write `vault_accounts` regardless of
// any future RLS policies. Never expose the service role key to the client.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Scrypt-based password hash. Format: scrypt$N$saltHex$hashHex
const SCRYPT_COST = 16384
function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64, { N: SCRYPT_COST })
  return `scrypt$${SCRYPT_COST}$${salt.toString('hex')}$${derived.toString('hex')}`
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, costStr, saltHex, hashHex] = stored.split('$')
    if (scheme !== 'scrypt') return false
    const cost = Number(costStr)
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const derived = scryptSync(password, salt, expected.length, { N: cost })
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const { mode, userId, username, password } = await req.json()

    if (!userId || !username || !password) {
      return NextResponse.json({ error: 'userId, username, and password are required' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    if (mode === 'register') {
      // Block if a vault account already exists for this user.
      const { data: existing } = await supabase
        .from('vault_accounts')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'A vault account already exists. Use login instead.' },
          { status: 409 },
        )
      }

      const password_hash = hashPassword(password)
      const { error } = await supabase
        .from('vault_accounts')
        .insert({ user_id: userId, username: username.trim(), password_hash })

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (mode === 'login') {
      const { data, error } = await supabase
        .from('vault_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('username', username.trim())
        .maybeSingle()

      if (error) throw error
      if (!data) {
        return NextResponse.json({ error: 'No vault account found with that username.' }, { status: 401 })
      }
      if (!verifyPassword(password, data.password_hash)) {
        return NextResponse.json({ error: 'Wrong password.' }, { status: 401 })
      }
      return NextResponse.json({ success: true })
    }

    if (mode === 'check') {
      const { data } = await supabase
        .from('vault_accounts')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle()
      return NextResponse.json({ exists: !!data, username: data?.username || null })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (err: any) {
    console.error('[vault/auth] error', err)
    return NextResponse.json({ error: err?.message || 'Vault auth failed' }, { status: 500 })
  }
}
