/**
 * 名前付きパレットの一覧と別名保存フォーム。
 * 画面入力はこの部品のstate、永続化する一覧はusePaletteLibraryが保持する。
 */
import { useId, useState } from 'react';
import type { StudioController } from '../hooks/usePixelStudio';
import { PaletteTransferControls } from './PaletteTransferControls';
import { palettesMatch } from '../paletteSettings';

type Props = Pick<
  StudioController,
  | 'project'
  | 'commit'
  | 'setColor'
  | 'paletteLibrary'
  | 'paletteSaveError'
  | 'savePaletteAs'
  | 'selectSavedPalette'
  | 'importPalettes'
>;

export function SavedPalettePicker({
  project,
  commit,
  setColor,
  paletteLibrary,
  paletteSaveError,
  savePaletteAs,
  selectSavedPalette,
  importPalettes,
}: Props) {
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  // useIdは各コンポーネントで一意なIDを作る。labelと入力欄を結び付けるために使う。
  const inputId = useId();
  const selected = paletteLibrary.palettes.find((p) => p.id === paletteLibrary.activeId);
  // 名前付きの元データと内容が違えば「編集中」と表示し、保存済みとの違いを伝える。
  const matchesSelected = selected && palettesMatch(selected.colors, project.palette);

  return (
    <div className="saved-palettes">
      <label htmlFor={inputId + '-select'}>保存したパレットを使う</label>
      <select
        id={inputId + '-select'}
        value={matchesSelected ? selected.id : ''}
        onChange={(e) => {
          // ブラウザへの選択状態の保存が成功した場合だけ、現在の作品にも色を適用する。
          const colors = selectSavedPalette(e.target.value);
          if (!colors) return;
          commit((p) => {
            p.palette = colors;
            return p;
          });
          setColor(colors[0] ?? '#000000');
          setSavedName('');
        }}
      >
        <option value="" disabled>
          編集中のパレット
        </option>
        {paletteLibrary.palettes.map((palette) => (
          <option key={palette.id} value={palette.id}>
            {palette.name}（{palette.colors.length}色）
          </option>
        ))}
      </select>
      <form
        onSubmit={(e) => {
          // form本来のページ送信を止めて、React側の別名保存だけを実行する。
          e.preventDefault();
          if (savePaletteAs(name, project.palette)) {
            setSavedName(name.trim());
            setName('');
          }
        }}
      >
        <label htmlFor={inputId}>新しい名前で保存</label>
        <input
          id={inputId}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSavedName('');
          }}
          placeholder="例：夕焼け、ゲーム用"
          maxLength={100}
        />
        <button type="submit" disabled={!name.trim() || project.palette.length === 0}>
          別名で保存
        </button>
      </form>
      <p
        className={'palette-feedback' + (paletteSaveError ? ' palette-feedback-error' : '')}
        role="status"
      >
        {paletteSaveError ||
          (savedName && matchesSelected && selected.name === savedName
            ? `「${savedName}」を保存しました。`
            : matchesSelected
              ? `「${selected.name}」を使用中です。`
              : '編集中の色は自動で保持されます。名前を付けて保存すると、いつでも切り替えられます。')}
      </p>
      <small className="hint">
        保存済みのパレットは、色の編集やPNG読み込みで上書きされません。
      </small>
      <PaletteTransferControls
        project={project}
        paletteLibrary={paletteLibrary}
        importPalettes={importPalettes}
      />
    </div>
  );
}
