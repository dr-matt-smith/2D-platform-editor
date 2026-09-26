/**
 * Recolour the playtest player sprite (CC BY 4.0 derivative; v9 +).
 *
 * Generates `public/play-assets/player.png` as a 32x32 RGBA PNG, pure
 * Deno (no dependencies; `node:zlib` is Deno's built-in Node compat, used
 * for its synchronous level-9 deflate). The geometry follows the upstream
 * `simple-platformer-1` `tools/gen-sprites.mjs` `player()` function so a
 * future re-sync only diverges on the palette; the change here is the
 * **green** body / dark-forest rim, so the player reads distinctly from
 * the warm yellow `coin.png` and the warm accent `Goal`.
 *
 * Adapted Material under CC BY 4.0 — see `public/play-assets/sources.md`
 * for attribution + modification note. Run with:
 *
 *   deno task gen:player-sprite
 */
import { deflateSync } from 'node:zlib';

const OUT_DIR = `${import.meta.dirname}/../public/play-assets`;
const OUT = `${OUT_DIR}/player.png`;

/** Straight-alpha colour, each channel 0..1. */
type RGBA = [number, number, number, number];

const SIZE = 32;
const SS = 4;
const DIM = SIZE * SS;

// --- pure software raster (premultiplied-alpha float buffer) -------------

function makeBuf(): Float64Array {
  return new Float64Array(DIM * DIM * 4);
}

function over(buf: Float64Array, x: number, y: number, [r, g, b, a]: RGBA): void {
  if (x < 0 || y < 0 || x >= DIM || y >= DIM || a <= 0) return;
  const i = (y * DIM + x) * 4;
  const inv = 1 - a;
  buf[i]     = r * a + buf[i]     * inv;
  buf[i + 1] = g * a + buf[i + 1] * inv;
  buf[i + 2] = b * a + buf[i + 2] * inv;
  buf[i + 3] = a     + buf[i + 3] * inv;
}

const rgb = (r: number, g: number, b: number, a = 1): RGBA => [r / 255, g / 255, b / 255, a];

function disc(buf: Float64Array, cx: number, cy: number, rad: number, colour: RGBA): void {
  const c: RGBA = [...colour];
  for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) {
    for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rad) over(buf, x, y, c);
    }
  }
}

function resolve(buf: Float64Array): Uint8Array {
  const out = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * DIM + (x * SS + sx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const n = SS * SS;
      r /= n; g /= n; b /= n; a /= n;
      const o = (y * SIZE + x) * 4;
      const ua = a > 0 ? 1 / a : 0;
      out[o]     = Math.round(Math.min(255, r * ua * 255));
      out[o + 1] = Math.round(Math.min(255, g * ua * 255));
      out[o + 2] = Math.round(Math.min(255, b * ua * 255));
      out[o + 3] = Math.round(Math.min(255, a * 255));
    }
  }
  return out;
}

// --- minimal PNG encoder ------------------------------------------------

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf: Uint8Array): number => {
    let c = 0xffffffff;
    for (const byte of buf) c = t[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type: string, data: Uint8Array): Uint8Array {
  const td = concat([new TextEncoder().encode(type), data]); // type is ASCII
  return concat([u32be(data.length), td, u32be(CRC(td))]);
}

function encodePNG(rgba: Uint8Array): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, SIZE);
  ihdrView.setUint32(4, SIZE);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = new Uint8Array(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * (SIZE * 4 + 1) + 1);
  }
  return concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

// --- the player (green palette; geometry identical to upstream) ---------

function player(): Uint8Array {
  const b = makeBuf();
  const C = <T extends number[]>(...a: T) =>
    a.map((v) => v * SS) as { [K in keyof T]: number };
  // body: green blob with a darker forest-green rim
  disc(b, ...C(16, 17), 14 * SS, rgb(50, 120, 40));   // rim
  disc(b, ...C(16, 17), 12.6 * SS, rgb(110, 205, 90)); // face
  // soft top highlight — cool/light to match the green palette
  disc(b, ...C(13, 12), 4.5 * SS, rgb(220, 255, 200, 0.5));
  // eyes — unchanged from upstream
  for (const ex of [11.8, 20.2]) {
    disc(b, ...C(ex, 14), 3.2 * SS, rgb(255, 255, 255));
    disc(b, ...C(ex + 0.4, 14.4), 1.7 * SS, rgb(28, 30, 40));
  }
  return resolve(b);
}

Deno.writeFileSync(OUT, encodePNG(player()));
console.log(`wrote ${OUT}`);
