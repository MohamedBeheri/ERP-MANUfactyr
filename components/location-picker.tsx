'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, LoaderCircle, RefreshCw } from 'lucide-react'

export interface GeoPoint { lat: number; lng: number }

// زرار تسجيل الموقع اللايف + خريطة معاينة صغيرة تتأكد بيها إن الإحداثيات صح
export function LocationPicker({ value, onChange, label = 'تسجيل موقعي الحالي' }: {
  value: GeoPoint | null
  onChange: (p: GeoPoint | null) => void
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const markerRef = useRef<any>(null)

  // نتحقق من حالة إذن الموقع فور تحميل الفورم — عشان نبين رسالة تفعيل واضحة من غير ما ننتظر المستخدم يضغط ويفشل
  useEffect(() => {
    if (!navigator.permissions?.query) return
    let status: PermissionStatus | null = null
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((s) => {
      status = s
      setBlocked(s.state === 'denied')
      s.onchange = () => setBlocked(s.state === 'denied')
    }).catch(() => {})
    return () => { if (status) status.onchange = null }
  }, [])

  const capture = () => {
    setError('')
    if (!navigator.geolocation) { setError('الجهاز/المتصفح ده مش بيدعم تحديد الموقع الجغرافي'); return }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoading(false); setBlocked(false); setError('') },
      (err) => {
        setLoading(false)
        if (err.code === err.PERMISSION_DENIED) { setBlocked(true); setError('الوصول للموقع متبلوك — فعّله من أيقونة القفل 🔒 بجانب شريط العنوان في المتصفح وجرب تاني') }
        else if (err.code === err.POSITION_UNAVAILABLE) setError('خدمة الموقع (GPS) مقفولة على الجهاز — فعّلها من إعدادات الجهاز وجرب تاني')
        else if (err.code === err.TIMEOUT) setError('استنينا كتير من غير رد — جرب في مكان مفتوح واضغط تاني')
        else setError('تعذر تحديد الموقع دلوقتي — جرب تاني')
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  useEffect(() => {
    if (!value || !mapRef.current) return
    let cancelled = false
    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return
      if (!leafletMap.current) {
        leafletMap.current = L.map(mapRef.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([value.lat, value.lng], 15)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(leafletMap.current)
      } else {
        leafletMap.current.setView([value.lat, value.lng], 15)
      }
      if (markerRef.current) markerRef.current.remove()
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#e94560;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      })
      markerRef.current = L.marker([value.lat, value.lng], { icon }).addTo(leafletMap.current)
      setTimeout(() => leafletMap.current?.invalidateSize(), 50)
    })
    return () => { cancelled = true }
  }, [value])

  useEffect(() => () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null } }, [])

  return (
    <div className="space-y-1.5">
      {blocked && !value && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 leading-relaxed">
          <p className="font-bold mb-0.5">📍 خدمة الموقع متبلوكة على المتصفح ده</p>
          <p>
            عشان نقدر نسجّل موقع العميل تلقائيًا: افتح إعدادات الموقع 🔒 بجانب شريط العنوان (أو إعدادات المتصفح ← أذونات الموقع)،
            فعّل "السماح بالوصول للموقع" لهذا الموقع، وبعدين اضغط "جرب تاني" تحت.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={capture}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition border ${value ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
      >
        {loading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
        {loading ? 'جاري تحديد موقعك...' : value ? 'الموقع مسجّل — اضغط لتحديثه بموقعك الحالي' : blocked ? 'جرب تاني بعد ما تفعّل الإذن' : label}
      </button>
      {error && (
        <p className="text-[11px] text-red-500 flex items-start gap-1">
          <span>{error}</span>
        </p>
      )}
      {value && (
        <div className="relative">
          <div ref={mapRef} className="h-32 rounded-lg overflow-hidden border border-gray-200" />
          <button
            type="button"
            onClick={capture}
            className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur p-1.5 rounded-md shadow hover:bg-white"
            title="تحديث الموقع"
            aria-label="تحديث الموقع"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  )
}

// خريطة معاينة للقراءة فقط (بدون زرار تسجيل) — لعرض موقع مسجّل مسبقًا
export function LocationPreview({ lat, lng, height = 160 }: { lat: number; lng: number; height?: number }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return
      leafletMap.current = L.map(mapRef.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([lat, lng], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(leafletMap.current)
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#e94560;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      })
      L.marker([lat, lng], { icon }).addTo(leafletMap.current)
      setTimeout(() => leafletMap.current?.invalidateSize(), 50)
    })
    return () => { cancelled = true; if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null } }
  }, [lat, lng])

  return <div ref={mapRef} style={{ height }} className="rounded-lg overflow-hidden border border-gray-200" />
}
