export const COL_RATIO_2_1_1_1: readonly number[] = [40, 20, 20, 20] as const;

export function buildColGroupStyle(ratioArray: readonly number[]): string[] {
  const total = ratioArray.reduce((s, v) => s + v, 0);
  return ratioArray.map((v) => `${((v / total) * 100).toFixed(3)}%`);
}
