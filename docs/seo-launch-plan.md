# Mirchi Vriksha Bandhan SEO launch plan

Research date: 21 August 2026
Canonical domain: `https://mirchivrikshabandhan.online`

## Search opportunity

Current search results for Vriksha Bandhan and tying Rakhis to trees in Mumbai are led by news coverage and older campaigns. An exact `site:mirchivrikshabandhan.online` search returned no indexed result during this audit. The clearest opportunity is to make the Mirchi campaign the authoritative result for its own brand and the most useful participation result for Mumbai.

Priority search themes:

1. **Brand intent:** Mirchi Vriksha Bandhan, Vriksha Bandhan by Mirchi, 98.3 Mirchi Vriksha Bandhan.
2. **Participation intent:** tie a Rakhi to a tree, Rakhi for trees Mumbai, join Vriksha Bandhan, become a Vriksha Guardian.
3. **Informational intent:** what is Vriksha Bandhan, eco-conscious Raksha Bandhan celebration, tree protection campaign Mumbai.

Do not target unrelated commercial Rakhi-shopping terms or promise tree plantation when the campaign action is to celebrate and protect existing trees. Relevance is more valuable than keyword volume.

## Page map

| Page | Primary search job | Indexing rule |
| --- | --- | --- |
| `/` | Explain Mirchi Vriksha Bandhan, its Mumbai purpose and why people tie Rakhis to trees | Index, follow; highest sitemap priority |
| `/join` | Answer participation intent and convert visitors into Vriksha Guardians | Index, follow |
| `/movement` | Show original community proof and approved campaign moments | Include in sitemap only while the wall is enabled |
| `/privacy`, `/campaign-terms` | Provide trust and legal information | Noindex, follow; excluded from sitemap |
| `/admin`, `/api`, `/auth`, `/vendor` | Private or machine-only routes | Blocked from crawling |

## Implemented foundation

- Stable canonical URLs on the purchased domain, independent of Vercel preview aliases.
- Search-focused titles and descriptions for Home, Join and Movement Wall.
- Crawl rules, XML image sitemap and web app manifest.
- Organization, WebSite, WebPage, FAQ, Breadcrumb and HowTo structured data.
- Server-rendered explanatory content, participation FAQs, internal links and tree-safe guidance.
- Optional Google HTML-tag verification through `GOOGLE_SITE_VERIFICATION`.
- Responsive content layout and one clear H1 per public page.

## Launch sequence

1. Connect the apex domain to the production Vercel project and make it the primary domain.
2. Redirect `www`, `vriksha-bandhan.vercel.app` and any old public alias to the apex domain with permanent redirects. Do not serve duplicate copies.
3. Set production `NEXT_PUBLIC_SITE_URL=https://mirchivrikshabandhan.online` and deploy this SEO release.
4. Confirm `/`, `/join`, `/robots.txt`, `/sitemap.xml` and `/manifest.webmanifest` return 200 on the public domain. Confirm `/admin` and `/auth` remain noindex/private.
5. Create a Google Search Console **Domain property** and add Google’s exact DNS TXT record at the domain provider. DNS verification does not require `GOOGLE_SITE_VERIFICATION`.
6. Alternatively, for a URL-prefix property using Google’s HTML-tag method, set `GOOGLE_SITE_VERIFICATION` to the tag’s `content` value, redeploy, and then verify.
7. Submit `https://mirchivrikshabandhan.online/sitemap.xml` in Search Console.
8. Use URL Inspection to test and request indexing for `/` and `/join`. Request `/movement` only when it is publicly enabled.
9. Link the canonical domain from Mirchi’s official site, social profiles, campaign posts and genuine press coverage. Use descriptive anchor text such as “Mirchi Vriksha Bandhan” rather than generic “click here”.

## Ongoing content and measurement

- Publish original campaign updates rather than thin keyword pages: launch story, selected Vriksha Guardian stories, neighbourhood participation and a post-campaign impact recap.
- Keep approved Movement Wall images descriptive and compressed; retain useful alt text.
- Review Search Console weekly during the campaign for indexing, search terms, click-through rate and mobile usability.
- Improve titles or page copy from real Search Console queries. Do not manufacture location pages or repeat keywords unnaturally.
- Preserve working URLs after the campaign. Replace time-sensitive calls to action with a campaign recap instead of deleting pages that have earned links.

Google does not guarantee indexing or a ranking position. This implementation makes the site eligible, understandable and discoverable; deployment, domain verification, useful original content and authoritative links determine how quickly and how prominently it appears.

## Research references

- Google Search Central: SEO Starter Guide — https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Search Central: SEO Guide for Web Developers — https://developers.google.com/search/docs/fundamentals/get-started-developers
- Google Search Central: Build and submit a sitemap — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- NDTV: Vriksha Bandhan at Mumbai's Aarey Forest — https://www.ndtv.com/video/vriksha-bandhan-marks-rakhi-at-mumbai-s-aarey-forest-598908
- Hindustan Times: Mumbai citizens tie Rakhis to trees — https://www.hindustantimes.com/cities/mumbai-news/citizens-tie-rakhis-around-trees-to-be-cut-in-matunga-101675619698498.html
