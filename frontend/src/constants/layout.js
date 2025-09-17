// Shared layout constants for table column ratios
// Ratio 2:1:1:1 => 40% / 20% / 20% / 20%
export const COL_RATIO_2_1_1_1 = [40, 20, 20, 20]

export function buildColGroupStyle(ratioArray) {
  const total = ratioArray.reduce((s, v) => s + v, 0)
  return ratioArray.map(v => `${(v / total * 100).toFixed(3)}%`)
}
