# Clouvider Ciallo repair

- Source: `720df18c85d1e91774bbb0c54700a8662e15e20e`, tag `v0.4.5-omc.2`.
  The full source and embedded UI were committed before building the deployment
  library. The deployed Linux/amd64 c-shared library was built locally with Zig
  targeting glibc 2.17 and checksum-verified on upload. Exact hash, source and
  rollback locator are in [deployment.json](deployment.json).
- [Release workflow 41954319626](https://github.com/Yorick-Ryu/cpa-plugin-codex-candy-eval/actions/runs/41954319626):
  tests, all five platform builds and publishing succeeded. Its release assets
  are separate builds of the same commit; do not confuse their file hashes with
  the actual locally built deployment library's hash.
- Validation: Go vet/race, frontend typecheck/build and React/component/theme/UI
  checks passed. Initial all-package Go discovery overlapped npm ci and failed
  while npm replaced node_modules; the subsequent full check passed after npm
  finished. No remaining test failures.
- Hot replacement corrected all three previously misgraded completed historical
  replies. The persisted history file checksum was unchanged at replacement;
  only copied API projections use the new rule. Error/skipped records, candy,
  fingerprint and pelican history were verified unchanged.
- Browser: refreshed `v0.4.5-omc.2`, Ciallo tab shows all three original history
  entries as passing; rule description and passing-rate labels are correct.
- One authorized production smoke test: GPT-6-Astra/low Ciallo completed in 3.368s
  on its first attempt with `pass`, stored successfully. See [smoke.json](smoke.json).
  A final read returned four graded Ciallo records, all passing, no storage error.
  This checks the supplied reply rule, not actual model capability. No account
  configuration or priority was changed by the smoke test.
- Runtime: CPA/OMCPA container IDs/start times/restart counts and both CPA/CPR
  account-ops worker PIDs/start times were unchanged. No service restart occurred.
- Rollback: `/opt/stacks/cpa/ciallo-word-rule-20261105T021946Z` retains previous
  library/pin and private history snapshot. Restore the previous plugin store
  pin with its current ETag; preserve live history. State schema remains v2 and
  new fields are additive, so a source rollback needs no history/DB restore.
- Server receipt: `/opt/stacks/cpa/ciallo-word-rule-deployment.json`.
