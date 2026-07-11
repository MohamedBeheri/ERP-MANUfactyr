'use client'

import { FileSpreadsheet, Printer } from 'lucide-react'

interface ExportButtonsProps {
  fileName: string
  headers: string[]
  rows: (string | number)[][]
}

// تصدير Excel عن طريق CSV بترميز UTF-8 مع BOM عشان العربي يظهر صح في Excel
function exportCsv(fileName: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportButtons({ fileName, headers, rows }: ExportButtonsProps) {
  return (
    <div className="flex gap-2 no-print">
      <button
        onClick={() => exportCsv(fileName, headers, rows)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Excel
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-medium hover:bg-[#0a2545] transition-colors"
      >
        <Printer className="w-4 h-4" />
        PDF / طباعة
      </button>
    </div>
  )
}

export function PrintButton({ label = 'طباعة الأمر' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-medium hover:bg-[#0a2545] transition-colors no-print"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  )
}
