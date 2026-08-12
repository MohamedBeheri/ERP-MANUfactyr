'use client'

import { useEffect, useState } from 'react'

export interface NotifGroup { section: string; label: string; count: number; href: string; tone: 'action' | 'warn' }
export interface NotifState { total: number; groups: NotifGroup[]; loading: boolean }

// مخزن مشترك على مستوى الموديول: بوللنج واحد يخدم الجرس والقائمة الجانبية معًا
let state: NotifState = { total: 0, groups: [], loading: true }
let prevTotal = 0
const subscribers = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null
let soundCb: (() => void) | null = null

const emit = () => subscribers.forEach((fn) => fn())

async function fetchNow() {
  try {
    const res = await fetch('/api/notifications', { cache: 'no-store' })
    if (!res.ok) { state = { ...state, loading: false }; emit(); return }
    const data = await res.json()
    const newTotal = data.total || 0
    // صوت لما يزيد عدد البنود المحتاجة أكشن (بند جديد ظهر)
    if (!state.loading && newTotal > prevTotal && soundCb) soundCb()
    prevTotal = newTotal
    state = { total: newTotal, groups: data.groups || [], loading: false }
    emit()
  } catch {
    state = { ...state, loading: false }; emit()
  }
}

function ensurePolling() {
  if (timer) return
  fetchNow()
  timer = setInterval(fetchNow, 45000) // كل 45 ثانية
}

// يسجّل دالة تشغيل الصوت (الجرس بس هو اللي بيشغّل الصوت)
export function setNotifSound(cb: (() => void) | null) { soundCb = cb }

export function useNotifications(): NotifState {
  const [, force] = useState(0)
  useEffect(() => {
    const rerender = () => force((n) => n + 1)
    subscribers.add(rerender)
    ensurePolling()
    return () => {
      subscribers.delete(rerender)
      if (subscribers.size === 0 && timer) { clearInterval(timer); timer = null }
    }
  }, [])
  return state
}

// إعادة تحميل فوري (بعد ما المستخدم يعمل أكشن مثلاً)
export function refreshNotifications() { fetchNow() }
