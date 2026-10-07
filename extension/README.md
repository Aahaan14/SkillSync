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
