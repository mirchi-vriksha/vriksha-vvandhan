import Image from "next/image";

import type { CampaignMetric } from "@/types/campaign";

type RakhiPromiseCounterProps = {
  metric: CampaignMetric;
};

export function RakhiPromiseCounter({ metric }: RakhiPromiseCounterProps) {
  const available = metric.current !== null;
  const progress = available && metric.target > 0
    ? Math.min(Math.max(metric.current! / metric.target, 0), 1)
    : 0;
  const percentage = Math.round(progress * 100);
  const accessibleLabel = available
    ? `${metric.current} of ${metric.target} ${metric.label}.`
    : `Campaign promise count is currently unavailable. Target: ${metric.target} ${metric.label}.`;

  return (
    <div className="rakhi-counter" aria-label={accessibleLabel} role="img" data-available={available}>
      <Image
        className="rakhi-counter__ornament"
        src="/campaign/rakhi-counter-ornament.png"
        alt=""
        width={1481}
        height={315}
        sizes="(max-width: 639px) 700px, 1000px"
        loading="eager"
        aria-hidden="true"
      />
      <span className="rakhi-counter__copy">
        <strong>{available ? metric.current : "—"}</strong>
        <span>of <b>{metric.target}</b></span>
        <small>{metric.label}</small>
        <svg className="rakhi-counter__leaf" viewBox="0 0 34 24" aria-hidden="true">
          <path d="M17 21C17 13 17 7 17 2" />
          <path d="M16 13C9 13 5 9 4 4c7 0 11 3 12 9Z" />
          <path d="M18 10c7 0 10-3 12-8-7 0-11 3-12 8Z" />
        </svg>
      </span>
      <span className="visually-hidden">
        {available ? `${percentage}% complete.` : "Live tracker updating."}
      </span>
    </div>
  );
}
