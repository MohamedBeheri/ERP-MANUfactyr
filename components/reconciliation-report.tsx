'use client'

import { useEffect, useState } from 'react'
import { Printer, RefreshCw } from 'lucide-react'

interface Data {
  greens: { name: string; kg: number; roastLoss: number }[]
  spices: { name: string; kg: number }[]
  packaging: { name: string; pieces: number }[]
  blends: { name: string; output: number; waste: number; input: number; lossPercent: number }[]
  finished: { name: string; boxes: number; coffeeKg: number }[]
  ordersCount: number
}

const CHANNELS = ['', 'المصنع', 'حلوان (الكافيه)', 'عبدالله (تحميص أجرة)']
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ReconciliationReport() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [channel, setChannel] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [actual, setActual] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    const q = new URLSearchParams({ from, to, ...(channel ? { channel } : {}) })
    const res = await fetch(`/api/factory/reconciliation?${q}`)
    setData(res.ok ? await res.json() : null)
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const variance = (name: string, required: number) => {
    const a = actual[name]
    if (a === undefined || a === '') return null
    return Number(a) - required
  }

  const printUrl = `/print/reconciliation?${new URLSearchParams({ from, to, ...(channel ? { channel } : {}) })}`

  return (
    <div className="space-y-4">
      {/* أدوات التصفية */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">من</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">إلى</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">القناة</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c || 'كل القنوات'}</option>)}
          </select>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2545]">
          <RefreshCw className="w-4 h-4" /> عرض
        </button>
        <a href={printUrl} target="_blank" className="flex items-center gap-1.5 bg-[#e9b44c] text-[#1a1a2e] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#d9a43c]">
          <Printer className="w-4 h-4" /> طباعة المحضر
        </a>
      </div>

      {loading && <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">جاري الحساب…</div>}

      {data && !loading && (
        <>
          {data.ordersCount === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500 text-sm">مفيش أوامر تصنيع في الفترة/القناة دي.</div>
          )}

          {data.greens.length > 0 && (
            <Card title="البن الأخضر المستهلك">
              <Table headers={['الصنف', 'المطلوب (كجم)', 'نسبة الخسران', 'الفعلي من المصنع', 'العجز / الزيادة']}>
                {data.greens.map((g) => {
                  const v = variance(g.name, g.kg)
                  return (
                    <tr key={g.name} className="border-b border-gray-50 last:border-0">
                      <td className="p-3 font-semibold">{g.name}</td>
                      <td className="p-3 tabular-nums">{fmt(g.kg)}</td>
                      <td className="p-3 tabular-nums text-red-600">{fmt(g.roastLoss)}%</td>
                      <td className="p-3">
                        <input type="number" step="0.01" value={actual[g.name] ?? ''} onChange={(e) => setActual({ ...actual, [g.name]: e.target.value })} placeholder={fmt(g.kg)} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm tabular-nums" />
                      </td>
                      <td className={`p-3 tabular-nums font-bold ${v === null ? 'text-gray-300' : v === 0 ? 'text-green-600' : v > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {v === null ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}`}
                      </td>
                    </tr>
                  )
                })}
              </Table>
            </Card>
          )}

          {data.spices.length > 0 && (
            <Card title="العطارة المستهلكة">
              <Table headers={['الصنف', 'المطلوب (كجم)', 'الفعلي', 'العجز / الزيادة']}>
                {data.spices.map((s) => {
                  const v = variance(s.name, s.kg)
                  return (
                    <tr key={s.name} className="border-b border-gray-50 last:border-0">
                      <td className="p-3 font-semibold">{s.name}</td>
                      <td className="p-3 tabular-nums">{fmt(s.kg)}</td>
                      <td className="p-3"><input type="number" step="0.01" value={actual[s.name] ?? ''} onChange={(e) => setActual({ ...actual, [s.name]: e.target.value })} placeholder={fmt(s.kg)} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm tabular-nums" /></td>
                      <td className={`p-3 tabular-nums font-bold ${v === null ? 'text-gray-300' : v === 0 ? 'text-green-600' : v > 0 ? 'text-blue-600' : 'text-red-600'}`}>{v === null ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}`}</td>
                    </tr>
                  )
                })}
              </Table>
            </Card>
          )}

          {data.blends.length > 0 && (
            <Card title="التوليفات المنتجة">
              <Table headers={['التوليفة', 'المدخل (كجم)', 'الناتج (كجم)', 'الهدر', 'نسبة الهدر']}>
                {data.blends.map((b) => (
                  <tr key={b.name} className="border-b border-gray-50 last:border-0">
                    <td className="p-3 font-semibold">{b.name}</td>
                    <td className="p-3 tabular-nums">{fmt(b.input)}</td>
                    <td className="p-3 tabular-nums text-green-700">{fmt(b.output)}</td>
                    <td className="p-3 tabular-nums text-orange-600">{fmt(b.waste)}</td>
                    <td className="p-3 tabular-nums font-bold">{fmt(b.lossPercent)}%</td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {data.finished.length > 0 && (
            <Card title="المنتجات المعبّأة">
              <Table headers={['المنتج', 'العلب', 'البن المستهلك (كجم)']}>
                {data.finished.map((f) => (
                  <tr key={f.name} className="border-b border-gray-50 last:border-0">
                    <td className="p-3 font-semibold">{f.name}</td>
                    <td className="p-3 tabular-nums">{f.boxes}</td>
                    <td className="p-3 tabular-nums text-amber-700">{fmt(f.coffeeKg)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {data.packaging.length > 0 && (
            <Card title="مواد التغليف المستهلكة">
              <Table headers={['المادة', 'القطع']}>
                {data.packaging.map((p) => (
                  <tr key={p.name} className="border-b border-gray-50 last:border-0">
                    <td className="p-3 font-semibold">{p.name}</td>
                    <td className="p-3 tabular-nums">{p.pieces}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <h3 className="text-base font-bold text-[#1a1a2e] p-4 pb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <>
      <thead>
        <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
          {headers.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </>
  )
}
