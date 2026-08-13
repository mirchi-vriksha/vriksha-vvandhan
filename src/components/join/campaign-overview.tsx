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
  { title: "A Rakhi", description: "A gesture of appreciation.", icon: Ribbon },
  { title: "An Identity", description: "A tree worth celebrating.", icon: Sprout },
  {
    title: "A Guardian",
    description: "Someone who chooses to honour the bond.",
    icon: ShieldCheck,
  },
] as const;

const participationSteps = [
  { title: "Join", description: "Register & get your Rakhi.", icon: UserRound },
  { title: "Find", description: "Choose a tree to celebrate.", icon: TreePine },
  { title: "Tie", description: "Tie a Rakhi as a gesture of gratitude.", icon: HeartHandshake },
  { title: "Capture", description: "Click your Vriksha Bandhan moment.", icon: Camera },
  { title: "Share", description: "Upload it & inspire others.", icon: ImageUp },
] as const;

export function JoinCampaignOverview() {
  return (
    <div className="join-overview">
      <section className="join-about" aria-labelledby="join-about-title">
        <h2 className="join-section-label" id="join-about-title">A Rakhi. A Gesture of Gratitude.</h2>
        <p className="join-about__intro">
          This Raksha Bandhan, Mirchi is bringing Mumbai together to celebrate the trees that have
          been a part of our lives all along.
        </p>
        <p className="join-about__promise">Because some bonds deserve to be celebrated.</p>
        <div className="join-about__movement">
          <h3>The Mirchi Movement</h3>
          <p className="join-about__tracker">983 Trees. One Frequency. Infinite Gratitude.</p>
          <p>
            98.3 Mirchi begins the movement by tying Rakhis to 983 trees across Mumbai.
          </p>
        </div>
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
          {participationSteps.map(({ title, description, icon: Icon }, index) => (
            <li key={title}>
              <span className="join-how__icon" aria-hidden="true"><Icon size={21} /></span>
              <span className="join-how__number">{String(index + 1).padStart(2, "0")}</span>
              <span className="join-how__copy"><strong>{title}</strong><small>{description}</small></span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
