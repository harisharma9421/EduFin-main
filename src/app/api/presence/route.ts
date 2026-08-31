import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client. Bypasses RLS for the presence-only update path so
// the browser's "I'm online/offline" pings can never be silently rejected
// by row-level security.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  try {
    const { userId, status } = await req.json()

    if (!userId || (status !== 'online' && status !== 'offline')) {
      return NextResponse.json({ error: 'userId and status (online|offline) required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ status, last_seen: new Date().toISOString() })
      .eq('id', userId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
