# Ciallo word rule repair

The three reported replies (`Ciallo! 👋 What can I help you with?`, `Ciallo～ 👋`,
`Ciallo～ 👋 What can I help you with?`) all pass. The previous exact-emoticon
rule incorrectly failed the first and marked the other two inconclusive.

New grading matches whole greeting words case-insensitively: `ciallo` passes,
`ciao` fails, both/neither are inconclusive. Punctuation and emoji do not matter.
This is the user's entertainment rule, not evidence of model capability.

State responses derive historical Ciallo verdicts from copied original replies,
marked `ciallo-word-v1`; saved history is not rewritten. Error/skipped/cancelled
records and candy grading are unchanged. The UI labels the current rule and
counts only conclusive Ciallo results in its passing rate.

Regression checks cover all three production examples, uppercase and punctuation,
whole-word false matches, conflicting greetings, current/history agreement,
non-mutating history projection and unchanged non-answer/candy records.

Build and deployment receipts are recorded after validation. No account-ops
worker change or restart is needed. Rollback restores only this plugin's store
pin to the previous library; the history schema is unchanged.
