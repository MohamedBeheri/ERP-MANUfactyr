// توحيد الأرقام: قبول الأرقام العربية (٠١٢٣) والفارسية (۰۱۲۳) والإنجليزية في أي إدخال
// والفواصل العشرية العربية (٫) والفاصلة العادية (,) كلها بتتحول لصيغة موحدة قبل الحفظ

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹'

// تحويل أي أرقام عربية/فارسية في النص لأرقام إنجليزية + توحيد الفاصلة العشرية
export function normalizeDigits(input: string): string {
  let out = ''
  for (const ch of String(input)) {
    const ai = ARABIC_INDIC.indexOf(ch)
    if (ai >= 0) { out += String(ai); continue }
    const ea = EASTERN_ARABIC.indexOf(ch)
    if (ea >= 0) { out += String(ea); continue }
    if (ch === '٫' || ch === ',') { out += '.'; continue } // فاصلة عشرية عربية أو كوما
    if (ch === '٬' || ch === ' ') continue // فاصل آلاف عربي / مسافة صلبة
    out += ch
  }
  return out
}

// تحويل أي قيمة (نص بأي أرقام أو رقم) لرقم — يقبل الكسور العشرية، يرجع 0 لو مش رقم
export function parseNum(value: unknown): number {
  if (typeof value === 'number') return isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  const normalized = normalizeDigits(String(value)).trim()
  const n = parseFloat(normalized)
  return isFinite(n) ? n : 0
}
