/**
 * 端末間でやり取りするパレット専用JSONの作成と読み込み。
 * 保存済みの名前・色を運び、受け取り側の作品や既存パレットは上書きしない。
 */
import { palettesMatch, type PaletteLibrary, type SavedPalette } from './paletteSettings';

type TransferPalette = { name: string; colors: string[] };
type PaletteTransfer = {
  format: 'pixel-studio-palettes';
  version: 1;
  palettes: TransferPalette[];
};

function isTransferPalette(value: unknown): value is TransferPalette {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === 'string' &&
    p.name.trim().length > 0 &&
    Array.isArray(p.colors) &&
    p.colors.every((color) => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))
  );
}

// 名前が同じでも色が違えば別の名前にし、同じ名前・色なら追加を省く。
function availableName(palettes: TransferPalette[], palette: TransferPalette): string | null {
  const base = palette.name.trim();
  let name = base;
  let suffix = 2;
  for (;;) {
    const existing = palettes.find((p) => p.name === name);
    if (!existing) return name;
    if (palettesMatch(existing.colors, palette.colors)) return null;
    name = `${base}（${suffix++}）`;
  }
}

export function serializePaletteTransfer(library: PaletteLibrary, currentColors: string[]) {
  const palettes: TransferPalette[] = library.palettes.map((p) => ({
    name: p.name,
    colors: [...p.colors],
  }));
  // 別名保存前の色も失わないよう、現在の色が一覧にない場合は作業中パレットとして含める。
  if (!palettes.some((p) => palettesMatch(p.colors, currentColors))) {
    const draft = { name: '作業中のパレット', colors: [...currentColors] };
    palettes.push({ ...draft, name: availableName(palettes, draft)! });
  }
  const transfer: PaletteTransfer = { format: 'pixel-studio-palettes', version: 1, palettes };
  return JSON.stringify(transfer, null, 2);
}

export function mergePaletteTransfer(library: PaletteLibrary, text: string) {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('パレットJSONを読み取れませんでした。書き出したファイルを選んでください。');
  }
  if (!value || typeof value !== 'object')
    throw new Error('パレット用のJSONファイルを選んでください。');
  const transfer = value as Record<string, unknown>;
  if (
    transfer.format !== 'pixel-studio-palettes' ||
    transfer.version !== 1 ||
    !Array.isArray(transfer.palettes) ||
    transfer.palettes.length === 0 ||
    !transfer.palettes.every(isTransferPalette)
  ) {
    throw new Error(
      '対応していないパレットファイルです。「別の端末へ書き出す」で作成したJSONを選んでください。',
    );
  }

  // 検証をすべて終えてから新しい一覧を作る。不正なファイルで途中まで追加されることを防ぐ。
  const palettes: SavedPalette[] = [...library.palettes];
  let added = 0;
  let skipped = 0;
  for (const palette of transfer.palettes) {
    const name = availableName(palettes, palette);
    if (name === null) {
      skipped++;
      continue;
    }
    palettes.push({ id: crypto.randomUUID(), name, colors: [...palette.colors] });
    added++;
  }
  // 選択中の色と作品データを保ち、一覧だけに追加する。
  return { library: { ...library, palettes }, added, skipped };
}
