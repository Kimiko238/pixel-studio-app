/**
 * パレット設定の保存形式・検証・旧データ移行。作品本体の保存とは独立している。
 */
import { COLORS, COLORS_256 } from './model';

// 現在の保存形式と、1つの共通パレットだけを保存していた旧形式のキー。
const KEY = 'pixel-palette-library';
const LEGACY_KEY = 'pixel-shared-palette';

// 名前付き保存は色のスナップショット。draftは編集中の色で、名前付きデータから分離する。
export type SavedPalette = { id: string; name: string; colors: string[] };
export type PaletteLibrary = { palettes: SavedPalette[]; activeId: string; draft: string[] };

// localStorageのJSONはTypeScriptの型検査を通らないため、読み込み時に値の形を確認する。
function isColors(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((color) => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))
  );
}

// Firestoreから受け取るデータも、ファイルと同じように実行時に検証する。
export function isSavedPalette(value: unknown): value is SavedPalette {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    !p.id.includes('/') &&
    typeof p.name === 'string' &&
    p.name.trim().length > 0 &&
    isColors(p.colors)
  );
}

// クラウドの一覧を端末内へ追加する。選択中の色や作品には触れず、同名の別色も残す。
export function mergeCloudPaletteLibrary(
  local: PaletteLibrary,
  remote: SavedPalette[],
): PaletteLibrary {
  let activeId = local.activeId;
  let palettes = [...local.palettes];
  let changed = false;
  for (const incoming of remote) {
    const sameId = palettes.find((p) => p.id === incoming.id);
    // 同名衝突で端末側だけ表示名を変えた場合も、同じID・色なら取り込み済みとして扱う。
    if (sameId && palettesMatch(sameId.colors, incoming.colors)) continue;
    if (sameId) {
      // 旧形式の固定IDが別端末の色と衝突しても、端末版に新しいIDを振って両方を残す。
      const newId = crypto.randomUUID();
      palettes = palettes.map((p) => (p.id === sameId.id ? { ...p, id: newId } : p));
      if (activeId === sameId.id) activeId = newId;
      changed = true;
    }
    let name = incoming.name;
    let suffix = 2;
    let duplicate = false;
    for (;;) {
      const existing = palettes.find((p) => p.name === name);
      if (!existing) break;
      if (palettesMatch(existing.colors, incoming.colors)) {
        duplicate = true;
        break;
      }
      name = `${incoming.name}（${suffix++}）`;
    }
    if (!duplicate) {
      palettes.push({ ...incoming, name, colors: [...incoming.colors] });
      changed = true;
    }
  }
  return changed ? { ...local, activeId, palettes } : local;
}

const standard16Id = 'default';
const standard256Id = 'standard-256';

function ensureStandard256(palettes: SavedPalette[]) {
  const existing = palettes.find(
    (palette) => palette.id.startsWith(standard256Id) && palettesMatch(palette.colors, COLORS_256),
  );
  if (existing) return { palettes, standard256: existing };

  let id = standard256Id;
  let name = '標準256色';
  for (let suffix = 2; palettes.some((palette) => palette.id === id); suffix++)
    id = `${standard256Id}-${suffix}`;
  for (let suffix = 2; palettes.some((palette) => palette.name === name); suffix++)
    name = `標準256色（${suffix}）`;
  const standard256 = { id, name, colors: [...COLORS_256] };
  return { palettes: [...palettes, standard256], standard256 };
}

// 保存内容を復元する。以前の標準16色をそのまま使用中なら標準256色へ切り替える。
export function loadPaletteLibrary(): PaletteLibrary {
  const standard16 = { id: standard16Id, name: '標準16色', colors: [...COLORS] };
  const { palettes: builtins, standard256 } = ensureStandard256([standard16]);
  const fallback: PaletteLibrary = {
    palettes: builtins,
    activeId: standard256.id,
    draft: [...standard256.colors],
  };
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (
      value &&
      Array.isArray(value.palettes) &&
      value.palettes.length > 0 &&
      value.palettes.every(
        (p: SavedPalette) =>
          p &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          p.name.trim() &&
          isColors(p.colors),
      ) &&
      new Set(value.palettes.map((p: SavedPalette) => p.id)).size === value.palettes.length &&
      typeof value.activeId === 'string' &&
      value.palettes.some((p: SavedPalette) => p.id === value.activeId) &&
      isColors(value.draft)
    ) {
      const { palettes, standard256 } = ensureStandard256(value.palettes);
      if (
        value.version === undefined &&
        value.activeId === standard16Id &&
        palettesMatch(value.draft, COLORS)
      ) {
        return { palettes, activeId: standard256.id, draft: [...standard256.colors] };
      }
      return { palettes, activeId: value.activeId, draft: value.draft };
    }
    const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null');
    if (isColors(legacy)) {
      const previous = { id: 'legacy', name: '以前の共通パレット', colors: [...legacy] };
      return { palettes: [...builtins, previous], activeId: previous.id, draft: [...legacy] };
    }
  } catch {
    // JSONの破損やブラウザ保存の制限があっても、標準色で編集を始められるようにする。
  }
  return fallback;
}

// 一覧・選択中ID・作業用の色を1つのJSONにまとめて保存する。失敗は呼び出し元で表示する。
export function storePaletteLibrary(library: PaletteLibrary) {
  // バージョンを記録し、更新後に選び直した16色を次回も復元する。
  localStorage.setItem(KEY, JSON.stringify({ ...library, version: 2 }));
}

// 起動時の作品に使うのは、最後に保持した作業用コピーの色。
export function loadSharedPalette() {
  return loadPaletteLibrary().draft;
}

// 配列そのものの参照ではなく、色数と並び順を含む内容を比較する。
export function palettesMatch(a: string[], b: string[]) {
  return a.length === b.length && a.every((color, i) => color === b[i]);
}

// 既存の一覧を変更せず、新しいIDと名前で追加する。同名は拒否して意図しない上書きを防ぐ。
export function addSavedPalette(
  library: PaletteLibrary,
  name: string,
  colors: string[],
): PaletteLibrary {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('パレット名を入力してください。');
  if (library.palettes.some((p) => p.name === trimmed))
    throw new Error('同じ名前のパレットがあります。別の名前を入力してください。');
  if (!isColors(colors) || colors.length === 0) throw new Error('保存する色を追加してください。');
  const palette: SavedPalette = { id: crypto.randomUUID(), name: trimmed, colors: [...colors] };
  return { palettes: [...library.palettes, palette], activeId: palette.id, draft: [...colors] };
}
