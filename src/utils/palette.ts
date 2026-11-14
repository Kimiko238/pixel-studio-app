/**
 * PNGから色を抽出する処理。画像の読み込みと、配列からの色抽出を分けている。
 */
const MAX_PALETTE_COLORS = 256;

// RGBAは赤・緑・青・透明度の4要素で1ピクセル。4つずつ読み、色ごとの出現回数を数える。
export function extractPalette(pixels: Uint8ClampedArray) {
  const counts = new Map<string, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    // 完全に透明なピクセルのRGB値は、パレットの色として採用しない。
    if (pixels[i + 3] === 0) continue;
    const hex =
      '#' +
      Array.from(pixels.subarray(i, i + 3), (value) => value.toString(16).padStart(2, '0')).join(
        '',
      );
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  // 通常は画像を走査した色順を保ち、256色を超える場合だけ使用頻度の高い色を優先する。
  const colors = [...counts];
  if (colors.length > MAX_PALETTE_COLORS) colors.sort((a, b) => b[1] - a[1]);
  return {
    colors: colors.slice(0, MAX_PALETTE_COLORS).map(([color]) => color),
    totalColors: counts.size,
  };
}

// 拡張子だけでは判断せず、先頭8バイトがPNGの識別情報か確認してから画像を開く。
export async function readPngPalette(file: File) {
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((byte, i) => signature[i] === byte)) {
    throw new Error('PNG画像を選択してください。');
  }

  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('画像を読み込めませんでした。');
    // 画像を見えないcanvasへ描くと、getImageDataで実際のピクセル値を取り出せる。
    ctx.drawImage(image, 0, 0);
    const palette = extractPalette(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    if (palette.colors.length === 0) {
      throw new Error('透明な画像のため、色を抽出できませんでした。');
    }
    return palette;
  } finally {
    // 成功・失敗のどちらでも画像データのリソースを解放する。
    image.close();
  }
}
