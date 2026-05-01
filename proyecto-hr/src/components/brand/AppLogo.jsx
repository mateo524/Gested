import LogoIcon from "./LogoIcon";
import LogoHorizontal from "./LogoHorizontal";
import LogoDark from "./LogoDark";
import LogoMonochrome from "./LogoMonochrome";

export { LogoIcon, LogoHorizontal, LogoDark, LogoMonochrome };

export default function AppLogo({ variant = "horizontal" }) {
  if (variant === "icon") return <LogoIcon />;
  if (variant === "dark") return <LogoDark />;
  if (variant === "mono") return <LogoMonochrome />;
  return <LogoHorizontal />;
}

