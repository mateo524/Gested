export default function LogoIcon({ size = 28, dark = false, monochrome = false }) {
  const barColor = monochrome ? (dark ? "#ffffff" : "#0f172a") : "#1e3a8a";
  const arcColor = monochrome ? (dark ? "#ffffff" : "#0f172a") : "#22c55e";

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="Performia icon">
      <rect x="10" y="8" width="14" height="48" rx="7" fill={barColor} />
      <path
        d="M24 16C39 16 52 21 52 32C52 43 39 48 24 48"
        stroke={arcColor}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

