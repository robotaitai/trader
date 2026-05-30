---
note_type: risks
project: trader2
updated: 2026-05-31
---

# Risks

Known project risks.

## Open risks

- Risk: Private portfolio data could be accidentally published.
  - Why it matters: The project is intended to be public, while the user's real
    holdings are private.
  - Mitigation: Keep real data in ignored `private/` or `*.private.*` files and
    do not force-add them.
  - Related context: `Memory/local-data.md`

- Risk: SheetJS/xlsx has known npm audit advisories.
  - Why it matters: The app parses spreadsheet files in the browser.
  - Mitigation: Treat imports as local trusted user files in Phase 1; revisit
    parser choice if the app accepts untrusted files later.
  - Related context: `Memory/frontend.md`

- Risk: No Git repository metadata is currently present.
  - Why it matters: Onboarding could not inspect branch history or commit
    context.
  - Mitigation: Initialize or restore Git metadata before relying on history,
    reviews, or publication workflows.
  - Related context: `Memory/PROJECT.md`
