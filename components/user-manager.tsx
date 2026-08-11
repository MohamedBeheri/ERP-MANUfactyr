'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, X, UserCog, Shield, User as UserIcon, Phone, Mail, IdCard, MapPin, Calendar, Briefcase } from 'lucide-react'
import { PERMISSIONS, ACTIONS, ROLE_DEFAULTS } from '@/lib/permissions'

export interface UserRow {
  id: string
  name: string
  username: string
  role: string
  permissions: string[]
  status: string
  lastLogin: string | null
  phone?: string | null
  email?: string | null
  jobTitle?: string | null
  nationalId?: string | null
  address?: string | null
  hireDate?: string | null
  commissionRate?: number
  monthlyTarget?: number
  avatarUrl?: string | null
  notes?: string | null
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'مدير النظام (كل الصلاحيات)',
  FACTORY: 'مدير المصنع',
  WAREHOUSE: 'مدير المخزن',
  SALES: 'مدير المبيعات',
  ACCOUNTANT: 'محاسب',
  DELEGATE: 'مندوب',
}

const ROLE_TIER: { key: string; label: string; color: string }[] = [
  { key: 'DELEGATE', label: 'مندوب', color: 'bg-sky-50 text-sky-700 ring-sky-200' },
  { key: 'ACCOUNTANT', label: 'محاسب', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { key: 'WAREHOUSE', label: 'مخزن', color: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { key: 'FACTORY', label: 'مصنع', color: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { key: 'SALES', label: 'مبيعات', color: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  { key: 'ADMIN', label: 'أدمن', color: 'bg-red-50 text-red-700 ring-red-200' },
]

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

// نحوّل مفاتيح الصلاحيات (key أو key:action) لجدول: { [sectionKey]: Set(actions) }
function permsToMatrix(perms: string[]): Record<string, Set<string>> {
  const m: Record<string, Set<string>> = {}
  for (const p of perms) {
    const [sec, act] = p.split(':')
    if (!m[sec]) m[sec] = new Set()
    if (act) m[sec].add(act)
    else ACTIONS.forEach((a) => m[sec].add(a.key)) // القسم كامل = كل الأفعال
  }
  return m
}
function matrixToPerms(m: Record<string, Set<string>>): string[] {
  const out: string[] = []
  for (const sec of Object.keys(m)) {
    const set = m[sec]
    if (!set || set.size === 0) continue
    if (set.size === ACTIONS.length) out.push(sec) // كل الأفعال → المفتاح المختصر
    else set.forEach((a) => out.push(`${sec}:${a}`))
  }
  return out
}

export function UserManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter()
  const empty = {
    name: '', username: '', password: '', role: 'SALES',
    phone: '', email: '', jobTitle: '', nationalId: '', address: '', hireDate: '', notes: '',
    commissionRate: '', monthlyTarget: '',
    matrix: permsToMatrix(ROLE_DEFAULTS['SALES'] || []),
    customPerms: false, // false = الصلاحيات بتتبع الدور الوظيفي تلقائيًا (الافتراضي)
  }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleAction = (sec: string, action: string) => {
    setForm((f: any) => {
      const m = { ...f.matrix }
      if (!m[sec]) m[sec] = new Set()
      else m[sec] = new Set(m[sec])
      if (m[sec].has(action)) m[sec].delete(action)
      else m[sec].add(action)
      return { ...f, matrix: m }
    })
  }
  const toggleSection = (sec: string, allOn: boolean) => {
    setForm((f: any) => {
      const m = { ...f.matrix }
      if (allOn) m[sec] = new Set()
      else m[sec] = new Set(ACTIONS.map((a) => a.key))
      return { ...f, matrix: m }
    })
  }
  const changeRole = (role: string) => {
    setForm((f: any) => ({ ...f, role, matrix: permsToMatrix(ROLE_DEFAULTS[role] || []) }))
  }

  const startEdit = (u: UserRow) => {
    setEditId(u.id)
    const hasCustom = u.permissions.length > 0
    const eff = hasCustom ? u.permissions : (ROLE_DEFAULTS[u.role] || [])
    setForm({
      name: u.name, username: u.username, password: '',
      role: u.role,
      phone: u.phone || '', email: u.email || '', jobTitle: u.jobTitle || '',
      nationalId: u.nationalId || '', address: u.address || '',
      hireDate: u.hireDate ? u.hireDate.slice(0, 10) : '', notes: u.notes || '',
      commissionRate: u.commissionRate ? String(u.commissionRate) : '', monthlyTarget: u.monthlyTarget ? String(u.monthlyTarget) : '',
      matrix: permsToMatrix(eff),
      customPerms: hasCustom,
    })
    setOpen(true); setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.jobTitle?.trim()) { setError('المسمى الوظيفي مطلوب'); return }
    if (!form.phone || !/^\d{11}$/.test(form.phone)) { setError('رقم التليفون لازم يكون 11 رقم'); return }
    if (!form.nationalId || !/^\d{14}$/.test(form.nationalId)) { setError('الرقم القومي لازم يكون 14 رقم'); return }
    setLoading(true)
    // لو الأدمن ما فعّلش تخصيص يدوي، منبعتش permissions صريحة — الصلاحيات هتتبع الدور تلقائيًا (effectivePermissions)
    const permissions = form.role === 'ADMIN' || !form.customPerms ? [] : matrixToPerms(form.matrix)
    const body = { ...form, permissions }
    delete body.matrix
    delete body.customPerms
    const res = await fetch(editId ? `/api/users/${editId}` : '/api/users', {
      method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setForm(empty); setEditId(null); setOpen(false)
    router.refresh()
  }

  const remove = async (u: UserRow) => {
    if (!confirm(`متأكد من تعطيل حساب "${u.name}"؟ مش هيقدر يسجل دخول تاني.`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'حصل خطأ'); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-[#0f3460]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">المستخدمين والصلاحيات ({users.length})</h3>
        </div>
        {!open && (
          <button onClick={() => { setOpen(true); setEditId(null); setForm(empty); setError('') }} className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2545]">
            <Plus className="w-4 h-4" /> مستخدم جديد
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mx-5 mb-4 border border-gray-200 rounded-xl bg-gray-50/40 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100">
            <h4 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#0f3460]" />
              {editId ? `تعديل: ${form.name}` : 'إضافة مستخدم جديد'}
            </h4>
            <button type="button" onClick={() => { setOpen(false); setEditId(null) }} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm m-4">{error}</div>}

          {/* ===== قسم البيانات الشخصية ===== */}
          <div className="p-5 space-y-3">
            <h5 className="text-xs font-bold text-[#0f3460] flex items-center gap-1.5 border-b border-gray-100 pb-1.5"><UserIcon className="w-3.5 h-3.5" /> بيانات صاحب الحساب</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">الاسم الكامل *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="أحمد محمد علي" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3" /> المسمى الوظيفي *</label>
                <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputCls} placeholder="محاسب رئيسي / مندوب توزيع / مشرف مصنع" required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> رقم التليفون * <span className="text-gray-400 font-normal">(11 رقم)</span></label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} className={inputCls} dir="ltr" placeholder="01000000000" required maxLength={11} pattern="\d{11}" />
                {form.phone && form.phone.length !== 11 && <p className="text-[10px] text-red-500 mt-0.5">{form.phone.length}/11 رقم</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> البريد الإلكتروني</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} dir="ltr" placeholder="name@example.com" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><IdCard className="w-3 h-3" /> الرقم القومي * <span className="text-gray-400 font-normal">(14 رقم)</span></label>
                <input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value.replace(/\D/g, '').slice(0, 14) })} className={inputCls} dir="ltr" placeholder="12345678901234" required maxLength={14} pattern="\d{14}" />
                {form.nationalId && form.nationalId.length !== 14 && <p className="text-[10px] text-red-500 mt-0.5">{form.nationalId.length}/14 رقم</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> تاريخ التعيين</label>
                <input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">عمولة الموظف % (لو ليه عمولة)</label>
                <input type="text" inputMode="decimal" dir="ltr" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className={inputCls} placeholder="مثلاً 2.5" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">التارجت الشهري بالجنيه (0 = مفيش تارجت)</label>
                <input type="text" inputMode="decimal" dir="ltr" value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} className={inputCls} placeholder="مثلاً 150000" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> العنوان</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
              </div>
            </div>
          </div>

          {/* ===== قسم بيانات الدخول ===== */}
          <div className="p-5 pt-2 space-y-3 border-t border-gray-100">
            <h5 className="text-xs font-bold text-[#0f3460] flex items-center gap-1.5 border-b border-gray-100 pb-1.5"><Shield className="w-3.5 h-3.5" /> بيانات الدخول والدور</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">اسم المستخدم (للدخول) *</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputCls} dir="ltr" placeholder="ahmed.ali" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">كلمة السر {editId && <span className="text-gray-400 font-normal">(سيبها فاضية لو مش هتتغير)</span>}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} dir="ltr" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">الدور الوظيفي</label>
                <select value={form.role} onChange={(e) => changeRole(e.target.value)} className={inputCls}>
                  {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ===== الصلاحيات ===== */}
          <div className="p-5 pt-2 border-t border-gray-100">
            <h5 className="text-xs font-bold text-[#0f3460] flex items-center gap-1.5 border-b border-gray-100 pb-1.5 mb-3"><Shield className="w-3.5 h-3.5" /> الصلاحيات</h5>
            {form.role === 'ADMIN' ? (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2"><Shield className="w-4 h-4" /> مدير النظام له كل الصلاحيات تلقائيًا (كل الشاشات + كل الأفعال).</div>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.customPerms}
                    onChange={(e) => setForm({ ...form, customPerms: e.target.checked })}
                    className="w-4 h-4 accent-[#0f3460] cursor-pointer"
                  />
                  تخصيص صلاحيات يدوي (غير افتراضيات الوظيفة)
                </label>
                {!form.customPerms ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                    الصلاحيات هتتبع الدور الوظيفي "{ROLE_LABEL[form.role]}" تلقائيًا — أي تغيير في الدور بعدين هيغيّر صلاحياته معاه.
                    <p className="text-xs text-blue-600/80 mt-1.5">
                      الشاشات المتاحة حاليًا: {(ROLE_DEFAULTS[form.role] || []).map((k: string) => PERMISSIONS.find((p) => p.key === k.split(':')[0])?.label || k).join('، ') || 'لا شيء'}
                    </p>
                  </div>
                ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/70">
                    <tr>
                      <th className="p-2.5 text-right font-semibold text-gray-600 text-xs">الشاشة</th>
                      {ACTIONS.map((a) => (
                        <th key={a.key} className="p-2.5 font-semibold text-gray-600 text-xs text-center">{a.label}</th>
                      ))}
                      <th className="p-2.5 font-semibold text-gray-600 text-xs text-center">الكل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map((p) => {
                      const set = form.matrix[p.key] || new Set()
                      const allOn = set.size === ACTIONS.length
                      return (
                        <tr key={p.key} className={`border-t border-gray-100 ${allOn ? 'bg-blue-50/30' : ''}`}>
                          <td className="p-2.5 text-xs font-semibold text-[#1a1a2e]">{p.label}</td>
                          {ACTIONS.map((a) => (
                            <td key={a.key} className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={set.has(a.key)}
                                onChange={() => toggleAction(p.key, a.key)}
                                className="w-4 h-4 accent-[#0f3460] cursor-pointer"
                              />
                            </td>
                          ))}
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={allOn}
                              onChange={() => toggleSection(p.key, allOn)}
                              className="w-4 h-4 accent-[#e94560] cursor-pointer"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
                )}
              </>
            )}
          </div>

          <div className="p-5 pt-3 border-t border-gray-100 bg-white flex justify-end">
            <button type="submit" disabled={loading} className="px-8 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
              {loading ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إنشاء الحساب'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
              <th className="p-3 font-medium">المستخدم</th>
              <th className="p-3 font-medium">التواصل</th>
              <th className="p-3 font-medium">الدور</th>
              <th className="p-3 font-medium">عدد الصلاحيات</th>
              <th className="p-3 font-medium">الحالة</th>
              <th className="p-3 font-medium">آخر دخول</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const eff = u.role === 'ADMIN' ? PERMISSIONS.flatMap((p) => ACTIONS.map((a) => `${p.key}:${a.key}`)) : (u.permissions.length > 0 ? u.permissions : ROLE_DEFAULTS[u.role] || [])
              const tier = ROLE_TIER.find((r) => r.key === u.role) || ROLE_TIER[0]
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3">
                    <p className="font-semibold text-[#1a1a2e]">{u.name}</p>
                    <p className="text-xs text-gray-400" dir="ltr">{u.username}</p>
                    {u.jobTitle && <p className="text-[11px] text-gray-500 mt-0.5">{u.jobTitle}</p>}
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {u.phone && <p dir="ltr">{u.phone}</p>}
                    {u.email && <p dir="ltr" className="text-gray-400">{u.email}</p>}
                    {!u.phone && !u.email && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ring-1 ${tier.color}`}>
                      {tier.label}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {u.role === 'ADMIN' ? (
                      <span className="text-purple-600 font-bold">كل الصلاحيات</span>
                    ) : (
                      <span className="tabular-nums">{eff.length} صلاحية على {new Set(eff.map((k) => k.split(':')[0])).size} شاشة</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${u.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {u.status === 'ACTIVE' ? 'نشط' : 'معطّل'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 text-xs tabular-nums">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل"><Pencil className="w-4 h-4" /></button>
                      {u.id !== currentUserId && <button onClick={() => remove(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="تعطيل"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
