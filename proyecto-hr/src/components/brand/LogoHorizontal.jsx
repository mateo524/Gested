import LogoIcon from "./LogoIcon";

export default function LogoHorizontal({ dark = false }) {
  return (
    <div className="flex items-center gap-2">
      <LogoIcon size={28} dark={dark} />
      <span
        className={`text-lg font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        Performia
      </span>
    </div>
  );
}

