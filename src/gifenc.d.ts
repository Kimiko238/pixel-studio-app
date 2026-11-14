/**
 * 型情報のないgifencライブラリへ、このアプリで使う関数の型を補う宣言ファイル。
 * .d.tsは実行処理を持たず、引数・戻り値をTypeScriptへ知らせるために使う。
 */
declare module 'gifenc' {
  type Format = 'rgb565' | 'rgb444' | 'rgba4444';
  type Palette = number[][];
  type PixelData = Uint8Array | Uint8ClampedArray;

  export function quantize(
    data: PixelData,
    maxColors: number,
    options?: { format?: Format },
  ): Palette;
  export function applyPalette(data: PixelData, palette: Palette, format?: Format): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Palette;
        delay?: number;
        repeat?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  };
}
