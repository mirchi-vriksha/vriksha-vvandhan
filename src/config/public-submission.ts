export const PUBLIC_SUBMISSION = {
  displayNameMax: 100,
  emailMax: 254,
  inputMaxBytes: 15 * 1024 * 1024,
  preparedTargetBytes: Math.round(1.5 * 1024 * 1024),
  preparedMaxBytes: 2 * 1024 * 1024,
  maximumDimension: 2560,
  acceptedInputExtensions: ["jpg", "jpeg", "png", "webp", "heic", "heif", "hif"],
  acceptedInputMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ],
  preferredOutputMime: "image/webp",
  jpegFallbackMime: "image/jpeg",
  consentVersion: "staging-2026-08-v1",
} as const;

export const PUBLIC_SUBMISSION_COPY = {
  publicationConsent:
    "I allow Mirchi to review this submission and, if approved, publish my display name and photograph as part of the Vriksha Bandhan campaign.",
  termsAcceptance:
    "I confirm that I have the right to share this photograph and agree to the Vriksha Bandhan campaign terms.",
  emailHelp:
    "We’ll use this address to contact you after review and send your certificate if approved.",
} as const;

export const PUBLIC_SUBMISSION_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,.hif,image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence";

export type PreparedImageExtension = "webp" | "jpg";
