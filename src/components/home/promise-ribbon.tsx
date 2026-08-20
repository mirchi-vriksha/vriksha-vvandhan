import { PromiseReel } from "@/components/home/promise-reel";

import type { PromiseReelImage } from "@/types/campaign";

type PromiseRibbonProps = {
  description?: string | null;
  heading: string;
  images: readonly PromiseReelImage[];
};

export function PromiseRibbon({ description, heading, images }: PromiseRibbonProps) {
  return (
    <section className="promise-ribbon" aria-labelledby="promise-ribbon-title">
      <div className="promise-ribbon__heading">
        <span aria-hidden="true" />
        <h2 id="promise-ribbon-title">{heading}</h2>
        <i aria-hidden="true" />
      </div>
      {description ? <p className="promise-ribbon__description">{description}</p> : null}
      <PromiseReel images={images} />
    </section>
  );
}
