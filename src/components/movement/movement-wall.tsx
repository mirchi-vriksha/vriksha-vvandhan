"use client";

import { useRef, useState } from "react";
import { CalendarDays, ImageIcon, X } from "lucide-react";

import type { PublicMovementEntry } from "@/lib/public-campaign/data";

export function MovementWall({ initialEntries }: { initialEntries: PublicMovementEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<PublicMovementEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(initialEntries.length < 24);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  function open(entry: PublicMovementEntry, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setSelected(entry);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  function close() {
    dialogRef.current?.close();
    setSelected(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  async function loadMore() {
    const last = entries.at(-1);
    if (!last || loading) return;
    setLoading(true);
    setError(false);
    try {
      const query = new URLSearchParams({
        beforePublishedAt: last.published_at,
        beforeGuardianNumber: String(last.guardian_number),
      });
      const response = await fetch(`/api/movement?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load_failed");
      const payload = (await response.json()) as { entries: PublicMovementEntry[] };
      const known = new Set(entries.map((entry) => entry.guardian_number));
      const additions = payload.entries.filter((entry) => !known.has(entry.guardian_number));
      setEntries((current) => [...current, ...additions]);
      setEnded(additions.length < 24);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="movement-empty">
        <ImageIcon aria-hidden="true" />
        <h2>No moments of gratitude are public yet.</h2>
        <p>The wall is just beginning.</p>
      </div>
    );
  }

  return (
    <>
      <div className="movement-wall" aria-live="polite">
        {entries.map((entry) => (
          <article className="movement-card" key={entry.guardian_number}>
            <button type="button" onClick={(event) => open(entry, event.currentTarget)} aria-label={`Open Guardian ${entry.guardian_number} photograph`}>
              {/* Public, pre-sized immutable WebP generated during moderation. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.card_url} alt={entry.alt_text} width={entry.card_width} height={entry.card_height} loading="lazy" />
            </button>
            <div>
              <p>Guardian #{entry.guardian_number}</p>
              <h2>{entry.display_name}</h2>
              <span><CalendarDays size={15} aria-hidden="true" />{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(entry.published_at))}</span>
            </div>
          </article>
        ))}
      </div>
      {!ended && (
        <div className="movement-load-more">
          <button className="button button--light" type="button" disabled={loading} onClick={loadMore}>
            {loading ? "Loading moments…" : error ? "Retry loading" : "Load more moments"}
          </button>
          {error && <p role="alert">The next promises could not be loaded. Please try again.</p>}
        </div>
      )}
      <dialog className="movement-dialog" ref={dialogRef} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <button className="movement-dialog__close" type="button" onClick={close} aria-label="Close photograph"><X aria-hidden="true" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.full_url} alt={selected.alt_text} width={selected.full_width} height={selected.full_height} />
            <p>Guardian #{selected.guardian_number} · {selected.display_name}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
