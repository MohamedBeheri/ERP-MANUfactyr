'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, X, UserCog } from 'lucide-react'
import { PERMISSIONS, ROLE_DEFAULTS } from '@/lib/permissions'

export interface UserRow {
  id: string
  name: string
  username: string
  role: string
  permissions: string[]
  status: string
  lastLogin: string | null
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'مدير النظام',
  FACTORY: 'مدير المصنع',
  WAREHOUSE: 'مدير المخزن',
  SALES: 'مدير المبيعات',
  ACCOUNTANT: 'محاسب',
  DELEGATE: 'سائق / مندوب',
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

export function UserManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter()
  const empty = { name: '', username: '', password: '', role: 'SALES', permissions: [...(ROLE_DEFAULTS['SALES'] || [])] }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const togglePerm = (key: string) => {
    setForm((f: any) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p: string) => p !== key)
        : [...f.permissions, key],
    }))
  }

  const changeRole = (role: string) => {
    setForm((f: any) => ({ ...f, role, permissions: [...(ROLE_DEFAULTS[role] || [])] }))
  }

  const startEdit = (u: UserRow) => {
    setEditId(u.id)
    setForm({
      name: u.name,
      username: u.username,
      password: '',
      role: u.role,
      permissions: u.permissions.length > 0 ? [...u.permissions] : [...(ROLE_DEFAULTS[u.role] || [])],
    })
    setOpen(true)
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch(editId ? `/api/users/${editId}` : '/api/users', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'حصل خطأ')
      return
    }
    setForm(empty)
    setEditId(null)
    setOpen(false)
    router.refresh()
  }

  const remove = async (u: UserRow) => {
    if (!confirm(`متأكد من تعطيل حساب "${u.name}"؟ مش هيقدر يسجل دخول تاني.`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'حصل خطأ')
      return
    }
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
          <button
            onClick={() => { setOpen(true); setEditId(null); setForm(empty); setError('') }}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2545]"
          >
            <Plus className="w-4 h-4" />
            مستخدم جديد
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mx-5 mb-4 border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#1a1a2e]">{editId ? `تعديل: ${form.name}` : 'إضافة مستخدم جديد'}</h4>
            <button type="button" onClick={() => { setOpen(false); setEditId(null) }} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">اسم المستخدم (للدخول)</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputCls} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                كلمة السر {editId && <span className="text-gray-400">(سيبها فاضية لو مش هتتغير)</span>}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} dir="ltr" autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الدور الوظيفي</label>
              <select value={form.role} onChange={(e) => changeRole(e.target.value)} className={inputCls}>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              الصلاحيات — إيه اللي يقدر يعمله على السيستم:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer bg-white border border-gray-200 rounded-lg px-3 py-2.5 hover:border-[#e94560]/40">
                  <input
                    type="checkbox"
                    checked={form.role === 'ADMIN' || form.permissions.includes(p.key)}
                    disabled={form.role === 'ADMIN'}
                    onChange={() => togglePerm(p.key)}
                    className="w-4 h-4 accent-[#e94560] shrink-0"
                  />
                  {p.label}
                </label>
              ))}
            </div>
            {form.role === 'ADMIN' && (
              <p className="text-xs text-gray-400 mt-1.5">مدير النظام له كل الصلاحيات تلقائيًا.</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full md:w-auto px-8 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
            {loading ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إنشاء الحساب'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
              <th className="p-3 font-medium">الاسم</th>
              <th className="p-3 font-medium">اسم المستخدم</th>
              <th className="p-3 font-medium">الدور</th>
              <th className="p-3 font-medium">الصلاحيات</th>
              <th className="p-3 font-medium">الحالة</th>
              <th className="p-3 font-medium">آخر دخول</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const perms = u.role === 'ADMIN' ? PERMISSIONS.map((p) => p.key) : u.permissions.length > 0 ? u.permissions : ROLE_DEFAULTS[u.role] || []
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold">{u.name}</td>
                  <td className="p-3 text-gray-500" dir="ltr">{u.username}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-600">
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-64">
                      {u.role === 'ADMIN' ? (
                        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-semibold">كل الصلاحيات</span>
                      ) : (
                        perms.map((k) => (
                          <span key={k} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {PERMISSIONS.find((p) => p.key === k)?.label.split(' ')[0] || k}
                          </span>
                        ))
                      )}
                    </div>
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
                      <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل المستخدم">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {u.id !== currentUserId && (
                        <button onClick={() => remove(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="تعطيل المستخدم">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
