export default function LogoIcon({ size = 28, dark = false, monochrome = false }) {
  const barColor = monochrome ? (dark ? "#ffffff" : "#0f172a") : "#1e3a8a";
  const diagColor = monochrome ? (dark ? "#ffffff" : "#0f172a") : "#22c55e";

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="ZENTOR icon">
      <path d="M14 14h36" stroke={barColor} strokeWidth="7" strokeLinecap="round" />
      <path d="M50 14L14 50" stroke={diagColor} strokeWidth="7" strokeLinecap="round" />
      <path d="M14 50h36" stroke={barColor} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

