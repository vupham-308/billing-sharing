import { expect, test } from "vitest";
import { splitAmount, editShare } from "./splitAmount";

test("payer gets the smaller remainder even when not first", () => {
  expect(splitAmount(111111, ["vu", "payer"], "payer")).toEqual({ vu: 55556, payer: 55555 });
  expect(splitAmount(100000, ["a", "payer", "b"], "payer")).toEqual({ a: 33334, b: 33334, payer: 33332 });
});

test("custom overshoot clamps to the remainder without increasing total", () => {
  const amounts = { payer: 55555, vu: 55556 };
  expect(editShare(111111, ["payer", "vu"], "payer", amounts, "vu", 60000)).toEqual(amounts);
  expect(editShare(111111, ["payer", "vu"], "payer", amounts, "vu", 50000)).toEqual({ payer: 61111, vu: 50000 });
});

test("editing payer and single-person shares also keeps the total", () => {
  expect(editShare(100, ["payer", "a"], "payer", { payer: 50, a: 50 }, "payer", 40)).toEqual({ payer: 40, a: 60 });
  expect(editShare(100, ["a"], "payer", { a: 100 }, "a", 20)).toEqual({ a: 100 });
});

test("small totals and absent payer never produce zero or negative shares", () => {
  for (let count = 1; count <= 10; count++) {
    const ids = Array.from({ length: count }, (_, i) => String(i));
    for (let total = count; total <= 100; total++) {
      for (const payer of [ids[count - 1], "absent"]) {
        const shares = splitAmount(total, ids, payer);
        expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(total);
        expect(Object.values(shares).every((value) => Number.isInteger(value) && value >= 1)).toBe(true);
      }
    }
  }
  expect(splitAmount(2, ["a", "b", "c"], "a")).toEqual({});
});
