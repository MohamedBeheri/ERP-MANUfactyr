// أدوات مشتركة لكل تقارير قسم المالية (/finance/*)

export const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
export const money = (n: number) => `${fmt(n)} ج.م`
export const pct = (a: number, b: number) => (b ? +((a / b) * 100).toFixed(1) : 0)
export const isoDay = (d: Date) => d.toISOString().slice(0, 10)

// يقرأ from/to من searchParams ويرجّع نطاق Prisma + النصوص (افتراضي: آخر ٣٠ يوم)
export function parsePeriod(searchParams: { from?: string; to?: string }) {
  const today = new Date()
  const defFrom = new Date(today)
  defFrom.setDate(defFrom.getDate() - 29)
  const fromStr = searchParams.from || isoDay(defFrom)
  const toStr = searchParams.to || isoDay(today)
  const period = { gte: new Date(fromStr + 'T00:00:00'), lte: new Date(toStr + 'T23:59:59.999') }
  return { fromStr, toStr, period }
}

export const dateTime = (d: Date | string) =>
  new Date(d).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const dateShort = (d: Date | string) =>
  new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })
