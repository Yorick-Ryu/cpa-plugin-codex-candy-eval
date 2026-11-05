# Clouvider rollout — v0.4.5-omc.1

- Candy source: `2197d84299eea0ee2a9f83ad72231c415e8fd6f5`, tag
  `v0.4.5-omc.1`. [Release build 41952605008](https://github.com/Yorick-Ryu/cpa-plugin-codex-candy-eval/actions/runs/41952605008)
  passed tests and all five platform builds. The deployed Linux/amd64 artifact
  came from that build; its published ZIP checksum and uploaded library checksum
  were verified. Exact metadata is in [deployment.json](deployment.json).
- Companion worker source: `cpa-plugin-account-ops` main `ffd155da2492c631544c7d8d0a86d02da7e18ecb`.
  Its committed archive was staged and verified against all live worker files;
  no existing source differences were overwritten. New native API reads replace
  the retired candy routes and exclude Ciallo evidence from automated grading.
  590 Python tests passed locally and on Linux (one optional test skipped).
  Both repositories were pushed. The native account-ops library was unchanged.
- Activation: candy hot replacement plus one explicitly authorized restart of
  `cpa-account-ops.service`. CPA/OMCPA container IDs, start times and restart counts
  were unchanged; CPR worker PID was unchanged. No image was rebuilt or replaced.
  The older `scripts/deploy.sh` layout/restart path was superseded by staged,
  checksum-verified native hot replacement on the current Clouvider layout.
- Validation: all prior visible history counts survived schema migration;
  no storage error; plugin registered/enabled; OMC health HTTP 200; private worker
  monitor HTTP 200. The deployed worker adapter successfully parsed 19 credentials
  and 164 candy policy records from the new endpoint. Chrome refreshed to the new
  version with loaded account data and selectable multi-in-one pelican controls.
- Authorized live test: one account, `gpt-6.1-sol`, low, one candy run. Completed
  in 23.097 seconds on the first attempt, graded `correct`, no request error,
  result present in the state file and subsequent API reads. No credential,
  priority, balance or subscription changes were made by the smoke test.
- Rollback: `/opt/stacks/cpa/candy-v045-20261105T020953Z` preserves the previous
  library, pin, original state, worker source locator and consistent private
  worker DB/config/key snapshot. Quiesce candy before restoring the old state
  layout and pin; restore the previous worker source with an authorized restart.
  Preserve new v2 history separately. Do not overwrite newer worker data with
  the database snapshot for a source-only rollback.
- Live receipts: `/opt/stacks/cpa/candy-v045-deployment.json`,
  `/opt/cpa-account-ops/candy-v045-deployment.json`; the worker release locator
  retains separate provenance for the unchanged native account-ops library.
