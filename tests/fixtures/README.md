# Test fixtures

## `rhyxus_hunting2.regression.json`

Sanitized regression fixture for Phase 2.

It contains only the inbound protocol events used by the v1 parser/tracker:

- `combat.started`
- `loot.received`
- `capture.failed`
- `capture.success`
- `hunt.analyzer_reset`
- `hunt.stopped`

The file intentionally removes the Burp export envelope, authenticated WebSocket
URL, client-originated traffic, and unrelated protocol events.

Identifiers used for correlation are deterministically pseudonymized, so
wild-monster reuse and event relationships remain testable.

### Expected baseline

```text
combat.started       1,359
loot.received        1,631
capture.failed       1,262
capture.success         58
hunt.analyzer_reset      8
hunt.stopped             6

Rare+ failed            133
```

Tests should read the `expected` object from the fixture instead of duplicating
these constants in multiple test files.

Do not add the original raw capture to the repository unless there is a
specific debugging need and it has been reviewed for sensitive data.
