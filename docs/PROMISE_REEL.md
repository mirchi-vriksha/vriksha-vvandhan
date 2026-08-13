# Section 1.2 Promise Reel

## Intent

The “Mumbai’s growing wall of gratitude” strip is a slow editorial film reel that carries several campaign photographs from right to left. It extends the existing light hero without changing the masthead, tracker, hero image, actions or downstream sections.

## Architecture

`PromiseRibbon` remains a Server Component and owns the section heading plus the typed campaign image collection. It passes serializable `PromiseReelImage` records to `PromiseReel`, the only new Client Component. The client boundary is limited to playback state, reduced-motion detection and hover, focus and pointer interruption.

The reel uses no carousel or motion dependency. Two identical flex sequences share one CSS transform animation. The second sequence is `aria-hidden`; its images use empty alternative text. Translating exactly one sequence plus the inter-sequence gap produces the continuous seam.

## Progressive enhancement

The server response contains one complete, keyboard-focusable, horizontally scrollable image sequence. Before hydration there is no animation and the inactive control is hidden. If JavaScript is unavailable, all eight photographs remain visible through native horizontal scrolling with no duplicated accessible content.

After hydration, the duplicate sequence is added and the transform animation starts when the operating system does not request reduced motion. The page, hero and ribbon heading remain server-rendered.

## Playback behavior

- Default motion is a calm linear right-to-left translation over 46 seconds.
- Pointer hover pauses playback until the pointer leaves.
- Keyboard focus inside the image viewport pauses playback until focus leaves.
- Pointer or touch contact pauses playback while direct manipulation is active.
- The visible Pause/Play button sets an explicit user override.
- `prefers-reduced-motion: reduce` starts with the reel paused and a visible Play control; an explicit Play action can opt back into the reel.
- The native viewport remains horizontally scrollable and never widens the document.

## Content and accessibility

`heroPromiseImages` is a typed `PromiseReelImage[]` collection with stable IDs, intrinsic dimensions, meaningful alternative text and a controlled portrait, square or landscape aspect class. The control has a changing accessible label, the original sequence remains the only semantic image set, focus styles are preserved and the animation does not rotate or flip cards.
