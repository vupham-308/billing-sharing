import { expect, test } from "vitest";
import { sanitizeAmountInput, evaluateAmountExpression } from "./amountExpression";

test("sanitizeAmountInput strips spaces and normalizes operators", () => {
  expect(sanitizeAmountInput(" 22000 + 2000 ")).toBe("22000+2000");
  expect(sanitizeAmountInput("22000 + 2000 - 20000")).toBe("22000+2000-20000");
  expect(sanitizeAmountInput("10000 × 2 ÷ 4")).toBe("10000*2/4");
  expect(sanitizeAmountInput("0024000")).toBe("24000");
  expect(sanitizeAmountInput("0")).toBe("0");
});

test("evaluateAmountExpression handles single and multi-operator expressions", () => {
  expect(evaluateAmountExpression("22000+2000")).toEqual({
    valid: true,
    value: 24000,
    hasOperator: true,
    error: null,
  });
  expect(evaluateAmountExpression("22000+2000-20000")).toEqual({
    valid: true,
    value: 4000,
    hasOperator: true,
    error: null,
  });
  expect(evaluateAmountExpression("10000+2000*3")).toEqual({
    valid: true,
    value: 16000,
    hasOperator: true,
    error: null,
  });
  expect(evaluateAmountExpression("(10000+2000)*3")).toEqual({
    valid: true,
    value: 36000,
    hasOperator: true,
    error: null,
  });
});

test("evaluateAmountExpression reports incomplete or invalid expressions", () => {
  expect(evaluateAmountExpression("22000+").valid).toBe(false);
  expect(evaluateAmountExpression("22000/0")).toEqual({
    valid: false,
    value: null,
    hasOperator: true,
    error: "Không thể chia cho 0",
  });
  expect(evaluateAmountExpression("24000")).toEqual({
    valid: true,
    value: 24000,
    hasOperator: false,
    error: null,
  });
});
