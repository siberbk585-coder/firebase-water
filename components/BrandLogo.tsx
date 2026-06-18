type BrandLogoProps = {
  size?: number;
  className?: string;
  /** Chỉ giọt nước — dùng header, favicon */
  iconOnly?: boolean;
};

function WaterDropIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id="brand-drop" x1="32" y1="6" x2="32" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1565C0" />
          <stop offset="45%" stopColor="#1E88E5" />
          <stop offset="100%" stopColor="#4FC3F7" />
        </linearGradient>
        <linearGradient id="brand-shine" x1="20" y1="18" x2="36" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M32 5C32 5 10 28.5 10 44.5a22 22 0 0 0 44 0C54 28.5 32 5 32 5Z"
        fill="url(#brand-drop)"
      />
      <path
        d="M32 5C32 5 10 28.5 10 44.5a22 22 0 0 0 44 0C54 28.5 32 5 32 5Z"
        fill="url(#brand-shine)"
      />
      <path
        d="M19 36c7-5.5 13.5-3.5 17.5 3"
        stroke="#0D47A1"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path d="M15 50h34" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.42" />
      <path d="M17 56.5h30" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.34" />
      <path d="M19 62.5h26" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.28" />
    </svg>
  );
}

export function BrandLogo({
  size = 36,
  className = "",
  iconOnly = false,
}: BrandLogoProps) {
  if (iconOnly) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`.trim()}>
        <WaterDropIcon size={size} />
      </span>
    );
  }

  const dropSize = Math.round(size * 0.72);

  return (
    <div
      className={`inline-flex flex-col items-center gap-1.5 ${className}`.trim()}
      role="img"
      aria-label="Toàn Thắng"
    >
      <WaterDropIcon size={dropSize} />
      <span
        className="font-bold leading-none tracking-wide text-[#1E88E5]"
        style={{ fontSize: Math.max(12, Math.round(size * 0.22)) }}
      >
        Toàn Thắng
      </span>
    </div>
  );
}
