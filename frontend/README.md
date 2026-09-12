# Project Worlds frontend (React)

(Formerly "Personal World" — product renamed 2026-09-12; npm package
identifier unchanged.)

Tracked frontend for Project Worlds (P1 foundation). Built to `dist/` and
served by the backend in react mode (`PW_FRONTEND=react`; the P1 default
stays `legacy` until parity).

## Commands

```sh
npm ci          # clean install from package-lock.json
npm run dev     # vite dev server on :5173 (proxies /api, /healthz, /fonts, /companions, /icons to :8000)
npm run build   # tsc -b && vite build -> dist/
npm run test    # vitest run (jsdom)
npm run lint    # oxlint
```

## Notes

- Design truth lives in `design/tokens.json` (repo root); `src/tokens.css`
  is generated from it in T5 and is the only file where hex literals may
  appear.
- Icons are the tracked sprite (`/icons/sprite.svg`, served by the
  backend); no icon package is used.
- Fonts are self-hosted via the backend `/fonts/*` route; no external
  font requests are permitted (asserted by `src/test/deps.spec.ts`).
- `import.meta.env` may only ever carry `VITE_API_URL` — never a
  credential (public-repository boundary, `SECURITY.md`).