import { NextResponse } from 'next/server'

// This is a dummy route to silence 404 errors caused by browser extensions 
// (like Copilot/Baidu tracker extensions) that inject scripts into the page
// and try to poll this endpoint.
export async function GET(req: Request) {
  return NextResponse.json({ status: 'ok', message: 'Tracking suppressed' })
}
