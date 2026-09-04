import { test } from "node:test";
import assert from "node:assert/strict";

import { mutationNeedsLayoutReconcile } from "../../userscript/closed-hud-runtime.js";

class FakeElement {
  constructor({ matches = false, contains = false } = {}) {
    this.matchesSelector = matches;
    this.containsSelector = contains;
  }

  matches() {
    return this.matchesSelector;
  }

  querySelector() {
    return this.containsSelector ? new FakeElement({ matches: true }) : null;
  }
}

function mutation({ target, added = [], removed = [] }) {
  return {
    target,
    addedNodes: added,
    removedNodes: removed
  };
}

test("layout mutation filter ignores ordinary table and metric updates", () => {
  const irrelevant = new FakeElement();

  assert.equal(mutationNeedsLayoutReconcile([
    mutation({ target: irrelevant, added: [new FakeElement()] }),
    mutation({ target: irrelevant, removed: [new FakeElement()] })
  ], { ElementClass: FakeElement }), false);
});

test("layout mutation filter accepts a relevant target or nested control", () => {
  assert.equal(mutationNeedsLayoutReconcile([
    mutation({ target: new FakeElement({ matches: true }) })
  ], { ElementClass: FakeElement }), true);

  assert.equal(mutationNeedsLayoutReconcile([
    mutation({
      target: new FakeElement(),
      added: [new FakeElement({ contains: true })]
    })
  ], { ElementClass: FakeElement }), true);
});

test("layout mutation filter catches removal of a relevant control", () => {
  assert.equal(mutationNeedsLayoutReconcile([
    mutation({
      target: new FakeElement(),
      removed: [new FakeElement({ matches: true })]
    })
  ], { ElementClass: FakeElement }), true);
});
