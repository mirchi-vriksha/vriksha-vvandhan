import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";

export function CampaignPromise({ movementWallEnabled = false }: { movementWallEnabled?: boolean }) {
  return (
    <section className="campaign-promise" aria-labelledby="campaign-promise-title">
      <div className="shell campaign-promise__inner">
        <Leaf aria-hidden="true" size={44} />
        <div>
          <h2 id="campaign-promise-title">983 Trees. One Frequency. Infinite Gratitude.</h2>
          <p>Trees have given us shade, fresh air, beauty and life—quietly, every single day. This Raksha Bandhan, let’s celebrate everything they give us with a simple gesture of gratitude.</p>
        </div>
        {movementWallEnabled ? (
          <Link className="button button--light" href="/movement">
            See the Wall of Gratitude <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
