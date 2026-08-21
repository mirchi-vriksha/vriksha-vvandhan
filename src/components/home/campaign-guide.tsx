import Link from "next/link";
import { ArrowRight, HeartHandshake, Leaf, MapPin, ShieldCheck } from "lucide-react";

import { campaignFaqs } from "@/content/seo";

const campaignIdeas = [
  {
    title: "A greener Raksha Bandhan",
    description:
      "Vriksha Bandhan extends the festival’s promise of protection to the trees that give Mumbai shade, cleaner air, beauty and everyday shelter.",
    icon: Leaf,
  },
  {
    title: "A bond with your tree",
    description:
      "Choose a neighbourhood tree, a tree from your childhood or one you pass every day. The Rakhi becomes a simple, personal gesture of gratitude.",
    icon: HeartHandshake,
  },
  {
    title: "A movement across Mumbai",
    description:
      "98.3 Mirchi begins with 983 trees. Every approved photograph adds another Vriksha Guardian to Mumbai’s growing Wall of Gratitude.",
    icon: MapPin,
  },
] as const;

export function CampaignGuide() {
  return (
    <section className="campaign-guide" aria-labelledby="campaign-guide-title">
      <div className="shell campaign-guide__inner">
        <header className="campaign-guide__header">
          <p>Rakhi for trees in Mumbai</p>
          <h2 id="campaign-guide-title">What is Vriksha Bandhan?</h2>
          <p>
            Vriksha Bandhan by Mirchi is an invitation to celebrate Raksha Bandhan with nature.
            Tie a Rakhi to a tree, make a promise to protect it and share the moment so others can
            discover a more meaningful, eco-conscious way to celebrate.
          </p>
        </header>

        <div className="campaign-guide__cards">
          {campaignIdeas.map(({ title, description, icon: Icon }) => (
            <article key={title}>
              <span aria-hidden="true"><Icon size={23} /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <aside className="campaign-guide__care" aria-labelledby="tree-care-title">
          <ShieldCheck aria-hidden="true" size={27} />
          <div>
            <h3 id="tree-care-title">Celebrate without harming the tree</h3>
            <p>
              Keep the Rakhi soft and loose. Avoid nails, wire, staples and plastic tape, and
              remove it carefully after the celebration so the thread cannot tighten around the
              growing trunk.
            </p>
          </div>
          <Link className="text-link" href="/join#how-to-participate">
            See how to participate <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </aside>

        <div className="campaign-faq" aria-labelledby="campaign-faq-title">
          <header>
            <p>Questions and answers</p>
            <h2 id="campaign-faq-title">Vriksha Bandhan FAQ</h2>
          </header>
          <div>
            {campaignFaqs.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
