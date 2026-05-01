import LogoIcon from "./LogoIcon";

export default function LogoMonochrome({ dark = false }) {
  return (
    <div className="flex items-center gap-2">
      <LogoIcon size={28} dark={dark} monochrome />
      <span className={`text-lg font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
        Performia
      </span>
    </div>
  );
}

