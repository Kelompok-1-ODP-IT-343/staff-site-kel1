import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isMobileOrTablet(ua: string, secChUaMobile?: string) {
  const mobileRegex = /(Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini)/i
  const tabletRegex = /(iPad|Tablet|Nexus 7|Nexus 10|KFAPWI|Silk)/i
  const isClientHintMobile = secChUaMobile?.includes('?1')
  return mobileRegex.test(ua) || tabletRegex.test(ua) || !!isClientHintMobile
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Skip assets & API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Device-Based Access Restriction (Desktop-Only)
  const ua = req.headers.get('user-agent') || ''
  const secChUaMobile = req.headers.get('sec-ch-ua-mobile') || undefined

  if (isMobileOrTablet(ua, secChUaMobile) && !pathname.startsWith('/unsupported-device')) {
    const url = req.nextUrl.clone()
    url.pathname = '/unsupported-device'
    // keep track of original destination to return when desktop is detected
    url.searchParams.set('from', `${pathname}${search || ''}`)
    return NextResponse.redirect(url)
  }

  // Auth guard for dashboard
  const token = req.cookies.get('token')?.value
  const refreshToken = req.cookies.get('refreshToken')?.value

  if (!token && pathname.startsWith('/dashboard')) {
    if (!refreshToken) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    // allow pass-through to let client refresh token via interceptor
    return NextResponse.next()
  }

  // Already logged in, prevent visiting /login
  if (token && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|api|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js)).*)',
  ],
}

