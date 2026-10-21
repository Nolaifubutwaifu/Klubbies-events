# SEO audit (20 Oct 2026): what's done and what's left

The audit itself is the PDF "Klubbies Events SEO audit, 20 October 2026" (not in the repo). Finding numbers (F1 to F26) and task numbers (1 to 21) below are the audit's.

## Done in code

| Item | Where | PR |
| --- | --- | --- |
| F1 site-wide noindex removed, private routes keep noindex | `app/layout.tsx`, `lib/seo.tsx` | #24 |
| F2, F3 robots.txt and sitemap.xml | `app/robots.ts`, `app/sitemap.ts` | #24 |
| F8 canonicals, `/index` redirect | `lib/seo.tsx`, `next.config.ts` | #24 |
| F12, F13 titles and descriptions | every public page | #24 |
| F21 Organization, WebSite, SoftwareApplication and FAQPage JSON-LD | `/`, `/faq` | #24 |
| F25 Open Graph, Twitter, share image | `app/opengraph-image.tsx` | #24 |
| F11 `lang="en-AU"` | `app/layout.tsx` | #24 |
| F14 "01For organisers" headings | `/features` | #24 |
| F14, F17 homepage H1 carries "event photo sharing" and "face search"; "facial recognition" in the intro, face search lead and consent FAQ | `components/site/Home.tsx`, `lib/copy/site.ts` | this PR |
| F18 `/brisbane`, "Based in Brisbane, QLD" in the footer | | this PR |
| F19 `/about` (first name only, contact form, no case studies yet) | | this PR |
| F20 `/conferences`, `/student-clubs`, `/photographers`, `/face-search-privacy`, each with its own FAQ and FAQPage JSON-LD | `components/site/ContentPage.tsx` | this PR |
| Task 17 three guides with Article JSON-LD, plus a `/guides` index | `app/(marketing)/guides` | this PR |
| F16 in-body links: pricing to student clubs, features and how it works to face search privacy, home to face search privacy, footer columns for every new page | | this PR |
| F15 alt text on the new pages' photos; hero and share kit visuals described | `components/site/parts.tsx` | this PR |
| F10 favicon.ico, apple-icon.png, 192 and 512 PNG manifest icons | `app/`, `public/` | this PR |
| F22 font preloads cut from seven to three (latin only, mono not preloaded; latin-ext files still load on demand) | `app/layout.tsx` | this PR |

New pages go in `PUBLIC_PATHS` (`lib/seo.tsx`) for the sitemap and get a card in `lib/copy/pages.ts`.

## Deliberately not done

- **Public email and phone (F19, F23).** The support address was taken off the site because of spam (`docs/decisions.md`, 109). Every page points to the contact form instead.
- **Instagram link and `sameAs` (F26).** Waiting on confirmation that @klubbies.events is the account to link.
- **Founder's full name in JSON-LD.** `/about` uses "Max" only.
- **Static homepage (F22).** Moving the signed-in redirect to `proxy.ts` isn't enough: the page also reads the user agent to hide prices inside the iPhone app, so it stays dynamic.
- **Case studies (task 18).** None exist yet. Add them once founding clubs agree to be named.

## Left for Max (outside the code)

1. Google Search Console: verify a Domain property for `klubbies.app`, submit `https://events.klubbies.app/sitemap.xml`, request indexing of `/`, `/how-it-works`, `/features`, `/pricing`, `/faq` and the new pages. Add the marketing manager as a user.
2. Bing Webmaster Tools: import from Search Console.
3. Instagram bio link to the site (use `?src=ig-bio`).
4. Link www.klubbies.app and events.klubbies.app to each other, and decide whether www.klubbies.app should be indexed (F5).
5. App Store listing: set the marketing and support URLs to the site once the app is approved.
6. Product Hunt and 3 to 5 Australian startup or SaaS directories, with the same name and "Brisbane, QLD".
7. Google Business Profile only as a service-area business, and only if Max meets organisers in person at events (F23).
8. Outreach for links from Brisbane uni clubs, student unions and event photographers (F24).
9. Weekly: Search Console Page indexing. After a month: Performance report and Keyword Planner volumes, then adjust titles (task 21).
