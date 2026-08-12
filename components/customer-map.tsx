'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Users } from 'lucide-react'
import { EGYPT_GOVERNORATES, GOVERNORATE_CENTER } from '@/lib/governorates'

export interface CustomerPoint {
  id: string
  name: string
  phone: string | null
  area: string | null
  governorate: string | null
  lat: number | null
  lng: number | null
  balance: number
  customerType: string
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

// إزاحة بسيطة وثابتة (مبنية على id) عشان العملاء اللي بدون إحداثيات دقيقة ومربوطين بمركز المحافظة بس ما يتراكموش فوق بعض
function jitter(id: string): [number, number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const a = ((h % 1000) / 1000 - 0.5) * 0.18
  const b = (((h >> 10) % 1000) / 1000 - 0.5) * 0.18
  return [a, b]
}

export function CustomerMap({ customers }: { customers: CustomerPoint[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const markersLayer = useRef<any>(null)
  const [governorate, setGovernorate] = useState('')
  const [ready, setReady] = useState(false)

  const plottable = customers.filter((c) => c.governorate && GOVERNORATE_CENTER[c.governorate])
  const filtered = governorate ? plottable.filter((c) => c.governorate === governorate) : plottable
  const usedGovernorates = Array.from(new Set(plottable.map((c) => c.governorate as string))).sort()

  useEffect(() => {
    let cancelled = false
    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current || leafletMap.current) return
      // أيقونة الدبوس الافتراضية بتتكسر مع الباندلرز — نستخدم أيقونة SVG مخصصة
      const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([26.8, 30.8], 6)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)
      markersLayer.current = L.layerGroup().addTo(map)
      leafletMap.current = map
      setReady(true)
    })
    return () => { cancelled = true; if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null } }
  }, [])

  useEffect(() => {
    if (!ready || !leafletMap.current || !markersLayer.current) return
    import('leaflet').then((L) => {
      markersLayer.current.clearLayers()
      const bounds: [number, number][] = []
      for (const c of filtered) {
        let lat: number, lng: number
        if (c.lat != null && c.lng != null) { lat = c.lat; lng = c.lng }
        else {
          const center = GOVERNORATE_CENTER[c.governorate as string]
          const [dLat, dLng] = jitter(c.id)
          lat = center[0] + dLat; lng = center[1] + dLng
        }
        bounds.push([lat, lng])
        const color = c.balance > 0 ? '#dc2626' : c.customerType === 'WHOLESALE' ? '#2563eb' : '#0f3460'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        const marker = L.marker([lat, lng], { icon }).addTo(markersLayer.current)
        marker.bindPopup(
          `<div style="font-family:inherit;text-align:right;min-width:150px">
            <b>${escapeHtml(c.name)}</b><br/>
            ${c.governorate ? `<span style="color:#666">${escapeHtml(c.governorate)}${c.area ? ' — ' + escapeHtml(c.area) : ''}</span><br/>` : ''}
            ${c.phone ? `<span dir="ltr" style="color:#666">${escapeHtml(c.phone)}</span><br/>` : ''}
            ${c.balance > 0 ? `<span style="color:#dc2626;font-weight:bold">مديونية ${fmt(c.balance)} ج.م</span>` : ''}
          </div>`
        )
      }
      if (bounds.length > 0) leafletMap.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 })
      else leafletMap.current.setView([26.8, 30.8], 6)
    })
  }, [ready, filtered])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#e94560]" /> خريطة توزيع العملاء
          <span className="text-xs font-normal text-gray-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {filtered.length} عميل معروض</span>
        </h3>
        <select value={governorate} onChange={(e) => setGovernorate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e94560]">
          <option value="">كل المحافظات ({plottable.length})</option>
          {usedGovernorates.map((g) => (
            <option key={g} value={g}>{g} ({plottable.filter((c) => c.governorate === g).length})</option>
          ))}
        </select>
      </div>
      {plottable.length === 0 ? (
        <div className="h-[420px] rounded-xl bg-gray-50 flex flex-col items-center justify-center text-center gap-1.5 text-gray-400">
          <MapPin className="w-8 h-8" />
          <p className="text-sm font-semibold">مفيش عملاء بموقع/محافظة مسجّلة لسه</p>
          <p className="text-xs">هتظهر النقط هنا أول ما تتسجّل محافظة أو موقع للعميل من شاشة العملاء أو عند إضافة عميل جديد من المندوب</p>
        </div>
      ) : (
        <div ref={mapRef} className="h-[420px] rounded-xl overflow-hidden" />
      )}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0f3460] inline-block" /> قطاعي</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> جملة</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> عليه مديونية</span>
      </div>
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
