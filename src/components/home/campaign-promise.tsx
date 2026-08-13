import { ArrowRight, Leaf } from "lucide-react";
import Link from "next/link";

export function CampaignPromise({ movementWallEnabled = false }: { movementWallEnabled?: boolean }) {
  return (
    <section className="campaign-promise" aria-labelledby="campaign-promise-title">
      <div className="shell campaign-promise__inner">
        <Leaf aria-hidden="true" size={44} />
        <div>
          <h2 id="campaign-promise-title">983 Trees. 983 Promises. One Greener Mumbai.</h2>
          <p>
            This Raksha Bandhan, make a promise of protection to a tree and become a Vriksha Guardian.
          </p>
        </div>
        {movementWallEnabled ? (
          <Link className="button button--light" href="/movement">
            See all Vriksha Guardians <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
