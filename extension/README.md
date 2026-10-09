# SkillSync Chrome Extension

Manifest V3 popup (React + TypeScript + Vite). It talks **only** to the SkillSync
backend: it never calls SerpApi or an AI provider and never computes scores.

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend origin (`/api` is appended) |
| `VITE_WEB_URL` | `http://localhost:3000` | Target of the "View Full Web Dashboard" link |

If the API origin is not localhost, also add it to `host_permissions` in
`public/manifest.json`. These values are bundled into the extension and are
public: never put provider keys or secrets in them.

## Development

```
npm install
npm run build     # type-checks, then builds dist/ (load it at chrome://extensions)
npm run lint
npm test          # parser, popup behaviour and page-detection tests
```

## How profile reading works

* **LinkedIn profiles** (`linkedin.com/in/...`) are read by `src/content/linkedin/parse.ts`,
  with two strategies. The *structural* one finds sections by their heading ("Experience",
  "Education", ...) and reads LinkedIn's screen-reader-duplicated `aria-hidden` lines. If the
  page has no such markup, the *text* strategy (`lines.ts`, `textParse.ts`) reads only the
  visible lines of text, finds section titles as standalone lines, and locates each entry by
  its date range (or its "Issued ..." line). Neither uses CSS class names, which LinkedIn
  renames often. The diagnostic report says which strategy supplied the data. It is unit-tested against synthetic pages that reproduce this
  structure. **It cannot be verified against the live site from CI**, so if LinkedIn changes
  its markup and a section stops being read, the popup says so ("Copy diagnostic details"
  lists which sections were found, counts only, no profile text).
* LinkedIn shows most skills on a separate "Show all skills" page. Skills are collected from
  the Skills section and from skills named on experience entries; a profile with few of
  either will have a short skills list. Add the rest on the dashboard Profile page.
* **Other websites** only capture the page title and text (no skills), and replace your saved
  profile, so the popup asks for explicit confirmation first.
* A profile with neither a headline nor a job title is never saved, because the backend
  cannot build job searches from it.

## Startup speed

The popup paints from a local snapshot of your last result (`chrome.storage.local`, no token
inside) and revalidates `/auth/me` and `/analysis/latest` in parallel in the background. When
logged out it makes no network calls at all. The snapshot and token are cleared on logout and
on any 401.

## API contract

See `docs/api-contract.md`. Response types live in `src/types/api.ts`
(guarded against backend drift by `backend/tests/test_client_contract.py`);
profile limits in `src/api/profilePayload.ts` mirror the backend schema.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
