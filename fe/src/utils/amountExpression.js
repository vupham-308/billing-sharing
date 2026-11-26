/**
 * Sanitize raw input for the total amount field:
 * - Strips all whitespace
 * - Normalizes × -> * and ÷ -> /
 * - Keeps only digits, +, -, *, /, (, )
 */
export function sanitizeAmountInput(raw) {
  if (typeof raw !== "string") return "";
  let cleaned = raw
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[^0-9+\-*/()]/g, "");

  // Preserve existing behavior for plain integer strings (strip leading zeros)
  if (/^\d+$/.test(cleaned) && cleaned.length > 1 && cleaned.startsWith("0")) {
    cleaned = cleaned.replace(/^0+/, "") || "0";
  }

  return cleaned;
}

/**
 * Safely evaluates an arithmetic expression containing +, -, *, /, and parentheses.
 * Returns { valid, value, hasOperator, error }.
 */
export function evaluateAmountExpression(input) {
  const expr = typeof input === "string" ? input.replace(/\s+/g, "") : "";
  if (!expr) {
    return { valid: false, value: null, hasOperator: false, error: null };
  }

  const hasOperator = /[+\-*/()]/.test(expr);

  if (/[^0-9+\-*/()]/.test(expr)) {
    return { valid: false, value: null, hasOperator, error: "Biểu thức số tiền không hợp lệ" };
  }

  let pos = 0;

  const parseExpression = () => {
    let left = parseTerm();
    if (left === null) return null;

    while (pos < expr.length && (expr[pos] === "+" || expr[pos] === "-")) {
      const op = expr[pos++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = () => {
    let left = parseFactor();
    if (left === null) return null;

    while (pos < expr.length && (expr[pos] === "*" || expr[pos] === "/")) {
      const op = expr[pos++];
      const right = parseFactor();
      if (right === null) return null;
      if (op === "/") {
        if (right === 0) {
          throw new Error("DIVIDE_BY_ZERO");
        }
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  };

  const parseFactor = () => {
    if (pos >= expr.length) return null;

    if (expr[pos] === "+" || expr[pos] === "-") {
      const sign = expr[pos++] === "-" ? -1 : 1;
      const factor = parseFactor();
      if (factor === null) return null;
      return sign * factor;
    }

    if (expr[pos] === "(") {
      pos++;
      const inner = parseExpression();
      if (inner === null || pos >= expr.length || expr[pos] !== ")") {
        return null;
      }
      pos++;
      return inner;
    }

    const start = pos;
    while (pos < expr.length && expr[pos] >= "0" && expr[pos] <= "9") {
      pos++;
    }
    if (pos === start) return null;

    return Number(expr.slice(start, pos));
  };

  try {
    const rawResult = parseExpression();
    if (rawResult === null || pos !== expr.length || !Number.isFinite(rawResult)) {
      return { valid: false, value: null, hasOperator, error: "Biểu thức số tiền không hợp lệ" };
    }

    const rounded = Math.round(rawResult);
    if (!Number.isSafeInteger(rounded)) {
      return { valid: false, value: null, hasOperator, error: "Số tiền quá lớn để chia chính xác." };
    }

    return { valid: true, value: rounded, hasOperator, error: null };
  } catch (err) {
    if (err.message === "DIVIDE_BY_ZERO") {
      return { valid: false, value: null, hasOperator, error: "Không thể chia cho 0" };
    }
    return { valid: false, value: null, hasOperator, error: "Biểu thức số tiền không hợp lệ" };
  }
}
