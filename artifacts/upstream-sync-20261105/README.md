# Upstream merge: v0.4.5

- Upstream: `haowang02/cpa-plugin-codex-candy-eval`, `1dc8d25` (v0.4.5).
- Previous local source: `d23b528`; merged into `main`, version `0.4.5-omc.1`.
- Adopt upstream retry/cancellation runners, schema v2 history, updated detector,
  Codex context, and browser storage decoding. OMC uses the new endpoints and
  `credential_ids`/`credentials` contract; no legacy API aliases are provided.
- Preserve OMC identity, React/theme/static caching, priority ordering, live-host
  cooldown decisions, and Ciallo grading with independent history clearing.
  Both pelican variants are selectable, with their corresponding prompts.
- Validation: `npm ci --prefix web`, frontend typecheck/build,
  `node scripts/test-react.mjs`, `node scripts/test-components.cjs`,
  `node scripts/test-theme.cjs`, `go vet ./...`, `go test -race ./...`.
  All passed against local synthetic fixtures; no production evaluations ran.
  Additional release preflight: `node scripts/test-ui.cjs` passed too.
- Compatibility: history migration retains candy/Ciallo, fingerprint and pelican
  records and writes the original state beside the live file as `.v0.json`.
  An older plugin cannot read schema v2; reverting after a future rollout requires
  restoring its matching pre-migration state too. New records would remain only
  in the saved v2 state. Older clients must move to the new API.
- Deployment: none. No release, server changes, restart, or remote push performed.
  This directory records source integration only; deployment requires separate
  host-specific validation and authorization.
