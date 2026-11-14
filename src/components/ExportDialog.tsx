/**
 * 書き出し条件とプレビューの画面。設定値は親が保持し、exportNowが実際のファイルを作る。
 * プレビューもexportPixelsを通すため、元の編集データを変更せず出力時の色を確認できる。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { canvasFromPixels } from '../model';
type Props = Pick<
  StudioController,
  | 'setExportDialog'
  | 'pyxel'
  | 'setPyxel'
  | 'transparent'
  | 'setTransparent'
  | 'bg'
  | 'setBg'
  | 'sheet'
  | 'setSheet'
  | 'cols'
  | 'setCols'
  | 'exportPixels'
  | 'active'
  | 'project'
  | 'exportNow'
>;
export function ExportDialog({
  setExportDialog,
  pyxel,
  setPyxel,
  transparent,
  setTransparent,
  bg,
  setBg,
  sheet,
  setSheet,
  cols,
  setCols,
  exportPixels,
  active,
  project,
  exportNow,
}: Props) {
  return (
    <div className="overlay">
      <div className="dialog">
        <div className="dialoghead">
          <h2>書き出し</h2>
          <button onClick={() => setExportDialog(false)}>×</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={pyxel} onChange={(e) => setPyxel(e.target.checked)} />{' '}
          Pyxel標準16色に変換して出力
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(e) => setTransparent(e.target.checked)}
          />{' '}
          透明部分を透過PNGとして出力
        </label>
        {!transparent && (
          <label>
            透明部分の代替色{' '}
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
        )}
        <p>スプライトシートの配置</p>
        <select value={sheet} onChange={(e) => setSheet(e.target.value as typeof sheet)}>
          <option value="horizontal">横一列</option>
          <option value="vertical">縦一列</option>
          <option value="columns">指定列数</option>
        </select>
        {sheet === 'columns' && (
          <input
            type="number"
            min="1"
            max="100"
            value={cols}
            onChange={(e) => setCols(Number(e.target.value))}
          />
        )}
        <div className="exportpreview">
          <img
            src={canvasFromPixels(exportPixels(active), project.width, project.height).toDataURL()}
            alt="書き出しプレビュー"
          />
        </div>
        <p className="hint">画像は元のピクセルサイズで出力。元の編集データは変更しません。</p>
        <div className="exportbuttons">
          <button onClick={() => exportNow('png')}>PNG</button>
          <button onClick={() => exportNow('sheet')}>スプライトシート</button>
          <button onClick={() => exportNow('gif')}>GIF</button>
          <button onClick={() => exportNow('json')}>JSON</button>
        </div>
      </div>
    </div>
  );
}
