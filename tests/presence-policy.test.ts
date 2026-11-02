import assert from "node:assert/strict";
import test from "node:test";
import { shouldLeaveWhenAlone, shouldRetryStream } from "../src/services/presence-policy.ts";

test("sala vazia nao tira o bot quando ele esta fixo", () => {
  assert.equal(shouldLeaveWhenAlone(true, 0), false);
  assert.equal(shouldLeaveWhenAlone(false, 0), true);
  assert.equal(shouldLeaveWhenAlone(false, 2), false);
});

test("a radio continua tentando quando nao ha limite", () => {
  assert.equal(shouldRetryStream(5, Number.POSITIVE_INFINITY), true);
  assert.equal(shouldRetryStream(100, Number.POSITIVE_INFINITY), true);
  assert.equal(shouldRetryStream(5, 5), false);
});
