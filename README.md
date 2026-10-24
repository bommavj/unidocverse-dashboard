# UniDocVerse Dashboard

> **Angular 18 document intelligence UI** — research chat with streaming SSE, document explorer, analytics, approval queue, and 10+ vertical-specific workspaces. Connects to the UniDocVerse Service backend.

[![Angular](https://img.shields.io/badge/Angular-18-red)](https://angular.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![Angular Material](https://img.shields.io/badge/Angular%20Material-18-purple)](https://material.angular.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue)](../LICENSE)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21880388.svg)](https://doi.org/10.5281/zenodo.21880388)

---

## What it does

UniDocVerse Dashboard is the frontend for a multi-tenant document intelligence platform. It provides:

- **Research chat** — SSE-streamed responses from the ReAct agent, with Load More pagination for page-by-page document traversal
- **Document explorer** — folder-based view with domain badges (AR, COI, NDA, PAY, HR, …), upload, status tracking, and re-processing
- **Analytics hub** — per-document analytics, query history, cross-document insights
- **Approval queue** — HITL approval interface for agent-generated actions (create client, update policy, flag anomaly)
- **Agent queue** — live view of ReAct agent runs with trace inspection
- **10+ vertical workspaces** — Insurance, Finance, Legal, HR, Healthcare, Real Estate, Supply Chain, Immigration, Claims, CLM pipeline

---

## Pages

| Route | Description |
|---|---|
| `/documents` | Document explorer with folder nav, upload, status badges |
| `/research` | Streaming research chat with document selection |
| `/research-history` | Past research sessions |
| `/analytics` | Document analytics dashboard |
| `/analytics-hub` | Cross-document analytics and insights |
| `/approvals` | HITL approval queue |
| `/agent-builder` | ReAct agent run queue and trace viewer |
| `/insurance` | Insurance-specific workspace (policies, COIs, claims) |
| `/finance` | Finance workspace (invoices, pay stubs, annual reports) |
| `/legal` | Legal workspace (contracts, NDAs, matters) |
| `/hr` | HR workspace |
| `/healthcare` | Healthcare workspace |
| `/real-estate` | Real estate workspace |
| `/supply-chain` | Supply chain workspace |
| `/immigration` | Immigration workspace |
| `/claims` | Claims management |
| `/clm` | Contract lifecycle management pipeline |
| `/audit` | Audit log viewer |
| `/settings` | Tenant settings |

---

## Tech stack

| | Technology |
|---|---|
| Framework | Angular 18 (standalone components) |
| UI library | Angular Material 18, Angular CDK |
| Charts | Chart.js + ng2-charts |
| PDF export | jsPDF + jsPDF-autotable |
| Streaming | EventSource (SSE) — research responses stream token-by-token |
| HTTP | Angular HttpClient with interceptors |
| Build | Angular CLI, esbuild |

---

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+
- UniDocVerse Service running on `http://localhost:8000`

### Install

```bash
git clone https://github.com/bommavj/unidocverse-dashboard
cd unidocverse-dashboard
npm install
```

### Dev server

```bash
ng serve
# Open http://localhost:4200
```

The dev server proxies `/api/*` to `http://localhost:8000`. Configure in `proxy.conf.json` if your backend is on a different host.

### Production build

```bash
ng build --configuration=production
# Output: dist/unidocverse-dashboard/
```

Serve the `dist/` folder from any static host (S3 + CloudFront, Nginx, etc.).

---

## Research chat — how streaming works

The research component opens an `EventSource` connection to `/api/research/ask`. Each SSE event is one of:

```
data: {"type": "token",   "content": "The document shows..."}
data: {"type": "token",   "content": " revenue of $2.1B"}
data: {"type": "done",    "session_id": "...", "has_more": true, "page": 0}
```

When `has_more: true`, a **Load More** button appears. Clicking it posts `{question, page: currentPage + 1, doc_ids}` and appends the next batch of pages under a `📄 Additional Details — Page N` label.

Page-by-page traversal ("give me the page by page information") uses `ORDER BY page_number ASC` — not similarity search — so pages appear in document order, 20 chunks per SSE page.

---

## Document type badges

Each document gets a 2-3 character badge based on classified `doc_type`:

| Badge | Document type |
|---|---|
| `AR` | Annual Report / 10-K |
| `COI` | Certificate of Insurance |
| `NDA` | Non-Disclosure Agreement |
| `PAY` | Pay Stub |
| `INV` | Invoice |
| `LES` | Lease Agreement |
| `CLM` | Claim |
| `HR` | HR document |
| `DOC` | Generic document |
| `ERR` | Processing failed |

---

## Connecting to the backend

Set the API base URL in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000'
};
```

For production, set `environment.production.ts` to point to your deployed service URL.

---

## License

UniDocVerse Dashboard is licensed under the [Apache License 2.0](LICENSE). Copyright 2024–2026 Vijay Kumar Bomma.

Redistributions and derivative works must keep the attribution in [NOTICE](NOTICE). "UniDocVerse" and the UniDocVerse logo are trademarks of Vijay Kumar Bomma and are not licensed for use by others.

To cite this software, use the **Cite this repository** button or [CITATION.cff](CITATION.cff) (DOI [10.5281/zenodo.21880388](https://doi.org/10.5281/zenodo.21880388)).
