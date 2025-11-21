"use client"
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function isLikelyDesktopClient(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const mobileRegex = /(Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini)/i
  const tabletRegex = /(iPad|Tablet|Nexus 7|Nexus 10|KFAPWI|Silk)/i
  const isMobileUa = mobileRegex.test(ua) || tabletRegex.test(ua)
  const wideEnough = Math.max(window.innerWidth, window.screen.width) >= 1024
  return !isMobileUa && wideEnough
}

function UnsupportedDeviceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/dashboard'
  useEffect(() => {
    const checkAndRedirect = () => {
      if (isLikelyDesktopClient()) {
        router.replace(from)
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
  }, [from, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3FD8D4] via-white to-[#DDEE59] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-[#FF8500] bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#FF8500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6m6 6V6" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Desktop-Only Access</h1>
        <p className="text-[#757575] mb-6">
          Demi keamanan data, akurasi input, dan review yang nyaman,
          halaman admin hanya dapat dibuka dari perangkat desktop
          (layar lebar, keyboard, dan pointer yang presisi).
        </p>
        <div className="text-sm text-gray-600 space-y-2">
          <p>Kebijakan: Device-Based Access Restriction</p>
          <p>Alasan: kebutuhan keamanan dan akurasi pada proses operasional admin.</p>
          <p className="text-gray-500">Jika Anda beralih ke mode desktop atau menggunakan PC/laptop, halaman akan otomatis memuat kembali.</p>
        </div>
      </div>
    </div>
  )
}

function UnsupportedDeviceFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3FD8D4] via-white to-[#DDEE59] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Memuat…</h1>
        <p className="text-[#757575]">Mengecek perangkat Anda.</p>
      </div>
    </div>
  )
}

export default function UnsupportedDevice() {
  return (
    <Suspense fallback={<UnsupportedDeviceFallback />}>
      <UnsupportedDeviceContent />
    </Suspense>
  )
}
