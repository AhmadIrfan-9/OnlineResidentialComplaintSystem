# Playwright RBAC Setup

## Required `.env` Values

Set these test credentials before running RBAC e2e tests:

```env
E2E_STUDENT_ID=
E2E_STUDENT_PASSWORD=
E2E_MANAGEMENT_ID=
E2E_MANAGEMENT_PASSWORD=
E2E_ADMIN_ID=
E2E_ADMIN_PASSWORD=
```

Optional:

```env
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
```

## Run

```bash
npm run test:e2e
```

UI mode:

```bash
npm run test:e2e:ui
```

