// Sunflower Sticker palette: no yellows, tans or limes, so every path reads on the yellow board.
const PALETTE = [
  '#ff4d6d', // pink-red
  '#3a86ff', // blue
  '#06d6a0', // mint
  '#9b5de5', // purple
  '#ff8e3c', // orange
  '#f15bb5', // magenta
  '#00b4d8', // cyan
  '#8d5a3b', // brown
  '#1d3fa8', // navy
  '#2fb344', // green
  '#ff9ec7', // pink
  '#00897b', // teal
  '#c1121f', // crimson
  '#7c8a9e', // slate
  '#b388ff', // lavender
  '#5c2a9d', // grape
];

export function pairColor(i: number): string {
  if (i < PALETTE.length) return PALETTE[i];
  // Golden-angle hues for any extra pairs, skipping the yellow band (40–75°).
  let hue = Math.round((i * 137.508) % 360);
  if (hue >= 40 && hue <= 75) hue = (hue + 60) % 360;
  const light = 45 + ((i * 7) % 3) * 8;
  return `hsl(${hue} 80% ${light}%)`;
}
