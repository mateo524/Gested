import logoSrc from "../../assets/brand/zentor-icon.svg";

export default function LogoIcon({ size = 28 }) {
  return <img src={logoSrc} alt="ZENTOR" width={size} height={size} />;
}
