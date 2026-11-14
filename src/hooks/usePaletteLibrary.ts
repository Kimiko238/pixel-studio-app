/**
 * パレット一覧をReactの状態とlocalStorageの両方で管理するカスタムフック。
 * 名前付き保存と作業用コピーを分けることが、過去のパレットを残すポイント。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '../model';
import type { User } from 'firebase/auth';
import { useCloudPaletteSync } from './useCloudPaletteSync';
import { mergePaletteTransfer } from '../paletteTransfer';
import {
  addSavedPalette,
  loadPaletteLibrary,
  palettesMatch,
  storePaletteLibrary,
  type PaletteLibrary,
} from '../paletteSettings';

export function usePaletteLibrary(project: Project, user: User | null, online: boolean) {
  const [paletteLibrary, setPaletteLibrary] = useState(loadPaletteLibrary);
  // 保存ボタンの連続操作でも、stateの再描画を待たず最新の一覧を参照できるようにする。
  const libraryRef = useRef(paletteLibrary);
  const [paletteSaveError, setPaletteSaveError] = useState('');
  // 作品を開き直した変更と、同じ作品内で色を編集した変更を区別するための前回値。
  const previous = useRef({ projectId: project.id, palette: project.palette });

  // ブラウザ保存に成功してからstateを更新する。失敗時は成功表示にせずエラーを返す。
  const persist = useCallback((next: PaletteLibrary) => {
    try {
      storePaletteLibrary(next);
      libraryRef.current = next;
      setPaletteLibrary(next);
      setPaletteSaveError('');
      return true;
    } catch {
      setPaletteSaveError(
        'パレットを保存できませんでした。ブラウザの保存設定や空き容量を確認してください。',
      );
      return false;
    }
  }, []);

  // 名前の検証と追加をデータ層へ依頼し、一覧全体を保存する。
  const savePaletteAs = useCallback(
    (name: string, colors: string[]) => {
      try {
        return persist(addSavedPalette(libraryRef.current, name, colors));
      } catch (error) {
        setPaletteSaveError(
          error instanceof Error ? error.message : 'パレットを保存できませんでした。',
        );
        return false;
      }
    },
    [persist],
  );

  // 選択中IDと作業用の色を更新する。返す配列もコピーし、名前付きデータが編集で変わらないようにする。
  const selectSavedPalette = useCallback(
    (id: string) => {
      const current = libraryRef.current;
      const palette = current.palettes.find((p) => p.id === id);
      if (!palette) return null;
      if (!persist({ ...current, activeId: id, draft: [...palette.colors] })) return null;
      return [...palette.colors];
    },
    [persist],
  );

  // ファイルからの取り込みも、通常の保存と同じpersist経由で端末内へ反映する。
  const importPalettes = useCallback(
    (text: string) => {
      try {
        const result = mergePaletteTransfer(libraryRef.current, text);
        if (!persist(result.library)) return null;
        return { added: result.added, skipped: result.skipped };
      } catch (error) {
        setPaletteSaveError(
          error instanceof Error ? error.message : 'パレットを読み込めませんでした。',
        );
        return null;
      }
    },
    [persist],
  );

  // 同じ作品のパレットが変わったら作業用コピーだけを自動保存する。
  // 作品切り替えによる変更では、最後の作業用コピーを勝手に置き換えない。
  useEffect(() => {
    const prev = previous.current;
    previous.current = { projectId: project.id, palette: project.palette };
    if (prev.projectId !== project.id || palettesMatch(prev.palette, project.palette)) return;
    if (palettesMatch(libraryRef.current.draft, project.palette)) return;
    persist({ ...libraryRef.current, draft: [...project.palette] });
  }, [project.id, project.palette, persist]);

  const cloudSync = useCloudPaletteSync(user, online, paletteLibrary, libraryRef, persist);
  return {
    ...cloudSync,
    paletteLibrary,
    sharedPalette: paletteLibrary.draft,
    paletteSaveError,
    savePaletteAs,
    selectSavedPalette,
    importPalettes,
  };
}
