import { ArrowLeft, Clock3, CloudOff } from "lucide-react";
import Link from "next/link";

export function SubmissionAvailability({ state }: { state: "closed" | "unavailable" }) {
  const unavailable = state === "unavailable";
  return (
    <section className="submission-availability" aria-labelledby="submission-availability-title">
      {unavailable ? <CloudOff aria-hidden="true" size={42} /> : <Clock3 aria-hidden="true" size={42} />}
      <p>{unavailable ? "Please try again soon" : "The next moment begins shortly"}</p>
      <h2 id="submission-availability-title">
        {unavailable ? "Submissions are temporarily unavailable." : "Submissions opening soon."}
      </h2>
      <p>
        {unavailable
          ? "The secure submission service is not available right now. No personal details have been collected."
          : "The campaign story is live, while private photograph submissions remain closed until the Mirchi team opens them."}
      </p>
      <Link className="button button--primary" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        <span>Back to the Movement</span>
      </Link>
    </section>
  );
}
