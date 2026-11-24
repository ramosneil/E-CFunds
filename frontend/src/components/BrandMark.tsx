// The E-CFunds app icon (Neil's logo sheet, 2026-11-24): a gold ₱ coin on an OMSU-navy rounded tile.
// Same drawing as public/icon.svg, so the in-app logo, the browser tab and the phone icon match.
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden className={`shrink-0 ${className}`}>
      <rect width="512" height="512" rx="128" fill="#283891" />
      <circle cx="256" cy="256" r="160" fill="#FDD20A" />
      <circle cx="256" cy="256" r="141" fill="none" stroke="#E2B600" strokeWidth="7" opacity=".75" />
      <path d="M228 350 V174 H276 a52 52 0 0 1 0 104 H228" fill="none" stroke="#283891" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="186" y="204" width="146" height="14" rx="7" fill="#283891" />
      <rect x="186" y="233" width="146" height="14" rx="7" fill="#283891" />
    </svg>
  );
}
