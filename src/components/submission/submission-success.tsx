"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function SubmissionSuccess() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className="submission-success" aria-labelledby="submission-success-title">
      <CheckCircle2 className="submission-success__icon" aria-hidden="true" size={58} />
      <p className="submission-success__eyebrow">Promise received</p>
      <h2 id="submission-success-title" ref={headingRef} tabIndex={-1}>
        Your submission has been received.
      </h2>
      <p>
        Our team will review your photograph before it appears publicly. If approved, it will be added to the Vriksha Bandhan Movement Wall, included in the campaign count, and your personalised Vriksha Guardian certificate will be emailed to the address you provided.
      </p>
      <aside><strong>Your image is not public yet.</strong> No Guardian number or certificate has been created at this stage.</aside>
      <Link className="button button--primary" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        <span>Back to the Movement</span>
      </Link>
    </section>
  );
}
