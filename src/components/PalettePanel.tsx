/**
 * 現在使っている色の表示・選択・編集と、PNGからの色抽出を担当する。
 * 色を作品へ適用する変更はcommit経由。名前付き保存と切り替えはSavedPalettePickerへ分ける。
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Plus, Upload } from 'lucide-react';
import type { StudioController } from '../hooks/usePixelStudio';
import { readPngPalette } from '../utils/palette';
import { ActionButton } from './ActionButton';
import { PaletteCloudControls } from './PaletteCloudControls';
import { SavedPalettePicker } from './SavedPalettePicker';
type Props = Pick<
  StudioController,
  | 'project'
  | 'color'
  | 'setColor'
  | 'commit'
  | 'user'
  | 'paletteCloudState'
  | 'paletteCloudError'
  | 'retryPaletteCloud'
  | 'paletteLibrary'
  | 'paletteSaveError'
  | 'savePaletteAs'
  | 'selectSavedPalette'
  | 'importPalettes'
>;
export function PalettePanel({
  project,
  color,
  setColor,
  commit,
  user,
  paletteCloudState,
  paletteCloudError,
  retryPaletteCloud,
  paletteLibrary,
  paletteSaveError,
  savePaletteAs,
  selectSavedPalette,
  importPalettes,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const revealRef = useRef(false);
  const headingId = useId();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  // ファイル名はこの画面での読み込み表示用。色の保存先は作品データとパレットライブラリ。
  const [imported, setImported] = useState<{ name: string; colors: string[] } | null>(null);
  // 色を編集したりUndoで戻した場合、元PNGと同じ内容のときだけ読み込み元の表示を出す。
  const isImported =
    imported !== null &&
    imported.colors.length === project.palette.length &&
    imported.colors.every((value, i) => value === project.palette[i]);

  // 読み込みが反映されたあと、一度だけパレットが見える位置へ移動してフォーカスする。
  useEffect(() => {
    if (!isImported || !revealRef.current) return;
    revealRef.current = false;
    panelRef.current?.scrollIntoView({ block: 'nearest' });
    panelRef.current?.focus({ preventScroll: true });
  }, [isImported, imported]);

  // PNGの色抽出は非同期。成功時に作品のパレットだけを更新し、描いた絵の色は変えない。
  const importPalette = async (file: File) => {
    setLoading(true);
    setMessage('');
    setError(false);
    try {
      const { colors, totalColors } = await readPngPalette(file);
      commit((p) => {
        p.palette = colors;
        return p;
      });
      setColor(colors[0]);
      revealRef.current = true;
      setImported({ name: file.name, colors });
      setMessage(
        totalColors > colors.length
          ? `${totalColors}色から使用頻度の高い${colors.length}色を読み込みました。`
          : `${colors.length}色を読み込みました。`,
      );
    } catch (error) {
      setError(true);
      setMessage(error instanceof Error ? error.message : 'パレットを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={'palette-panel' + (isImported ? ' palette-panel-imported' : '')}
    >
      <div className="palette-heading">
        <h2 id={headingId}>使用中のパレット</h2>
        <span className="palette-count">{project.palette.length}色</span>
      </div>
      <PaletteCloudControls
        user={user}
        paletteCloudState={paletteCloudState}
        paletteCloudError={paletteCloudError}
        retryPaletteCloud={retryPaletteCloud}
      />
      <SavedPalettePicker
        project={project}
        commit={commit}
        setColor={setColor}
        paletteLibrary={paletteLibrary}
        paletteSaveError={paletteSaveError}
        savePaletteAs={savePaletteAs}
        selectSavedPalette={selectSavedPalette}
        importPalettes={importPalettes}
      />
      {isImported && (
        <div className="palette-source">
          <span>
            <Check size={14} /> PNGから読み込み済み
          </span>
          <strong title={imported.name}>{imported.name}</strong>
        </div>
      )}
      <div className="button-row">
        <button className="button" disabled={loading} onClick={() => inputRef.current?.click()}>
          <Upload size={15} /> {loading ? '読み込み中…' : 'PNGから読み込み'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".png,image/png"
          aria-label="パレット用PNG画像"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 同じファイルをもう一度選んだときもchangeイベントを受け取れるようにする。
            e.target.value = '';
            if (file) void importPalette(file);
          }}
        />
      </div>
      {message && (error || isImported) && (
        <p className={'palette-feedback' + (error ? ' palette-feedback-error' : '')} role="status">
          {message}
        </p>
      )}
      <p className="palette-instruction">
        {isImported ? '読み込んだ色はこちら ↓' : '色をクリックして描画色を選択'}
      </p>
      <div
        // 色数が多いときは16列の小さいマスに切り替え、256色をスクロールなしで一覧できるようにする。
        className={'palette' + (project.palette.length > 64 ? ' palette-dense' : '')}
        role="group"
        aria-label="使用中のパレットの色一覧"
      >
        {project.palette.map((c, i) => (
          <button
            key={i}
            title={`${c}（右クリックで変更）`}
            aria-label={`描画色 ${c}`}
            aria-pressed={color === c}
            className={'swatch ' + (color === c ? 'chosen' : '')}
            style={{ background: c }}
            onClick={() => setColor(c)}
            // 右クリックは色変更。確認がOKなら、既に描いた同色ピクセルも全コマで置き換える。
            onContextMenu={(e) => {
              e.preventDefault();
              const n = prompt('新しい色（#RRGGBB）', c);
              if (!n || !/^#[\da-fA-F]{6}$/.test(n)) return;
              const recolor = confirm('すでに描いた同じ色のピクセルも変更しますか？');
              commit((p) => {
                p.palette[i] = n;
                if (recolor)
                  p.animations.forEach((a) =>
                    a.frames.forEach((f) => (f.pixels = f.pixels.map((v) => (v === c ? n : v)))),
                  );
                return p;
              });
              setColor(n);
            }}
          />
        ))}
      </div>
      {project.palette.length === 0 && (
        <p className="hint">色を追加するか、PNGを読み込んでください。</p>
      )}
      <div className="palette-current">
        <span className="palette-current-swatch" style={{ background: color }} aria-hidden="true" />
        <span>選択中の色</span>
        <strong>{color.toUpperCase()}</strong>
      </div>
      <div className="button-row">
        <input
          aria-label="現在の色"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <ActionButton
          label="色を追加"
          onClick={() =>
            commit((p) => {
              p.palette.push(color);
              return p;
            })
          }
          icon={<Plus size={15} />}
        />
        <ActionButton
          label="削除"
          onClick={() =>
            commit((p) => {
              p.palette = p.palette.filter((c) => c !== color);
              return p;
            })
          }
        />
      </div>
      <small className="hint">
        色をクリックで選択、右クリックで変更。PNGは最大256色まで読み込めます。
      </small>
    </section>
  );
}
