/**
 * 描画用の計算処理。DOMやReactに依存せず、座標と配列を受け取って結果を返す。
 */
import type { Tool } from '../tools';
import type { Project } from '../model';
// 2次元座標を1次元配列の添字へ変換する。例：幅16の(2,3)は3*16+2=50。範囲外は-1。
export const px = (x: number, y: number, w: number, h: number) =>
  x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1;
// ブレゼンハムの直線アルゴリズム。誤差を加算しながら整数座標を進め、線上のピクセルを集める。
const drawLine = (
  a: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  h: number,
) => {
  let dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1,
    dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1,
    err = dx + dy;
  for (;;) {
    const i = px(x0, y0, w, h);
    if (i >= 0) a.push(i);
    if (x0 === x1 && y0 === y1) break;
    const e = 2 * err;
    if (e >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e <= dx) {
      err += dx;
      y0 += sy;
    }
  }
};
// ツールと始点・終点から「どのピクセルを変更するか」を求める。まだ色は塗らない。
export const points = (
  tool: Tool,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  h: number,
) => {
  const a: number[] = [];
  if (tool === 'pencil' || tool === 'eraser' || tool === 'line') drawLine(a, x0, y0, x1, y1, w, h);
  else if (tool === 'rect' || tool === 'fillrect') {
    const l = Math.min(x0, x1),
      r = Math.max(x0, x1),
      t = Math.min(y0, y1),
      b = Math.max(y0, y1);
    for (let y = t; y <= b; y++)
      for (let x = l; x <= r; x++)
        if (tool === 'fillrect' || x === l || x === r || y === t || y === b) {
          const i = px(x, y, w, h);
          if (i >= 0) a.push(i);
        }
  } else if (tool === 'ellipse') {
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      rx = Math.max(0.5, Math.abs(x1 - x0) / 2),
      ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
    for (let t = 0; t < Math.PI * 2; t += 0.006) {
      const i = px(Math.round(cx + rx * Math.cos(t)), Math.round(cy + ry * Math.sin(t)), w, h);
      if (i >= 0) a.push(i);
    }
  }
  return a;
};
// 元配列をコピーして対象ピクセルへ色を入れる。左右・上下対称なら対応する座標も追加する。
export const mutate = (
  base: string[],
  ids: number[],
  color: string,
  w: number,
  h: number,
  hSym: boolean,
  vSym: boolean,
) => {
  const out = [...base];
  for (const i of ids) {
    const x = i % w,
      y = Math.floor(i / w);
    for (const [xx, yy] of [
      [x, y],
      ...(hSym ? [[w - 1 - x, y]] : []),
      ...(vSym ? [[x, h - 1 - y]] : []),
      ...(hSym && vSym ? [[w - 1 - x, h - 1 - y]] : []),
    ])
      out[yy * w + xx] = color;
  }
  return out;
};
// 塗りつぶし（Flood Fill）。同じ元の色でつながる上下左右のピクセルをスタックで探索する。
// 先に色を変えてから次の探索へ積むので、同じ場所を繰り返し処理せずに済む。
export const fill = (src: string[], x: number, y: number, w: number, h: number, color: string) => {
  const i = px(x, y, w, h),
    old = src[i];
  if (i < 0 || old === color) return src;
  const a = [...src],
    stack = [i];
  a[i] = color;
  while (stack.length) {
    const n = stack.pop()!,
      cx = n % w,
      cy = Math.floor(n / w);
    for (const k of [
      px(cx - 1, cy, w, h),
      px(cx + 1, cy, w, h),
      px(cx, cy - 1, w, h),
      px(cx, cy + 1, w, h),
    ])
      if (k >= 0 && a[k] === old) {
        a[k] = color;
        stack.push(k);
      }
  }
  return a;
};
// 作品をJSONにしたときのおおよそのバイト数。画像の画素数だけでなく全データを含む。
export const bytes = (p: Project) => new Blob([JSON.stringify(p)]).size;
