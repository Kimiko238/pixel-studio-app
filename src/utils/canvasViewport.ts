/**
 * キャンバスを表示枠へ収める倍率を計算する。余白24pxは周囲12pxずつに対応する。
 */
export function canvasFitZoom(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const availableWidth = Math.max(1, viewportWidth - 24);
  const availableHeight = Math.max(1, viewportHeight - 24);
  // 横・縦の倍率の小さい方を採用すると、画像全体が表示領域内に収まる。
  const ratio = Math.min(availableWidth / width, availableHeight / height, 60);
  // 拡大時は整数倍率でドットをくっきり表示し、大きい画像の縮小時だけ小数倍率を許可する。
  return ratio >= 1 ? Math.floor(ratio) : ratio;
}
