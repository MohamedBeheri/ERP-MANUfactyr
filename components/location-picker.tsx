'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, LoaderCircle, RefreshCw, MousePointerClick } from 'lucide-react'

export interface GeoPoint { lat: number; lng: number }

const EGYPT_CENTER: [number, number] = [26.8, 30.8]

// زرار تسجيل الموقع اللايف + خريطة معاينة صغيرة تتأكد بيها إن الإحداثيات صح
// + بديل يدوي اختياري (تحديد بالنقر على الخريطة) لو الـ GPS مش شغال لأي سبب —
// اتقفل افتراضيًا في فورم تسليم المندوب عشان الموقع لازم يفضل لايف حقيقي ومينفعش يتزوّر
export function LocationPicker({ value, onChange, label = 'تسجيل موقعي الحالي', allowManual = true }: {
  value: GeoPoint | null
  onChange: (p: GeoPoint | null) => void
  label?: string
  allowManual?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [insecure, setInsecure] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const markerRef = useRef<any>(null)

  // نتحقق من حالة إذن الموقع فور تحميل الفورم — عشان نبين رسالة تفعيل واضحة من غير ما ننتظر المستخدم يضغط ويفشل
  useEffect(() => {
    // المتصفحات (خصوصًا كروم أندرويد) بتمنع تحديد الموقع نهائيًا على أي رابط http غير آمن — لازم https أو localhost
    if (typeof window !== 'undefined' && window.isSecureContext === false) setInsecure(true)
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
    const manualHint = allowManual ? ' — استخدم التحديد اليدوي تحت' : ''
    // على http (غير localhost) الـ GPS متبلوك من المتصفح نفسه — مفيش فايدة نطلبه
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setInsecure(true)
      setError(`الموقع مبيشتغلش إلا على رابط آمن (https)${manualHint}`)
      return
    }
    if (!navigator.geolocation) { setError(`الجهاز/المتصفح ده مش بيدعم تحديد الموقع الجغرافي${manualHint}`); return }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoading(false); setBlocked(false); setError(''); setManualMode(false) },
      (err) => {
        setLoading(false)
        if (err.code === err.PERMISSION_DENIED) { setBlocked(true); setError(`الوصول للموقع مرفوض — شوف خطوات التفعيل فوق${manualHint}`) }
        else if (err.code === err.POSITION_UNAVAILABLE) setError(`تعذر تحديد الموقع تلقائيًا (مفيش إشارة GPS/واي فاي كفاية)${manualHint}`)
        else if (err.code === err.TIMEOUT) setError(`استنينا كتير من غير رد — جرب تاني${manualHint}`)
        else setError(`تعذر تحديد الموقع دلوقتي${manualHint}`)
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  // خريطة تفاعلية: تعرض الموقع الحالي، وتسمح بالنقر/السحب لتحديد نقطة يدويًا لما وضع التحديد اليدوي مفعّل
  useEffect(() => {
    if (!mapRef.current) return
    if (!value && !manualMode) return
    let cancelled = false
    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return
      const center: [number, number] = value ? [value.lat, value.lng] : EGYPT_CENTER
      if (!leafletMap.current) {
        // أزرار +/- والسحب متاحين دايمًا عشان التنقل في الخريطة يبقى سهل
        leafletMap.current = L.map(mapRef.current, {
          zoomControl: true, attributionControl: false,
          dragging: true, scrollWheelZoom: false,
        }).setView(center, value ? 15 : 6)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(leafletMap.current)
      } else {
        leafletMap.current.setView(center, value ? 15 : 6)
      }
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#e94560;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      })
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }
      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { icon, draggable: manualMode }).addTo(leafletMap.current)
        if (manualMode) markerRef.current.on('dragend', (e: any) => { const p = e.target.getLatLng(); onChange({ lat: p.lat, lng: p.lng }) })
      }
      if (manualMode) {
        leafletMap.current.off('click')
        leafletMap.current.on('click', (e: any) => { onChange({ lat: e.latlng.lat, lng: e.latlng.lng }); setError(''); setBlocked(false) })
      } else {
        leafletMap.current.off('click')
      }
      setTimeout(() => leafletMap.current?.invalidateSize(), 50)
    })
    return () => { cancelled = true }
  }, [value, manualMode])

  useEffect(() => () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null } }, [])

  const showMap = !!value || manualMode

  return (
    <div className="space-y-1.5">
      {insecure && !value && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-[11px] text-red-700 leading-relaxed space-y-1">
          <p className="font-bold">🔒 تحديد الموقع مبيشتغلش على الرابط ده</p>
          <p>المتصفح (خصوصًا كروم على الأندرويد) بيمنع تحديد الموقع نهائيًا على أي رابط <b>http</b> غير آمن. لازم تفتح النظام من رابط <b>https</b> (زي الرابط الرسمي على الإنترنت) عشان الموقع يشتغل — مش من عنوان زي 192.168 أو localhost على الموبايل.</p>
          {allowManual && <p>مؤقتًا: تقدر تستخدم "تحديد يدوي على الخريطة" تحت.</p>}
        </div>
      )}
      {blocked && !insecure && !value && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 leading-relaxed space-y-1.5">
          <p className="font-bold">📍 مش قادرين ناخد موقعك تلقائيًا — جرب بالترتيب:</p>
          <ol className="list-decimal pr-4 space-y-1">
            <li>افتح أيقونة القفل 🔒 (أو الإعدادات) بجانب شريط العنوان، وتأكد إن "الموقع" مسموح لهذا الموقع.</li>
            <li>لو دوس أو موبايل: افتح إعدادات النظام ← الخصوصية والأمان ← خدمات الموقع، وتأكد إنها مفعّلة بشكل عام وإن المتصفح مسموح له من القائمة.</li>
            {allowManual && <li>لو الإعدادات كلها شغالة ولسه مش قادر: استخدم "تحديد يدوي على الخريطة" تحت — بيشتغل مية بالمية.</li>}
          </ol>
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={capture}
          disabled={loading}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition border ${value ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
        >
          {loading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
          {loading ? 'جاري تحديد موقعك...' : value ? 'تحديث بموقعي الحالي' : label}
        </button>
        {allowManual && (
          <button
            type="button"
            onClick={() => setManualMode((m) => !m)}
            className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border ${manualMode ? 'bg-[#0f3460] border-[#0f3460] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
            title="تحديد يدوي على الخريطة"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {allowManual && manualMode && (
        <p className="text-[11px] text-[#0f3460] bg-blue-50 border border-blue-100 rounded-lg p-2">
          دوس على مكان العميل بالظبط على الخريطة تحت (أو اسحب الدبوس) عشان تسجّل موقعه يدويًا.
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-500 flex items-start gap-1">
          <span>{error}</span>
        </p>
      )}
      {showMap && (
        <div className="relative">
          <div ref={mapRef} className="h-40 rounded-lg overflow-hidden border border-gray-200" />
          {value && !manualMode && (
            <button
              type="button"
              onClick={capture}
              className="absolute top-1.5 right-1.5 z-[1000] bg-white/90 backdrop-blur p-1.5 rounded-md shadow hover:bg-white"
              title="تحديث الموقع بموقعي الحالي"
              aria-label="تحديث الموقع بموقعي الحالي"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
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
      leafletMap.current = L.map(mapRef.current, { zoomControl: true, attributionControl: false, dragging: true, scrollWheelZoom: false }).setView([lat, lng], 15)
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
