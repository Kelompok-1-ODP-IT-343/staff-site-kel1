"use client"
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

function isMobileUa(ua: string): boolean {
  const mobileRegex = /(Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini)/i
  const tabletRegex = /(iPad|Tablet|Nexus 7|Nexus 10|KFAPWI|Silk)/i
  return mobileRegex.test(ua) || tabletRegex.test(ua)
}

export default function DeviceGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/unsupported-device')) return

    const checkAndRedirect = () => {
      const ua = navigator.userAgent
      const width = Math.max(window.innerWidth, window.screen?.width || 0)
      const isMobile = isMobileUa(ua) || width < 1024
      if (isMobile) {
        const from = encodeURIComponent(pathname)
        router.replace(`/unsupported-device?from=${from}`)
      }
    }

    checkAndRedirect()
    const onResize = () => checkAndRedirect()
    const onOrientation = () => checkAndRedirect()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientation)
    const interval = setInterval(checkAndRedirect, 1500)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientation)
      clearInterval(interval)
    }
  }, [pathname, router])

  return null
}

