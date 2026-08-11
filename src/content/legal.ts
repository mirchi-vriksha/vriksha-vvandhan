export const legalContent = {
  terms: {
    eyebrow: "Campaign terms",
    title: "A clear promise, shared responsibly.",
    intro:
      "These staging terms describe how the Vriksha Bandhan submission experience currently works. Final campaign terms remain subject to Mirchi and Times legal approval before launch.",
    sections: [
      {
        title: "What you may submit",
        body: "Share one photograph that you have the right to provide, along with a display name and email address. Do not submit unlawful, harmful or third-party material without permission.",
      },
      {
        title: "Private review first",
        body: "A submission is private while the Mirchi team reviews it. Submission does not guarantee approval, publication, a Guardian number or a certificate.",
      },
      {
        title: "If approved",
        body: "The campaign may publish the approved photograph and display name as part of Vriksha Bandhan. The original email address and consent evidence are not public.",
      },
      {
        title: "Removal and retention",
        body: "The final removal process and retention periods will be confirmed before launch. No fixed retention promise is made in this staging draft.",
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Your photograph begins in private.",
    intro:
      "This staging notice explains the verified Section 3 data flow. Final privacy and retention language remains subject to legal approval before launch.",
    sections: [
      {
        title: "What we collect",
        body: "The form collects a display name, email address, one photograph, publication consent and terms acceptance. It does not create a participant account.",
      },
      {
        title: "How the photograph is handled",
        body: "The browser prepares the image before it is uploaded directly to private campaign storage. The server verifies the stored file before placing the submission in Pending Review.",
      },
      {
        title: "How details are used",
        body: "The email address is kept private for review contact and, if approved in a later phase, certificate delivery. The approved display name and photograph may later be published with your consent.",
      },
      {
        title: "What does not happen yet",
        body: "Section 3 sends no email, generates no certificate and publishes no participant image. The final removal channel and retention period will be confirmed before launch.",
      },
    ],
  },
} as const;
