import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Renders the map at `scale` pixels per screen pixel and copies it.
 * MapLibre limits the canvas to 4096 px per side, so the copy can be smaller
 * than asked for on large screens; read the real scale from the result.
 */
export async function captureMap(map: MapLibreMap, scale: number): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  map.setPixelRatio(scale);
  try {
    await new Promise<void>((resolve) => {
      if (map.loaded()) resolve();
      else map.once('idle', () => resolve());
    });
    // WebGL clears the canvas after it's shown, so copy it inside a render.
    const copy = await new Promise<HTMLCanvasElement>((resolve) => {
      map.once('render', () => {
        const source = map.getCanvas();
        const out = document.createElement('canvas');
        out.width = source.width;
        out.height = source.height;
        out.getContext('2d')!.drawImage(source, 0, 0);
        resolve(out);
      });
      map.triggerRepaint();
    });
    return { canvas: copy, scale: copy.width / map.getContainer().clientWidth };
  } finally {
    // We never override the ratio elsewhere, so go back to following the screen.
    map.setPixelRatio(null as unknown as number);
  }
}

export interface LegendItem {
  color: string;
  label: string;
}

export interface PlacedItem extends LegendItem {
  x: number;
  row: number;
}

/**
 * Flows legend items left to right, wrapping into rows that fit `maxWidth`.
 * `measure` returns an item's width (swatch + text).
 */
export function layoutLegend(
  items: LegendItem[],
  measure: (item: LegendItem) => number,
  maxWidth: number,
  gap: number,
): { placed: PlacedItem[]; rows: number } {
  const placed: PlacedItem[] = [];
  let x = 0;
  let row = 0;
  for (const item of items) {
    const width = measure(item);
    if (x > 0 && x + width > maxWidth) {
      row++;
      x = 0;
    }
    placed.push({ ...item, x, row });
    x += width + gap;
  }
  return { placed, rows: items.length ? row + 1 : 0 };
}

export interface ComposeOptions {
  map: HTMLCanvasElement;
  /** Image pixels per screen pixel, from captureMap */
  scale: number;
  title?: string;
  legendTitle?: string;
  legend?: LegendItem[];
  attribution: string;
  colors: { background: string; text: string; muted: string; border: string };
  fontFamily: string;
}

/** Title above the map, legend and attribution below, all at the map's scale. */
export function composeImage(o: ComposeOptions): HTMLCanvasElement {
  const s = o.scale;
  const pad = 24 * s;
  const width = o.map.width + pad * 2;
  const font = (size: number, weight = 400) => `${weight} ${size * s}px ${o.fontFamily}`;
  const measureCtx = document.createElement('canvas').getContext('2d')!;

  const swatch = 12 * s;
  const legendGap = 20 * s;
  const rowHeight = 22 * s;
  measureCtx.font = font(14);
  const legend = layoutLegend(
    o.legend ?? [],
    (item) => swatch + 8 * s + measureCtx.measureText(item.label).width,
    o.map.width,
    legendGap,
  );

  const titleHeight = o.title ? 40 * s : 0;
  const legendTitleHeight = legend.rows && o.legendTitle ? 22 * s : 0;
  const legendHeight = legend.rows ? 16 * s + legendTitleHeight + legend.rows * rowHeight : 0;
  const footerHeight = 28 * s;
  const height = pad + titleHeight + o.map.height + legendHeight + footerHeight + pad / 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = o.colors.background;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';

  let y = pad;
  if (o.title) {
    ctx.fillStyle = o.colors.text;
    ctx.font = font(24, 500);
    ctx.fillText(o.title, pad, y + 14 * s, o.map.width);
    y += titleHeight;
  }

  ctx.drawImage(o.map, pad, y);
  ctx.strokeStyle = o.colors.border;
  ctx.lineWidth = s;
  ctx.strokeRect(pad - s / 2, y - s / 2, o.map.width + s, o.map.height + s);
  y += o.map.height;

  if (legend.rows) {
    y += 16 * s;
    if (o.legendTitle) {
      ctx.fillStyle = o.colors.text;
      ctx.font = font(14, 500);
      ctx.fillText(o.legendTitle, pad, y + 10 * s, o.map.width);
      y += legendTitleHeight;
    }
    ctx.font = font(14);
    for (const item of legend.placed) {
      const cy = y + item.row * rowHeight + rowHeight / 2;
      ctx.beginPath();
      ctx.arc(pad + item.x + swatch / 2, cy, swatch / 2, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = o.colors.border;
      ctx.stroke();
      ctx.fillStyle = o.colors.text;
      ctx.fillText(item.label, pad + item.x + swatch + 8 * s, cy);
    }
    y += legend.rows * rowHeight;
  }

  ctx.fillStyle = o.colors.muted;
  ctx.font = font(11);
  ctx.fillText(o.attribution, pad, y + footerHeight / 2 + 4 * s, o.map.width);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), type),
  );
}

/** One-page PDF the size of the image. jsPDF loads only when needed. */
export async function canvasToPdf(canvas: HTMLCanvasElement, scale: number, title: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  // Page size in CSS pixels; the image keeps its full resolution inside.
  const w = canvas.width / scale;
  const h = canvas.height / scale;
  const pdf = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
  pdf.setProperties({ title, creator: 'US Map Visualizer and Segmenter' });
  // 'FAST' compresses the image; without it jsPDF stores raw pixels (5x larger).
  pdf.addImage(canvas, 'PNG', 0, 0, w, h, undefined, 'FAST');
  return pdf.output('blob');
}
