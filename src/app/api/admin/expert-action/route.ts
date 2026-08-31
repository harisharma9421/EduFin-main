import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS completely
)

export async function POST(req: Request) {
  try {
    const { action, expertId, reason } = await req.json()

    if (!expertId) {
      return NextResponse.json({ error: 'Expert ID required' }, { status: 400 })
    }

    let result;

    if (action === 'approve') {
      result = await supabase.from('profiles').update({ kyc_status: 'verified', kyc_rejection_reason: null }).eq('id', expertId)
    } else if (action === 'reject') {
      result = await supabase.from('profiles').update({ kyc_status: 'rejected', kyc_rejection_reason: reason }).eq('id', expertId)
    } else if (action === 'delete') {
      result = await supabase.from('profiles').delete().eq('id', expertId)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (result.error) throw result.error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
