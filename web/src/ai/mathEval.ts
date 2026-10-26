/** Evaluates + - * / % ^ and parentheses. Returns null for anything else. No eval(). */
export function evaluateMath(input: string): number | null {
  const src = input.replace(/\s+/g, "").replace(/×|x/g, "*").replace(/÷/g, "/");
  if (!/^[\d.+\-*/%^()]+$/.test(src) || !/\d/.test(src)) return null;
  let i = 0;
  const peek = () => src[i];
  const number = (): number => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) throw new Error("number");
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = (): number => {
    if (peek() === "-") {
      i++;
      return -factor();
    }
    if (peek() === "+") {
      i++;
      return factor();
    }
    let v: number;
    if (peek() === "(") {
      i++;
      v = expr();
      if (peek() !== ")") throw new Error(")");
      i++;
    } else v = number();
    if (peek() === "^") {
      i++;
      v = Math.pow(v, factor());
    }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = src[i++];
      const r = factor();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = expr();
    return i === src.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
