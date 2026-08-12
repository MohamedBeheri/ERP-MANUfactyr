// أدوات أمان مشتركة: حد حجم المرفقات + إخفاء تفاصيل أخطاء قاعدة البيانات

// أقصى حجم لمرفق base64 (~2.7MB بعد الترميز = ~2MB صورة فعلية) — يمنع تفجير قاعدة البيانات/الميموري
const MAX_ATTACHMENT_CHARS = 2_800_000

// بيرجع رسالة خطأ لو المرفق كبير أوي، أو null لو تمام أو مفيش مرفق
export function attachmentTooLarge(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return 'صيغة المرفق غير صحيحة'
  if (value.length > MAX_ATTACHMENT_CHARS) return 'حجم الصورة كبير جدًا (الحد الأقصى ~2 ميجا)'
  return null
}

// بيتحقق من عدة مرفقات مرة واحدة — يرجّع أول خطأ أو null
export function checkAttachments(...values: unknown[]): string | null {
  for (const v of values) {
    const err = attachmentTooLarge(v)
    if (err) return err
  }
  return null
}

// ===== rate limiting بسيط في الذاكرة (لكل IP لكل مفتاح) =====
// مناسب لـ instance واحد (Render free). للإنتاج الموسّع يفضّل Redis.
const hits = new Map<string, number[]>()

// بيرجع true لو المعدل اتعدّى (يعني ارفض الطلب)
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs)
  if (arr.length >= max) {
    hits.set(key, arr)
    return true
  }
  arr.push(now)
  hits.set(key, arr)
  // تنظيف دوري بسيط لتفادي تضخم الماب
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k)
    }
  }
  return false
}

// بيستخرج IP العميل من ترويسات الطلب
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
