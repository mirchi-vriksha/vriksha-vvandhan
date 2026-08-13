import { LogoLockup } from "@/components/shared/logo-lockup";
import { getPublicCampaignSummary } from "@/lib/public-campaign/data";

export async function SiteFooter({ movementWallEnabled }: { movementWallEnabled?: boolean }) {
  const enabled = movementWallEnabled ?? (await getPublicCampaignSummary())?.movement_wall_enabled ?? false;
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <LogoLockup />
        <div className="site-footer__campaign">
          <p>Vriksha Bandhan by Mirchi</p>
          <p>983 Trees. One Frequency. Infinite Gratitude.</p>
          <nav aria-label="Vriksha Bandhan links">
            <a href="/join">Tie a Rakhi to a Tree</a>
            {enabled && <a href="/movement">Movement Wall</a>}
            <a href="/campaign-terms">Campaign terms</a>
            <a href="/privacy">Privacy</a>
          </nav>
        </div>
        <p className="site-footer__copyright">
          © {new Date().getFullYear()} Mirchi. Vriksha Bandhan.
        </p>
      </div>
    </footer>
  );
}
