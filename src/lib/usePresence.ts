'use client'

import { useEffect, useRef } from 'react'

/**
 * Drives `profiles.status` ('online' | 'offline') from real client lifecycle
 * events. All writes go through `/api/presence` which uses the service-role
 * key, so RLS never blocks a presence ping.
 *
 *   - Mount                  -> 'online'
 *   - Tab hidden             -> 'offline'
 *   - Tab visible            -> 'online'
 *   - Page hide / unload     -> 'offline' (sendBeacon, survives navigation)
 *   - Hook unmount (logout)  -> 'offline'
 */
export function usePresence(userId: string | undefined) {
  const lastWriteRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const send = (status: 'online' | 'offline') => {
      // Avoid spamming UPDATEs when the value hasn't actually changed.
      if (lastWriteRef.current === status) return Promise.resolve()
      lastWriteRef.current = status
      return fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
        // keepalive lets the request survive the page unload event.
        keepalive: true,
      }).catch(() => {
        // If a request fails, allow the next call to retry by clearing the
        // dedupe latch.
        lastWriteRef.current = null
      })
    }

    // sendBeacon is the only request type guaranteed to fire on tab close.
    const beacon = (status: 'offline') => {
      try {
        const body = new Blob([JSON.stringify({ userId, status })], {
          type: 'application/json',
        })
        if (navigator.sendBeacon) navigator.sendBeacon('/api/presence', body)
      } catch {
        /* ignore */
      }
    }

    send('online')

    const onVisibility = () => {
      if (document.visibilityState === 'visible') send('online')
      else send('offline')
    }
    const onPageHide = () => {
      lastWriteRef.current = 'offline'
      beacon('offline')
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
      // Mark offline on graceful unmount (logout, route change, etc.).
      // keepalive ensures it lands even if the layout unmount is racy.
      send('offline')
    }
  }, [userId])
}
