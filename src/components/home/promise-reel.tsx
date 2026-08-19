"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";

import type { PromiseReelImage } from "@/types/campaign";

type PromiseReelProps = {
  images: readonly PromiseReelImage[];
};

type ReelSequenceProps = {
  images: readonly PromiseReelImage[];
  duplicate?: boolean;
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const reelImageSizes = {
  portrait: "(max-width: 639px) 145px, (max-width: 959px) 148px, (max-width: 1279px) 150px, 154px",
  square: "(max-width: 639px) 158px, (max-width: 959px) 162px, (max-width: 1279px) 165px, 168px",
  landscape: "(max-width: 639px) 176px, (max-width: 959px) 178px, (max-width: 1279px) 180px, 184px",
} as const;

function subscribeToHydration() {
  return () => undefined;
}

function subscribeToReducedMotion(callback: () => void) {
  const motionQuery = window.matchMedia(reducedMotionQuery);
  motionQuery.addEventListener("change", callback);
  return () => motionQuery.removeEventListener("change", callback);
}

function getReducedMotionPreference() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function ReelSequence({ images, duplicate = false }: ReelSequenceProps) {
  return (
    <div className="promise-reel__sequence" aria-hidden={duplicate || undefined}>
      {images.map((image) => (
        <figure
          className={`promise-ribbon__card promise-ribbon__card--${image.aspect}`}
          key={`${duplicate ? "duplicate-" : ""}${image.id}`}
        >
          {image.src.startsWith("/") ? (
            <Image
              src={image.src}
              alt={duplicate ? "" : image.alt}
              width={image.width}
              height={image.height}
              sizes={reelImageSizes[image.aspect]}
              loading="lazy"
            />
          ) : (
            // Already resized, stripped and published as an immutable public WebP by moderation.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt={duplicate ? "" : image.alt}
              width={image.width}
              height={image.height}
              loading="lazy"
            />
          )}
        </figure>
      ))}
    </div>
  );
}

export function PromiseReel({ images }: PromiseReelProps) {
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    () => true,
  );
  const [playbackOverride, setPlaybackOverride] = useState<boolean | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isPointerDown, setIsPointerDown] = useState(false);

  const isPlaying = playbackOverride ?? (isHydrated && !prefersReducedMotion);

  const isActive = isHydrated && isPlaying && !isHovered && !hasFocus && !isPointerDown;

  return (
    <div
      className="promise-reel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
      onPointerDown={() => setIsPointerDown(true)}
      onPointerUp={() => setIsPointerDown(false)}
      onPointerCancel={() => setIsPointerDown(false)}
    >
      <button
        className="promise-reel__control"
        type="button"
        hidden={!isHydrated}
        aria-label={isPlaying ? "Pause promise reel" : "Play promise reel"}
        title={isPlaying ? "Pause moving photographs" : "Play moving photographs"}
        onClick={() => setPlaybackOverride(!isPlaying)}
      >
        {isPlaying ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
      </button>

      <div
        className="promise-ribbon__viewport"
        aria-label="Scrollable campaign promise photographs"
        role="group"
        tabIndex={0}
      >
        <div
          className="promise-ribbon__track"
          data-enhanced={isHydrated}
          data-playing={isActive}
        >
          <ReelSequence images={images} />
          {isHydrated ? <ReelSequence images={images} duplicate /> : null}
        </div>
      </div>
    </div>
  );
}
