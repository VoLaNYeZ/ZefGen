export type StaggerFrom = "first" | "last" | "center" | "random" | number;

export const splitChars = (text: string) => Array.from(text || "");

export const sanitizeChar = (char: string) => (char === " " ? "\u00A0" : char);

export const shuffle = (items: number[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const getStaggerOrder = (count: number, from?: StaggerFrom) => {
  const indices = [...Array(count).keys()];
  if (!from || from === "first") return indices;
  if (from === "last") return indices.reverse();
  if (from === "random") return shuffle(indices);

  let anchor = 0;
  if (from === "center") {
    anchor = (count - 1) / 2;
  } else if (typeof from === "number") {
    anchor = from;
  }

  return indices.sort((a, b) => {
    const distA = Math.abs(a - anchor);
    const distB = Math.abs(b - anchor);
    if (distA === distB) return a - b;
    return distA - distB;
  });
};

export type VariationAxisMap = Record<string, number>;

export const parseVariationSettings = (value: string) => {
  const axes: VariationAxisMap = {};
  const order: string[] = [];
  const regex = /'([A-Za-z0-9]{4})'\s*([-0-9.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value))) {
    const axis = match[1];
    axes[axis] = Number(match[2]);
    order.push(axis);
  }
  return { axes, order };
};

export const buildVariationSettings = (order: string[], axes: VariationAxisMap) =>
  order.map((axis) => `'${axis}' ${Number(axes[axis]).toFixed(2)}`).join(", ");

export const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t;
