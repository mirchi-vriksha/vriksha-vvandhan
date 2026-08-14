"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

import type { QueueSubmission } from "@/lib/moderation/data.server";

type ThumbnailResponse = {
  thumbnails?: Record<string, string | null>;
};

const inFlightThumbnailRequests = new Map<string, Promise<Record<string, string | null>>>();

function requestQueueThumbnails(submissionIds: readonly string[]) {
  const key = submissionIds.join(",");
  const existing = inFlightThumbnailRequests.get(key);
  if (existing) return existing;
  const request = fetch("/api/admin/review-thumbnails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionIds }),
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("thumbnail_signing_failed");
      const body = await response.json() as ThumbnailResponse;
      return Object.fromEntries(submissionIds.map((id) => [id, body.thumbnails?.[id] ?? null]));
    })
    .finally(() => inFlightThumbnailRequests.delete(key));
  inFlightThumbnailRequests.set(key, request);
  return request;
}

function QueueThumbnail({
  submission,
  signedUrl,
  loaded,
  onLoad,
  onError,
}: {
  submission: QueueSubmission;
  signedUrl: string | null | undefined;
  loaded: boolean;
  onLoad: () => void;
  onError: () => void;
}) {
  if (!submission.thumbnailAvailable || signedUrl === null) {
    return <span className="admin-thumbnail admin-thumbnail--empty" aria-label="Private preview unavailable">Leaf</span>;
  }
  if (signedUrl === undefined) {
    return <span className="admin-thumbnail admin-thumbnail--skeleton" aria-hidden="true" />;
  }
  return (
    <span className="admin-thumbnail-frame">
      {!loaded && <span className="admin-thumbnail admin-thumbnail--skeleton" aria-hidden="true" />}
      <img
        className={`admin-thumbnail admin-thumbnail--image${loaded ? " is-loaded" : ""}`}
        src={signedUrl}
        alt="Private submission preview"
        width="96"
        height="120"
        loading="lazy"
        decoding="async"
        onLoad={onLoad}
        onError={onError}
      />
    </span>
  );
}

export function SubmissionQueueTable({
  submissions,
  labels,
}: {
  submissions: readonly QueueSubmission[];
  labels: Record<string, string>;
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loadedIds, setLoadedIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const submissionIds = submissions
      .filter((item) => item.thumbnailAvailable)
      .map((item) => item.id);
    if (!submissionIds.length) return;
    let active = true;

    void requestQueueThumbnails(submissionIds)
      .then((response) => {
        if (active) setUrls(response);
      })
      .catch(() => {
        if (active) setUrls(Object.fromEntries(submissionIds.map((id) => [id, null])));
      });

    return () => { active = false; };
  }, [submissions]);

  function markLoaded(id: string) {
    setLoadedIds((current) => new Set(current).add(id));
  }

  function markUnavailable(id: string) {
    setUrls((current) => ({ ...current, [id]: null }));
  }

  return <div className="admin-queue">
    <div className="admin-queue__header" aria-hidden="true"><span>Photo</span><span>Participant</span><span>Status and age</span><span>Guardian</span><span>Action</span></div>
    <ul>{submissions.map((item) => <li className="admin-queue__item" key={item.id}>
      <QueueThumbnail submission={item} signedUrl={urls[item.id]} loaded={loadedIds.has(item.id)} onLoad={() => markLoaded(item.id)} onError={() => markUnavailable(item.id)} />
      <div className="admin-queue__participant"><strong>{item.display_name ?? "Draft"}</strong><small>{item.source.replaceAll("_", " ")}{item.is_test && <em> · Test record</em>}</small></div>
      <div className="admin-queue__status"><span className={`status-badge status-badge--${item.status}`}>{labels[item.status] ?? item.status}</span><small>{item.submittedLabel ? `${item.submittedLabel} · ${item.reviewAgeHours ?? 0}h in queue` : "Awaiting timestamp"}</small></div>
      <div className="admin-queue__guardian"><span>Guardian</span><strong>{item.guardian_number ? `#${item.guardian_number}` : "Not assigned"}</strong></div>
      <a className="admin-queue__action" href={`/admin/submissions/${item.id}`}>Open submission</a>
    </li>)}</ul>
  </div>;
}
