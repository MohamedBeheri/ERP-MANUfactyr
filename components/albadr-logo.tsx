// شعار شركة البدر — SVG مفرّغ شفاف يتلوّن بلون النص (currentColor)
// يظهر أبيض على الخلفيات الداكنة وأسود على الفاتحة تلقائيًا
export function AlBadrLogo({ className = 'w-12 h-12', title = 'شركة البدر لتجارة البن' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title} fill="none" stroke="currentColor">
      <title>{title}</title>
      <defs>
        <path id="albadr-top" d="M100,100 m-82,0 a82,82 0 0 1 164,0" />
        <path id="albadr-bottom" d="M100,100 m-70,0 a70,70 0 0 0 140,0" />
      </defs>

      {/* الدائرتان */}
      <circle cx="100" cy="100" r="96" strokeWidth="2.5" />
      <circle cx="100" cy="100" r="78" strokeWidth="1.6" />

      {/* النص الدائري */}
      <g fill="currentColor" stroke="none">
        <text fontSize="15" fontWeight="700" letterSpacing="3" style={{ fontFamily: 'Georgia, serif' }}>
          <textPath href="#albadr-top" startOffset="50%" textAnchor="middle">REAL COFFEE EXPERTS</textPath>
        </text>
        <text fontSize="10" fontWeight="700" letterSpacing="2" style={{ fontFamily: 'Georgia, serif' }}>
          <textPath href="#albadr-bottom" startOffset="50%" textAnchor="middle">COFFEE COMPANY</textPath>
        </text>
      </g>

      {/* التاج */}
      <path d="M78,58 L78,40 L86,50 L100,36 L114,50 L122,40 L122,58 Z" strokeWidth="2.4" strokeLinejoin="round" />

      {/* زهرة البن — أوراق وحبوب وساق */}
      <g strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {/* ورقة يمين */}
        <path d="M100,92 C112,78 126,74 132,78 C130,90 118,98 100,92 Z" />
        {/* ورقة شمال */}
        <path d="M100,92 C88,78 74,74 68,78 C70,90 82,98 100,92 Z" />
        {/* حبتان */}
        <circle cx="92" cy="104" r="6" />
        <circle cx="108" cy="104" r="6" />
        {/* الساق */}
        <path d="M100,110 L100,124" />
        <path d="M100,122 C94,126 90,130 88,136" />
        <path d="M100,122 C106,126 110,130 112,136" />
      </g>

      {/* لافتة AL BADR */}
      <rect x="60" y="124" width="80" height="27" rx="1.5" strokeWidth="1.6" fill={'var(--logo-banner, none)'} />
      <text x="100" y="144" fontSize="18" fontWeight="700" letterSpacing="1.5" fill="currentColor" stroke="none" textAnchor="middle" style={{ fontFamily: 'Georgia, serif' }}>AL BADR</text>
    </svg>
  )
}
