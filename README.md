# EventOS 2.0 · EVA Operations Command Center

EventOS is an event-operations dashboard with EVA, an AI event manager that monitors live event data, investigates incidents, creates permission-aware recovery plans, executes authorized internal actions, verifies outcomes, and records an audit trail. External Gmail communication is always drafted first and requires explicit organizer approval.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open the local URL printed by vinext. The deterministic demo works without credentials; missing integrations are shown honestly and do not crash the workflow.

Event state is synchronized to the authenticated Firestore document `eventos/live-operations`. Listener-originated snapshots are never echoed back, rapid lifecycle changes are coalesced, and only changed top-level database sections are patched.

## Server configuration

`OPENAI_API_KEY` and `EVA_MODEL` enable the Responses API. Without them EVA uses visible, validated fallback rules.

For Gmail, create a Google OAuth 2.0 Web application, enable the Gmail API, and set the four server-only values in `.env.local`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and a random 32+ character `GMAIL_SESSION_SECRET`. Add the exact redirect URI to the OAuth client. No secret uses a `VITE_` prefix and no OAuth token is exposed to client JavaScript.

## Validate

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Two-minute demo

Select **AI Hackathon 2026**, open **Catering Operations**, and choose **Simulate Vendor Delay**. EVA inspects the operational state, creates a recovery package and vendor email draft, and waits for approval. Review the complete draft in EVA, choose **Approve & send**, then inspect **Live Ops**, **Communications**, and **EVA Activity** for lifecycle, delivery truth, verification, and audit history.

See [docs/BOB_WORKFLOW.md](docs/BOB_WORKFLOW.md) for the repository map and IBM Bob engineering workflow.
