# Phase 2 fixture decision

The previous documentation referenced a regression fixture that was used to
derive protocol baselines but was not included in the repository scaffold.

Resolution:

1. Commit the sanitized fixture:
   `tests/fixtures/rhyxus_hunting2.regression.json`
2. Use it only in Phase 2 parser/tracker integration regression tests.
3. Keep unit tests small and hand-crafted.
4. Read expected event/rareness counts from the fixture's `expected` block.
5. Do not commit the original 15 MB Burp capture by default.

Phase 1 does not depend on this fixture and should not be blocked by it.
