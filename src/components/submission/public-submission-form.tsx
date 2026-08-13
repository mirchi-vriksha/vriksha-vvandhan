"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { PhotoSelector } from "@/components/submission/photo-selector";
import { SubmissionErrorSummary } from "@/components/submission/submission-error-summary";
import { SubmissionProgress, type SubmissionStage } from "@/components/submission/submission-progress";
import { SubmissionSuccess } from "@/components/submission/submission-success";
import { TurnstileWidget } from "@/components/submission/turnstile-widget";
import { PUBLIC_SUBMISSION, PUBLIC_SUBMISSION_COPY } from "@/config/public-submission";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  ClientImageError,
  prepareImage,
  revokePreviewUrl,
  type PreparedImage,
} from "@/lib/submissions/client-image";
import { generatePublicRequestToken } from "@/lib/submissions/request-token";
import {
  prepareSubmissionRequestSchema,
  prepareSubmissionResponseSchema,
  finalizeSubmissionResponseSchema,
  publicApiErrorSchema,
  type PublicApiError,
} from "@/lib/submissions/schemas";

type FieldErrors = Partial<Record<"displayName" | "email" | "publicationConsent" | "termsAccepted" | "photo" | "turnstile", string>>;

type PublicSubmissionFormProps = {
  instructionsId?: string;
  turnstile?: {
    enabled: boolean;
    siteKey: string | null;
    action: string;
  };
};

async function readApiResponse(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

async function fetchSubmissionApi(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
}

export function PublicSubmissionForm({
  instructionsId,
  turnstile = { enabled: false, siteKey: null, action: "public_submission_prepare" },
}: PublicSubmissionFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [publicationConsent, setPublicationConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<PublicApiError | null>(null);
  const [stage, setStage] = useState<SubmissionStage | null>(null);
  const [complete, setComplete] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetNonce, setTurnstileResetNonce] = useState(0);
  const requestTokenRef = useRef<string | null>(null);
  const compressionAbortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    compressionAbortRef.current?.abort();
    revokePreviewUrl(previewUrlRef.current);
  }, []);

  const replacePreviewUrl = (nextUrl: string | null) => {
    revokePreviewUrl(previewUrlRef.current);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  };

  const selectImage = async (file: File) => {
    compressionAbortRef.current?.abort();
    const controller = new AbortController();
    compressionAbortRef.current = controller;
    replacePreviewUrl(null);
    setPreparedImage(null);
    setPreparing(true);
    setPreparationProgress(0);
    setFieldErrors((current) => ({ ...current, photo: undefined }));
    setApiError(null);
    try {
      const prepared = await prepareImage(file, {
        signal: controller.signal,
        onProgress: setPreparationProgress,
      });
      if (controller.signal.aborted) return;
      setPreparedImage(prepared);
      replacePreviewUrl(URL.createObjectURL(prepared.file));
    } catch (error) {
      if (!controller.signal.aborted) {
        setFieldErrors((current) => ({
          ...current,
          photo: error instanceof ClientImageError ? error.message : "Please choose another photograph.",
        }));
      }
    } finally {
      if (!controller.signal.aborted) setPreparing(false);
    }
  };

  const removeImage = () => {
    compressionAbortRef.current?.abort();
    replacePreviewUrl(null);
    setPreparedImage(null);
    setPreparing(false);
    setPreparationProgress(0);
  };

  const focusErrors = () => window.setTimeout(() => {
    summaryRef.current?.focus();
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, 0);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stage || preparing) return;
    setApiError(null);

    const requestToken = requestTokenRef.current ?? generatePublicRequestToken();
    requestTokenRef.current = requestToken;
    const parsed = prepareSubmissionRequestSchema.safeParse({
      displayName,
      email,
      publicationConsent,
      termsAccepted,
      requestToken,
      preparedExtension: preparedImage?.extension,
      turnstileToken: turnstileToken ?? undefined,
    });
    const errors: FieldErrors = {};
    if (!preparedImage) errors.photo = "Choose and prepare one photograph.";
    if (turnstile.enabled && !turnstileToken) {
      errors.turnstile = "Complete the spam-protection check.";
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "displayName" || field === "email" || field === "publicationConsent" || field === "termsAccepted") {
          errors[field] ??= issue.message;
        }
      }
    }
    if (Object.keys(errors).length > 0 || !parsed.success || !preparedImage) {
      setFieldErrors(errors);
      focusErrors();
      return;
    }
    setFieldErrors({});

    try {
      setStage("Reserving private submission");
      const prepareResponse = await fetchSubmissionApi("/api/submissions/prepare", parsed.data);
      const prepareBody = await readApiResponse(prepareResponse);
      if (!prepareResponse.ok) throw publicApiErrorSchema.parse(prepareBody);
      const reservation = prepareSubmissionResponseSchema.parse(prepareBody);
      if (reservation.status === "pending_review") {
        setComplete(true);
        return;
      }

      if (reservation.uploadRequired && reservation.upload) {
        setStage("Uploading securely");
        const { error } = await createBrowserSupabaseClient()
          .storage.from(reservation.upload.bucket)
          .uploadToSignedUrl(
            reservation.upload.path,
            reservation.upload.token,
            preparedImage.file,
            { cacheControl: "3600", contentType: preparedImage.mimeType },
          );
        if (error) throw {
          success: false,
          code: "media_not_ready",
          message: "The secure upload did not finish. Your prepared photograph is still here—please retry.",
          retryable: true,
        } satisfies PublicApiError;
      }

      setStage("Verifying photograph");
      const finalizeResponse = await fetchSubmissionApi("/api/submissions/finalize", {
        submissionId: reservation.submissionId,
        requestToken,
      });
      const finalizeBody = await readApiResponse(finalizeResponse);
      if (!finalizeResponse.ok) throw publicApiErrorSchema.parse(finalizeBody);
      setStage("Finalising submission");
      finalizeSubmissionResponseSchema.parse(finalizeBody);
      setComplete(true);
    } catch (error) {
      const publicError = publicApiErrorSchema.safeParse(error);
      if (publicError.success && publicError.data.code === "already_submitted") {
        setComplete(true);
        return;
      }
      setApiError(publicError.success ? publicError.data : {
        success: false,
        code: "temporarily_unavailable",
        message: "Submissions are temporarily unavailable. Your details have not been sent.",
        retryable: true,
      });
      if (publicError.success && publicError.data.code === "draft_expired") {
        requestTokenRef.current = null;
      }
      window.setTimeout(() => summaryRef.current?.focus(), 0);
    } finally {
      setStage(null);
      if (turnstile.enabled) {
        setTurnstileToken(null);
        setTurnstileResetNonce((value) => value + 1);
      }
    }
  };

  if (complete) return <SubmissionSuccess />;
  const summaryMessages = [...Object.values(fieldErrors).filter(Boolean), apiError?.message].filter(Boolean) as string[];

  return (
    <form
      className="public-submission-form"
      ref={formRef}
      onSubmit={submit}
      noValidate
      aria-describedby={instructionsId}
    >
      <SubmissionErrorSummary
        title={apiError ? "We couldn’t complete the submission" : undefined}
        messages={[...new Set(summaryMessages)]}
        summaryRef={summaryRef}
      />

      <PhotoSelector
        preparedImage={preparedImage}
        previewUrl={previewUrl}
        isPreparing={preparing}
        preparationProgress={preparationProgress}
        error={fieldErrors.photo}
        onFile={selectImage}
        onRemove={removeImage}
      />

      <div className="submission-fields">
        <div className="form-field">
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            name="displayName"
            type="text"
            required
            autoComplete="name"
            maxLength={PUBLIC_SUBMISSION.displayNameMax}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            aria-invalid={Boolean(fieldErrors.displayName)}
            aria-describedby={fieldErrors.displayName ? "display-name-error" : undefined}
          />
          {fieldErrors.displayName ? <p id="display-name-error" className="field-error">{fieldErrors.displayName}</p> : null}
        </div>
        <div className="form-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={PUBLIC_SUBMISSION.emailMax}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={`email-help${fieldErrors.email ? " email-error" : ""}`}
          />
          <p className="field-help" id="email-help">{PUBLIC_SUBMISSION_COPY.emailHelp}</p>
          {fieldErrors.email ? <p id="email-error" className="field-error">{fieldErrors.email}</p> : null}
        </div>
      </div>

      <fieldset className="consent-fields">
        <legend>Your permission</legend>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={publicationConsent}
            onChange={(event) => setPublicationConsent(event.target.checked)}
            aria-invalid={Boolean(fieldErrors.publicationConsent)}
            aria-describedby={fieldErrors.publicationConsent ? "publication-consent-error" : undefined}
          />
          <span>{PUBLIC_SUBMISSION_COPY.publicationConsent}</span>
        </label>
        {fieldErrors.publicationConsent ? <p id="publication-consent-error" className="field-error">{fieldErrors.publicationConsent}</p> : null}
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            aria-invalid={Boolean(fieldErrors.termsAccepted)}
            aria-describedby={fieldErrors.termsAccepted ? "terms-error" : undefined}
          />
          <span>{PUBLIC_SUBMISSION_COPY.termsAcceptance} Read the <Link href="/campaign-terms">campaign terms</Link> and <Link href="/privacy">privacy notice</Link>.</span>
        </label>
        {fieldErrors.termsAccepted ? <p id="terms-error" className="field-error">{fieldErrors.termsAccepted}</p> : null}
      </fieldset>

      {turnstile.enabled && turnstile.siteKey ? (
        <TurnstileWidget
          siteKey={turnstile.siteKey}
          action={turnstile.action}
          resetNonce={turnstileResetNonce}
          error={fieldErrors.turnstile}
          onTokenChange={setTurnstileToken}
        />
      ) : null}

      {stage ? <SubmissionProgress stage={stage} /> : null}
      <button className="button button--primary submission-submit" type="submit" disabled={Boolean(stage) || preparing}>
        {apiError?.retryable ? <RotateCcw aria-hidden="true" size={18} /> : <ShieldCheck aria-hidden="true" size={19} />}
        {stage ? "Submitting securely…" : apiError?.retryable ? "Retry submission" : "Submit for private review"}
        {!stage && !apiError?.retryable ? <ArrowRight aria-hidden="true" size={18} /> : null}
      </button>
      <p className="submission-privacy-note">Your photograph stays private until the Mirchi team approves it.</p>
    </form>
  );
}
