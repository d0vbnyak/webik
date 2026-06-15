import { Link } from "react-router";

type LogoProps = {
  className?: string;
  /**
   * "header" — по умолчанию webik-logo, при наведении и нажатии
   * плавно перекрашивается в reversed.
   * "white" — всегда reversed (белый), без интерактива.
   */
  variant?: "header" | "white";
};

/** Логотип WebIK со ссылкой на главную. */
export default function Logo({ className = "", variant = "header" }: LogoProps) {
  if (variant === "white") {
    return (
      <Link
        to="/"
        aria-label="WebIK — на главную"
        className={`inline-flex items-center ${className}`}
      >
        <img
          src="/webik-logo-reversed.svg"
          alt="WebIK"
          draggable={false}
          className="h-7 md:h-8 w-auto block select-none"
        />
      </Link>
    );
  }

  return (
    <Link
      to="/"
      aria-label="WebIK — на главную"
      className={`group relative inline-flex items-center ${className}`}
    >
      <img
        src="/webik-logo.svg"
        alt="WebIK"
        draggable={false}
        className="h-7 md:h-8 w-auto block select-none transition-opacity duration-200 ease-out group-hover:opacity-0 group-active:opacity-0"
      />
      <img
        src="/webik-logo-reversed.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 h-7 md:h-8 w-auto block select-none opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-active:opacity-100"
      />
    </Link>
  );
}
