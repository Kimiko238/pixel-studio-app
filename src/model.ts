/**
 * 作品のデータ型と、データ→画像の変換などの共通処理。
 * Reactの画面から独立しているので、まず型定義を読むと保存データの構造が分かる。
 */
// 1コマ分の画像。pixels[y * width + x]に色を置き、空文字は透明として扱う。
// durationはミリ秒、linkは一緒に編集するコマを識別するためのID。
export type Frame = { id: string; pixels: string[]; duration: number; link?: string };
// 名前・再生速度・再生方法と、順番を持つコマの集まり。
export type Animation = {
  id: string;
  name: string;
  fps: number;
  mode: 'loop' | 'once' | 'pingpong';
  frames: Frame[];
};
// 保存・読み込みする作品全体の形。revisionはクラウドとの競合を判定する版番号。
export type Project = {
  id: string;
  name: string;
  folder: string;
  width: number;
  height: number;
  animations: Animation[];
  activeAnimation: string;
  palette: string[];
  updated: number;
  revision: number;
};
// Pyxelの標準16色。初期パレットと、書き出し時の色変換の基準に使う。
export const COLORS = [
  '#000000',
  '#1d2b53',
  '#7e2553',
  '#008751',
  '#ab5236',
  '#5f574f',
  '#c2c3c7',
  '#fff1e8',
  '#ff004d',
  '#ffa300',
  '#ffec27',
  '#00e436',
  '#29adff',
  '#83769c',
  '#ff77a8',
  '#ffccaa',
];
// 作品・アニメーション・コマを、名前が同じでも区別できるようにする。
export const uid = () => crypto.randomUUID();
// 幅×高さ個の透明ピクセルで、空のコマを作る。
export const frame = (w: number, h: number): Frame => ({
  id: uid(),
  pixels: Array(w * h).fill(''),
  duration: 125,
});
// 最初のアニメーションと1コマを持つ新規作品の初期データを返す。
export const createProject = (name = '無題の作品', w = 16, h = 16): Project => {
  const a = {
    id: uid(),
    name: 'アニメーション 1',
    fps: 8,
    mode: 'loop' as const,
    frames: [frame(w, h)],
  };
  return {
    id: uid(),
    name,
    folder: '未分類',
    width: w,
    height: h,
    animations: [a],
    activeAnimation: a.id,
    palette: [...COLORS],
    updated: Date.now(),
    revision: 0,
  };
};
// ネストした配列やオブジェクトも複製する。Undo用の過去データを後の編集から守る。
export const clone = <T>(v: T): T => structuredClone(v);
// activeAnimationに一致するデータを探し、見つからなければ先頭を使う。
export const currentAnimation = (p: Project) =>
  p.animations.find((a) => a.id === p.activeAnimation) ?? p.animations[0];
// 新しい各座標に対応する元の座標を求める。scale=falseなら範囲外を透明で埋める。
export const resizePixels = (
  old: string[],
  ow: number,
  oh: number,
  nw: number,
  nh: number,
  scale = false,
) =>
  Array.from({ length: nw * nh }, (_, i) => {
    const x = i % nw,
      y = Math.floor(i / nw);
    const sx = scale ? Math.floor((x * ow) / nw) : x,
      sy = scale ? Math.floor((y * oh) / nh) : y;
    return sx < ow && sy < oh ? old[sy * ow + sx] || '' : '';
  });
// 色文字列の配列をcanvasのRGBAバッファへ変換する。編集表示・サムネイル・書き出しで共用。
export const canvasFromPixels = (pixels: string[], w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const data = ctx.createImageData(w, h);
  pixels.forEach((hex, i) => {
    if (!hex) return;
    const color = hex.replace('#', '');
    if (color.length !== 6) return;
    data.data.set(
      [
        parseInt(color.slice(0, 2), 16),
        parseInt(color.slice(2, 4), 16),
        parseInt(color.slice(4, 6), 16),
        255,
      ],
      i * 4,
    );
  });
  ctx.putImageData(data, 0, 0);
  return c;
};
// Blobに一時URLを付け、ダウンロード用リンクをクリックしたあとでURLを解放する。
export const download = (blob: Blob, name: string) => {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
};
// ファイル名で扱いづらい記号をアンダースコアに置き換える。
export const fileName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');
// コールバック形式のcanvas.toBlobをPromiseで包み、awaitで待てるようにする。
export const pngBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG変換に失敗'))), 'image/png'),
  );
// RGB各成分の差の2乗を合計し、指定パレットの中で最も近い色を選ぶ。
export const nearestColor = (hex: string, palette: string[]) => {
  const n = parseInt(hex.slice(1), 16),
    r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  let best = palette[0],
    dist = Infinity;
  for (const p of palette) {
    const m = parseInt(p.slice(1), 16),
      d = (r - (m >> 16)) ** 2 + (g - ((m >> 8) & 255)) ** 2 + (b - (m & 255)) ** 2;
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  return best;
};
