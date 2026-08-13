# Homepage Campaign Hero

## Visual direction

The homepage hero follows the supplied warm-ivory campaign reference as its primary visual target. It is assembled from responsive HTML, CSS and approved project assets; the reference screenshot is not embedded in the site.

The first viewport now uses this hierarchy:

1. Centered standalone Mirchi logo.
2. Small ruled `PRESENTS` label.
3. Two-line `Vriksha Bandhan` page title.
4. `It’s time to celebrate the ones who’ve always been there for us.` campaign tagline.
5. Existing tree-with-Rakhi campaign photograph.
6. Live rakhi-inspired promise counter.
7. `Tie a Rakhi to a Tree` and `How It Works` actions.
8. The existing Promises Already Taking Root reel attached to the hero canvas.

The global header is restored as a compact three-destination navigation for Home, Join and Movement Wall, with the primary `Tie a Rakhi to a Tree` action. The unsupported eyebrow, duplicate headline, supporting filler and generic dashboard-like counter remain absent.

## Desktop composition

At `960px` and wider the hero stage becomes a two-column editorial grid. The tall tree photograph occupies roughly two-fifths of the available width on the left. The logo, title, tagline, rakhi counter and actions form one centered campaign column on the right, while the reel spans the shell below them.

At 1440×900 the reel begins inside the first viewport and the complete hero stays close to one screen tall. The composition uses normal grid flow; only botanical line art and the decorative Rakhi image are positioned elements.

## Rakhi promise counter

`RakhiPromiseCounter` receives the existing typed `CampaignMetric`. It never owns or fabricates campaign data. The supplied premium Rakhi artwork is used only as an empty decorative frame with `alt=""`; the current count, target and metric label remain accessible HTML centered above it. The former CSS/SVG ring, thread, bead and tassel construction has been removed.

The component exposes a concise screen-reader label such as `27 of 983 trees celebrated.` When the public summary is unavailable it shows an em dash and explicitly announces that the count is unavailable while retaining the real configured target.

## Responsive behaviour

- Below `640px`, content follows an intentional mobile order: brand, title/tagline, 4:3 image, counter, actions and reel. The title uses fluid sizing and remains intact at 320px.
- From `640px` to `959px`, the stacked composition gains wider spacing and paired CTAs. The image remains capped at 560px rather than stretching across a portrait tablet.
- At `960px`, the image-left campaign grid starts. The title and counter scale independently of the image so 1024×768 remains balanced.
- At `1280px` and wider, the image and reel cards increase modestly while preserving the one-screen campaign overview.

The shell, reel viewport and document remain free of page-level horizontal overflow at 320, 360, 375, 390 and 430px.

## Promise Reel

The existing isolated client component is preserved. It still auto-travels slowly from right to left, pauses on hover/focus/direct manipulation, includes a visible Pause/Play button, starts paused for reduced-motion users and remains a static manually scrollable row without JavaScript. The duplicate sequence remains hidden from assistive technology.

The reel now sits inside the hero’s visual rhythm with quieter controls, low-shadow 4:3-style crops and a red/gold heading rule. Image-specific `sizes` values match each portrait, square and landscape card width at every breakpoint. Reel images remain lazy-loaded.

## Image and performance decisions

`/campaign/hero-tree-rakhi.webp` remains the stable project-owned hero asset. It is presented as a tall editorial crop on desktop and a shorter 4:3 crop on mobile, with softened right corners and no caption overlay. The image keeps explicit intrinsic dimensions, an accurate responsive `sizes` expression and Next.js 16 `preload`; it is not lazy-loaded and does not depend on a signed Supabase URL.

`/campaign/rakhi-counter-ornament.png` is a 1481×315 transparent decorative asset. Its empty padding was trimmed and its optimized committed source is approximately 260 KB. It loads eagerly without preload; the tree photograph remains the only preloaded LCP candidate.

Only the hero image is preloaded. The standalone Mirchi logo loads eagerly but is not separately preloaded, and the eight reel photographs retain native lazy loading. The hero and all data fetching remain Server Components; only the previously isolated Promise Reel has client state.

## Accessibility

The page keeps one H1, a logical mobile-first DOM order, meaningful image alternatives, an ignored decorative Rakhi image, text-based counter status, 44px-or-larger actions, visible focus indicators and the existing reduced-motion behaviour. Join links to `/join`; How It Works links to `/join#how-to-participate`; Movement Wall and legal routes remain reachable through the header and minimal footer.

## Public content simplification

The development-era campaign story, oversized pillars, duplicate participation block, first-moment feature, channel explainer, second movement gallery, Ped Ka Paigaam preview and repeated final CTA were removed from Home. The approved campaign promise is now one compact block below the existing Promise Reel. About and participation instructions live on `/join`, where they directly support submission.

## Visual review targets

The implementation is reviewed at 1440×900, 1366×768, 1280×800, 1024×768, 834×1194, 768×1024, 430×932, 390×844, 375×812, 360×800 and 320×568. Screenshots are temporary verification artifacts and are not committed.
