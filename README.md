# Noyron website

Static, multi-page site. No build step. Hosted on GitHub Pages.

## Site map and flow
Each page ends with a "Next" hand-off to the following page, so a reader can go start to finish.

| # | Page | File | Job | Sections |
|---|------|------|-----|----------|
| 01 | Home | `index.html` | The whole story in 90 seconds | Hero (4 scenes incl. live 3D) · Mission · Problem / why now · Engine (summary) · Inside a design (scroll story) · Applications (teaser) · Progress (teaser) · Work with us |
| 02 | Technology | `technology.html` | How it works, and why it can be trusted | The loop · Verification tiers · Control room · Principles · Learning |
| 03 | Applications | `applications.html` | What it designs | Cold plates · Heat exchangers · Propulsion · Assemblies (problem / what the engine does / where it stands) |
| 04 | Progress | `progress.html` | Honest status | Numbers · Verified vs not yet · Roadmap |
| 05 | Company | `company.html` | Why we exist, who we need | Mission · Why now · How we work · Team · Open roles |
| 06 | Contact | `contact.html` | Convert | Design partners · Investors · Founding team |

Every teaser on Home links to its deep page; every deep page links back through the nav, the footer and the next-page hand-off.

## Files
- `assets/site.css`: the design system (tokens, 12-column grid, components). One file for all pages.
- `assets/site.js`: shared shell. **Edit `CONFIG` (name, email) and `PAGES` (order, titles) here**; nav, footer and hand-offs update everywhere.
- `engine.js`: the 3D thrust-chamber model (three.js from a CDN).
- `assets/*.mp4|jpg`: NASA public-domain footage, cut and graded.

## To fill in before launch
- Contact email in `assets/site.js` (`CONFIG.email`).
- Founder name, photo and bio in `company.html` (Team section).
- Brand name, if it changes: `CONFIG.brand`.

## Preview locally
The 3D model loads as a module, so use a local server: `python3 -m http.server 8000` in this folder, then open http://localhost:8000.

## Publish on GitHub Pages
Push this folder to a repo, then Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
