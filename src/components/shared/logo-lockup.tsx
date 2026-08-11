import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoLockupProps = {
  variant?: "default" | "compact" | "hero";
  layout?: "inline" | "stacked";
  inverse?: boolean;
};

const imageSizes = {
  default: "96px",
  compact: "78px",
  hero: "(max-width: 959px) 128px, 176px",
} as const;

export function LogoLockup({
  variant = "default",
  layout = "inline",
  inverse = false,
}: LogoLockupProps) {
  return (
    <div
      className={cn(
        "logo-lockup",
        `logo-lockup--${variant}`,
        `logo-lockup--${layout}`,
        inverse && "logo-lockup--inverse",
      )}
      role="img"
      aria-label="Mirchi presents Vriksha Bandhan"
    >
      <Image
        src="/brand/mirchi-logo.png"
        alt=""
        width={324}
        height={137}
        sizes={imageSizes[variant]}
        loading="eager"
        className="logo-lockup__mirchi"
      />
      {layout === "inline" ? (
        <span className="logo-lockup__divider" aria-hidden="true" />
      ) : (
        <span className="logo-lockup__presents" aria-hidden="true">
          presents
        </span>
      )}
      <span className="logo-lockup__campaign" data-temporary-campaign-wordmark="true">
        <span>Vriksha</span>
        <span>Bandhan</span>
      </span>
    </div>
  );
}
