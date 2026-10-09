// A greeting bubble's width, by simulation.ts's own rule (bubbleWidth): 10px Space Mono plus
// padding at the figure scale 1.25, every character below U+2000 one 6.12 px advance and every
// wider glyph (emoji, CJK, from fallback fonts) 12 px, counted by code point. The overlap checks
// measure with it, so a greeting of emoji is sized as the town sizes it, not by UTF-16 length.
export function bubbleWidth(text: string) {
  let width = 12;
  for (const char of text) width += char.codePointAt(0)! < 0x2000 ? 6.12 : 12;
  return width * 1.25;
}
