import {
  Camera,
  HeartHandshake,
  ImageUp,
  Ribbon,
  ShieldCheck,
  Sprout,
  TreePine,
  UserRound,
} from "lucide-react";

const concepts = [
  { title: "A Rakhi", description: "A promise of protection.", icon: Ribbon },
  { title: "An Identity", description: "Every tree becomes part of the movement.", icon: Sprout },
  {
    title: "A Guardian",
    description: "Every approved promise receives a Vriksha Guardian identity.",
    icon: ShieldCheck,
  },
] as const;

const participationSteps = [
  { title: "Join the movement", icon: UserRound },
  { title: "Find a tree", icon: TreePine },
  { title: "Tie a Rakhi", icon: HeartHandshake },
  { title: "Click a picture", icon: Camera },
  { title: "Upload & inspire others", icon: ImageUp },
] as const;

export function JoinCampaignOverview() {
  return (
    <div className="join-overview">
      <section className="join-about" aria-labelledby="join-about-title">
        <h2 className="join-section-label" id="join-about-title">About Vriksha Bandhan</h2>
        <p className="join-about__intro">
          Trees protect us every day. This Raksha Bandhan, Mirchi is inviting Mumbai to return that
          promise of protection — by tying a Rakhi to a tree and making that promise visible.
        </p>
        <p className="join-about__promise">983 Trees. 983 Promises. One Greener Mumbai.</p>
        <div className="join-concepts">
          {concepts.map(({ title, description, icon: Icon }) => (
            <article key={title}>
              <span aria-hidden="true"><Icon size={22} /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="join-how" id="how-to-participate" aria-labelledby="join-how-title">
        <h2 className="join-section-label" id="join-how-title">How to participate</h2>
        <ol>
          {participationSteps.map(({ title, icon: Icon }, index) => (
            <li key={title}>
              <span className="join-how__icon" aria-hidden="true"><Icon size={21} /></span>
              <span className="join-how__number">{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
