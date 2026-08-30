import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src-tauri", "windows");
mkdirSync(root, { recursive: true });

const BG = [11, 13, 17];
const ELEV = [16, 20, 28];
const ACCENT = [212, 160, 86];
const ACCENT_DIM = [92, 68, 36];

function bmp(width, height, paint) {
  const row = width * 3;
  const pad = (4 - (row % 4)) % 4;
  const stride = row + pad;
  const pixels = Buffer.alloc(stride * height);
  const px = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const destY = height - 1 - y;
    const o = destY * stride + x * 3;
    pixels[o] = rgb[2];
    pixels[o + 1] = rgb[1];
    pixels[o + 2] = rgb[0];
  };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  paint({ width, height, px, mix });
  const file = Buffer.alloc(14 + 40 + pixels.length);
  file.write("BM", 0);
  file.writeUInt32LE(file.length, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(width, 18);
  file.writeInt32LE(height, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(pixels.length, 34);
  pixels.copy(file, 54);
  return file;
}

function fill(ctx, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) ctx.px(xx, yy, rgb);
  }
}

function drawM(ctx, x, y, size, color) {
  const t = Math.max(2, Math.round(size * 0.16));
  const h = size;
  const w = Math.round(size * 0.92);
  fill(ctx, x, y, t, h, color);
  fill(ctx, x + w - t, y, t, h, color);
  for (let i = 0; i < h; i++) {
    const tLeft = i / (h - 1);
    const tRight = 1 - tLeft;
    const lx = x + Math.round((w / 2 - t) * tLeft);
    const rx = x + w - t - Math.round((w / 2 - t) * tRight);
    fill(ctx, lx, y + i, t, 1, color);
    fill(ctx, rx, y + i, t, 1, color);
  }
}

const header = bmp(150, 57, (ctx) => {
  for (let y = 0; y < ctx.height; y++) {
    const t = y / ctx.height;
    fill(ctx, 0, y, ctx.width, 1, ctx.mix(BG, ELEV, t * 0.35));
  }
  fill(ctx, 0, 0, 3, ctx.height, ACCENT);
  const mark = 22;
  const mx = 16;
  const my = Math.round((ctx.height - mark) / 2);
  fill(ctx, mx - 1, my - 1, mark + 2, mark + 2, ACCENT_DIM);
  fill(ctx, mx, my, mark, mark, BG);
  drawM(ctx, mx + 4, my + 3, mark - 7, ACCENT);
});

const sidebar = bmp(164, 314, (ctx) => {
  for (let y = 0; y < ctx.height; y++) {
    const t = y / ctx.height;
    fill(ctx, 0, y, ctx.width, 1, ctx.mix(BG, ELEV, 0.15 + t * 0.55));
  }
  for (let y = 0; y < ctx.height; y += 18) {
    for (let x = 22; x < ctx.width; x++) {
      ctx.px(x, y, ctx.mix(BG, ELEV, 0.45));
    }
  }
  fill(ctx, 0, 0, 4, ctx.height, ACCENT);
  const mark = 56;
  const mx = 28;
  const my = 48;
  fill(ctx, mx - 2, my - 2, mark + 4, mark + 4, ACCENT);
  fill(ctx, mx, my, mark, mark, BG);
  drawM(ctx, mx + 10, my + 8, mark - 18, ACCENT);
  fill(ctx, mx, my + mark + 18, 72, 2, ACCENT);
});

writeFileSync(join(root, "nsis-header.bmp"), header);
writeFileSync(join(root, "nsis-sidebar.bmp"), sidebar);
console.log("wrote NSIS bitmaps to", root);
