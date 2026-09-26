type TitleOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  /** A larger or bolder subtitle than the default small print, and its colour. */
  subtitleFont?: string;
  subtitleColour?: string;
  fontSize: number;
  night: boolean;
};

/** Timber-framed venue lettering, shared by the stage and zoo signs. */
export function drawVenueTitle(ctx: CanvasRenderingContext2D, options: TitleOptions) {
  const { x, y, width, height, title, subtitle, subtitleFont, subtitleColour, fontSize, night } =
    options;
  ctx.save();
  ctx.translate(x, y);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  rect(-width / 2 + 3, 4, width, height, '#263F3838');
  rect(-width / 2, 0, width, height, night ? '#847C61' : '#AD9069');
  rect(-width / 2, 0, width, 3, night ? '#BAAA7D' : '#DCCA96');
  rect(-width / 2 + 3, 4, width - 6, height - 7, night ? '#294A43' : '#365D50');
  rect(-width / 2 + 7, 7, width - 14, 1, '#819978');
  rect(-width / 2 + 7, height - 8, width - 14, 1, '#819978');
  // Small brass pins and a soft glow echo the stage's warm festoon lights.
  for (const side of [-1, 1]) {
    const pin = side * (width / 2 - 9);
    rect(pin - 1, height / 2 - 1, 2, 2, '#DCC795');
    if (night) {
      ctx.fillStyle = '#FFE2A016';
      ctx.fillRect(pin - 5, height / 2 - 5, 10, 10);
    }
  }
  let size = fontSize;
  ctx.font = `500 ${size}px "Fraunces", Georgia, serif`;
  while (ctx.measureText(title).width > width - 30 && size > 7) {
    size -= 0.5;
    ctx.font = `500 ${size}px "Fraunces", Georgia, serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = night ? '#FFE9B9' : '#FFF0CF';
  ctx.fillText(title, 0, subtitle ? height * 0.4 : height / 2 + 1);
  if (subtitle) {
    ctx.font = subtitleFont ?? '8px "Space Mono", monospace';
    ctx.fillStyle = subtitleColour ?? (night ? '#CBCEA3' : '#CBD3AC');
    ctx.fillText(subtitle, 0, height * 0.73);
  }
  ctx.restore();
}
