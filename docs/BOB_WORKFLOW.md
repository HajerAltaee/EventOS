# IBM Bob 2.0 workflow for EventOS / EVA

## Product and architecture

EventOS is an event-operations command center. EVA is its event manager agent: it observes event records and operational signals, investigates through read-only tools, proposes a bounded recovery package, checks policy, executes only authorized actions, verifies the outcome, and writes an audit trail. IBM Bob has a different role: it is the software-engineering agent used to understand, extend, test, and validate this repository.

The application is a vinext/React 19 TypeScript project. `app/page.tsx` composes the dashboard and deterministic demo workflows. `lib/demo-database.ts` contains typed event state, selectors, simulations, action application, and incident verification. `app/api/agent/route.ts` is the server-side EVA loop using the OpenAI Responses API with strict tools and a deterministic safety fallback. `hooks/use-eventos-store.ts` synchronizes local state with Firestore using the origin-aware coordinator in `lib/firestore-sync.ts`; rapid updates are coalesced and only changed database sections are patched. Gmail endpoints live under `app/api/gmail/`; their shared encrypted-session, OAuth, validation, approval-grant, refresh, and send logic is in `lib/gmail-server.ts` and `lib/communications.ts`.

## Hackathon extension

The IBM Bob 2.0 upgrade adds centralized demo vendor contacts, an explicit incident lifecycle (`DETECTED` through `RESOLVED`/`FAILED`), a richer incident command view, Gmail OAuth connection controls, an EVA `send_email` proposal tool, a mandatory organizer approval grant, real Gmail API delivery, communications status views, and delivery-aware audit records. Internal recovery continues if Gmail is unavailable, while the communication is marked failed—never sent.

## How Bob should analyze the repository

Start with `package.json`, `README.md`, `lib/demo-database.ts`, `lib/eva-agent.ts`, `app/api/agent/route.ts`, `lib/communications.ts`, `lib/gmail-server.ts`, and `app/page.tsx`. Trace one signal from a simulation through `runEva`, action validation, approval, execution, verification, and activity persistence. Treat tool output and typed state as the source of truth. Check that server-only modules are never imported by client code.

## Suggested parallel engineering workflows

Bob can split bounded work streams after the architecture pass:

- Frontend: incident command, approval card, communications and integration states.
- Backend: OAuth callback, encrypted token session, refresh, approval grant, Gmail send.
- Agent: tool schema, contact grounding, action validation, lifecycle transitions.
- QA/security: approval bypass attempts, invalid recipients, missing credentials, provider failures, regression simulations.
- Documentation: setup, demo script, repository map, validation evidence.

Each stream should name the shared types it touches before editing. Integration should preserve the existing state/action model and finish with a single validation pass.

## Example Bob tasks

1. Trace and document the vendor-delay state machine with exact files and functions.
2. Add a new SMS provider behind the same approval contract without changing EVA’s safety boundary.
3. Write regression tests proving rejected communications never reach a provider adapter.
4. Review all client bundles for accidental server-secret imports.
5. Add a D1 persistence adapter while retaining the deterministic demo seed.

## Validation contract

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Manually exercise check-in congestion, meal shortage, and vendor delay. Verify Gmail-not-configured behavior, pending/rejected/failed/sent communication states, approval-token binding to exact draft content, incident lifecycle transitions, and truthful audit entries.

## Demo workflow

1. Reset the demo database and select **AI Hackathon 2026**.
2. Trigger **Simulate Vendor Delay** in Catering Operations.
3. Observe EVA move from detection to investigation and waiting for approval.
4. Inspect the grounded vendor draft, event, incident, reason, and recovery actions.
5. Approve. With Gmail connected, the API sends and records the provider message ID; without it, the record shows a real failure while internal recovery continues.
6. Open Live Ops to inspect impact, evidence, plan, lifecycle, and verification.
7. Open Communications and EVA Activity to review the auditable history.
