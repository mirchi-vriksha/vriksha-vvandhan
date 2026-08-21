"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle2, Clock3, MailCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function SubmissionSuccess() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className="submission-success" aria-labelledby="submission-success-title">
      <CheckCircle2 className="submission-success__icon" aria-hidden="true" size={58} />
      <p className="submission-success__eyebrow">Moment received</p>
      <h2 id="submission-success-title" ref={headingRef} tabIndex={-1}>
        Thank you. Your moment is now under review.
      </h2>
      <p className="submission-success__intro">
        Our team will review your photograph before anything is published.
      </p>

      <div className="submission-success__delivery">
        <Clock3 aria-hidden="true" size={26} />
        <div>
          <h3>Certificate by email after approval</h3>
          <p>
            If approved, your personalised Vriksha Guardian certificate will be sent to the email address you provided.
          </p>
        </div>
      </div>

      <div className="submission-success__details">
        <aside className="submission-success__inbox-note">
          <MailCheck aria-hidden="true" size={22} />
          <div>
            <strong>Check your spam or junk folder.</strong>
            <p>
              You will not receive a separate submission confirmation email. If approved, the next email from us will include your certificate.
            </p>
          </div>
        </aside>

        <aside className="submission-success__privacy-note">
          <ShieldCheck aria-hidden="true" size={22} />
          <div>
            <strong>Private until approved.</strong>
            <p>Your photograph is not public yet, and no Guardian number has been assigned.</p>
          </div>
        </aside>
      </div>

      <Link className="button button--primary" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        <span>Back to the Movement</span>
      </Link>
    </section>
  );
}
