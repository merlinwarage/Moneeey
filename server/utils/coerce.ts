// A 0 is érvényes érték (pl. 0% infláció), ezért nem `||`-t használunk
export const numOr = (v: unknown, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? n : d;
};
export const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? n : null;
};
export const flag = (v: unknown) => (Number(v) ? 1 : 0);
