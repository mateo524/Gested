import logoSrc from "../../assets/brand/zentor-logo-horizontal.svg";
import logoWhiteSrc from "../../assets/brand/zentor-logo-white.svg";

export default function LogoHorizontal({ dark = false }) {
  return (
    <img
      src={dark ? logoWhiteSrc : logoSrc}
      alt="ZENTOR"
      className="h-8 w-auto"
    />
  );
}
