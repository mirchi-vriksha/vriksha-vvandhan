"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  action: string;
  resetNonce: number;
  error?: string;
  onTokenChange: (token: string | null) => void;
};

export function TurnstileWidget({
  siteKey,
  action,
  resetNonce,
  error,
  onTokenChange,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const api = window.turnstile;
    if (!scriptReady || !container || !api) return;

    const widgetId = api.render(container, {
      sitekey: siteKey,
      action,
      theme: "light",
      size: "flexible",
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(null),
      "error-callback": () => onTokenChange(null),
    });
    return () => {
      api.remove(widgetId);
      onTokenChange(null);
    };
  }, [action, onTokenChange, resetNonce, scriptReady, siteKey]);

  return (
    <div className="turnstile-field">
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <p className="turnstile-field__label">Spam protection</p>
      <div ref={containerRef} className="turnstile-field__widget" aria-describedby={error ? "turnstile-error" : undefined} />
      <p className="field-help">Complete the privacy-preserving check before submitting.</p>
      {error ? <p id="turnstile-error" className="field-error">{error}</p> : null}
    </div>
  );
}
