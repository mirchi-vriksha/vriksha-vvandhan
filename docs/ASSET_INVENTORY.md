# Asset Inventory

## Source material

| Source | Location | Notes | Temporary |
|---|---|---|---|
| Historical source deck `Mirchi X Vriksha Vvandhan.pptx` | `/Users/jaypandey/Downloads/` | Original development source; its filename retains the former spelling for provenance. Reviewed slide-by-slide and not copied into Git. | No |
| Extracted deck media | `.tmp/deck-inspection/media/` | Temporary, ignored working copy used to inspect `ppt/media`. | Yes |

## Selected production assets

Campaign photography originated in the authentic deck media and is shipped as loss-efficient WebP. Crops remove slide copy, UI frames and footer marks where possible. The sole generative edit is explicitly identified below; no external imagery or replacement Mirchi artwork was introduced.

| Production file | Original deck media | Dimensions | Intended usage | Temporary |
|---|---|---:|---|---|
| `public/brand/mirchi-logo.png` | `ppt/media/image2.png` | 324 × 137 | Header/footer authentic Mirchi identity | No |
| `public/campaign/hero-tree-rakhi.webp` | `ppt/media/image7.png` | 688 × 720 | Hero supporting image | No |
| `public/campaign/story-banyan.webp` | `ppt/media/image5.png` | 726 × 720 | Promise Ribbon | No |
| `public/campaign/child-hand-bark.webp` | `ppt/media/image6.png` | 560 × 720 | Promise Ribbon | No |
| `public/campaign/movement-rakhi-wide.webp` | `ppt/media/image9.png` | 1376 × 390 | Promise Ribbon | No |
| `public/campaign/first-rakhi-moment.webp` | `ppt/media/image10.png` | 730 × 675 | Promise Ribbon | No |
| `public/campaign/on-ground-school.webp` | `ppt/media/image12.png` | 445 × 430 | Promise Ribbon | No |
| `public/campaign/on-ground-community.webp` | `ppt/media/image12.png` | 480 × 430 | Promise Ribbon | No |
| `public/campaign/on-ground-youth.webp` | `ppt/media/image12.png` | 451 × 720 | Promise Ribbon | No |
| `public/campaign/guardian-preview.webp` | `ppt/media/image13.png`, surgically corrected with ImageGen | 621 × 700 | E2E-only private-review fixture; embedded certificate line corrected to “Vriksha Bandhan 2026” | No |
| `public/campaign/rakhi-tree-at-dusk.webp` | `ppt/media/image16.png` | 1376 × 360 | Promise Ribbon | No |
| `public/campaign/rakhi-counter-ornament.png` | Approved campaign artwork | 1481 × 315 | Decorative live-counter frame | No |
| `src/assets/certificate/vriksha-bandhan-certificate-master.png` | Corrected certificate master | 1492 × 1054 | New v2 certificate background | No |
| `src/app/opengraph-image.tsx` | Code-generated from live text and the authentic Mirchi PNG | 1200 × 630 | Open Graph and Twitter preview | No |
| `src/app/icon.svg` | Authored campaign UI motif | Scalable vector | Browser icon using abstract tree rings and Rakhi thread; not a brand logo | No |

## Brand status

The deck has one authentic standalone Mirchi PNG but no clean standalone Vriksha Bandhan wordmark. Full-slide raster composites are not treated as standalone logos. The UI therefore uses live HTML text for “Vriksha Bandhan” beside the unmodified Mirchi logo. The browser icon is an abstract tree-ring/Rakhi UI motif and is not treated as an approved campaign mark.

The certificate master, generated Open Graph image, Mirchi logo, favicon and every remaining campaign image were manually reviewed during the global rename. The certificate pixels now show Vriksha Bandhan. The E2E-only private-review fixture was corrected from an embedded “Vriksha Vandhan 2026” typo to “Vriksha Bandhan 2026” without changing its purpose. The code-generated social preview has no embedded former spelling or third-party watermark. Other campaign photographs and the counter ornament contain no campaign-name text. Deleted development-only imagery is no longer shipped.

No approved audio or video file was found.
