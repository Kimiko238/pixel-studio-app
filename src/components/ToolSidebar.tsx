/**
 * 描画ツール・編集補助・パレットをまとめる操作パネル。
 * PCは常時表示、スマホはmobileToolsとdata-mobile-sectionを使ってCSSで表示範囲を切り替える。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { Undo2, Redo2, Copy, X, FlipHorizontal, FlipVertical, RotateCw } from 'lucide-react';
import { PalettePanel } from './PalettePanel';
import { toolItems } from '../tools';
import { ActionButton } from './ActionButton';
type Props = Pick<
  StudioController,
  | 'user'
  | 'paletteCloudState'
  | 'paletteCloudError'
  | 'retryPaletteCloud'
  | 'paletteLibrary'
  | 'paletteSaveError'
  | 'savePaletteAs'
  | 'selectSavedPalette'
  | 'importPalettes'
  | 'tool'
  | 'setTool'
  | 'undo'
  | 'redo'
  | 'copySelection'
  | 'paste'
  | 'moveSelection'
  | 'flipSelection'
  | 'replaceColor'
  | 'symH'
  | 'setSymH'
  | 'symV'
  | 'setSymV'
  | 'grid'
  | 'setGrid'
  | 'onion'
  | 'setOnion'
  | 'resize'
  | 'transform'
  | 'setFlipView'
  | 'flipView'
  | 'project'
  | 'color'
  | 'setColor'
  | 'commit'
> & {
  mobileTools: boolean;
  setMobileTools: (open: boolean) => void;
  mobileSection: 'tools' | 'palette';
};
export function ToolSidebar({
  user,
  paletteCloudState,
  paletteCloudError,
  retryPaletteCloud,
  paletteLibrary,
  paletteSaveError,
  savePaletteAs,
  selectSavedPalette,
  importPalettes,
  mobileTools,
  setMobileTools,
  mobileSection,
  tool,
  setTool,
  undo,
  redo,
  copySelection,
  paste,
  moveSelection,
  flipSelection,
  replaceColor,
  symH,
  setSymH,
  symV,
  setSymV,
  grid,
  setGrid,
  onion,
  setOnion,
  resize,
  transform,
  setFlipView,
  flipView,
  project,
  color,
  setColor,
  commit,
}: Props) {
  return (
    <aside
      className={'tools ' + (!mobileTools ? 'collapsed' : '')}
      data-mobile-section={mobileSection}
    >
      <div className="section-title">
        <b>{mobileSection === 'palette' ? 'パレット' : 'ツール'}</b>
        <button
          className="iconbutton mobile-panel-close"
          aria-label="ツール・パレットを閉じる"
          onClick={() => setMobileTools(false)}
        >
          <X size={20} />
        </button>
      </div>
      <div className="toolgrid sidebar-controls">
        {toolItems.map((t) => (
          <button
            key={t.id}
            title={t.label}
            className={'tool ' + (tool === t.id ? 'active' : '')}
            onClick={() => {
              setTool(t.id);
              setMobileTools(false);
            }}
          >
            <t.icon size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <PalettePanel
        user={user}
        paletteCloudState={paletteCloudState}
        paletteCloudError={paletteCloudError}
        retryPaletteCloud={retryPaletteCloud}
        paletteLibrary={paletteLibrary}
        paletteSaveError={paletteSaveError}
        savePaletteAs={savePaletteAs}
        selectSavedPalette={selectSavedPalette}
        importPalettes={importPalettes}
        key={project.id}
        project={project}
        color={color}
        setColor={setColor}
        commit={commit}
      />
      <div className="sidebar-controls">
        <div className="section-title">編集</div>
        <div className="button-row">
          <ActionButton label="戻す" onClick={undo} icon={<Undo2 size={16} />} />
          <ActionButton label="やり直し" onClick={redo} icon={<Redo2 size={16} />} />
        </div>
        <div className="button-row">
          <ActionButton label="コピー" onClick={copySelection} icon={<Copy size={16} />} />
          <ActionButton label="貼付" onClick={paste} />
        </div>
        <div className="button-row">
          <ActionButton label="←" onClick={() => moveSelection(-1, 0)} />
          <ActionButton label="→" onClick={() => moveSelection(1, 0)} />
          <ActionButton label="↑" onClick={() => moveSelection(0, -1)} />
          <ActionButton label="↓" onClick={() => moveSelection(0, 1)} />
        </div>
        <div className="button-row">
          <ActionButton label="選択反転" onClick={flipSelection} />
          <ActionButton label="色置換" onClick={replaceColor} />
        </div>
        <div className="section-title">描画補助</div>
        <label className="check">
          <input type="checkbox" checked={symH} onChange={(e) => setSymH(e.target.checked)} />{' '}
          左右対称
        </label>
        <label className="check">
          <input type="checkbox" checked={symV} onChange={(e) => setSymV(e.target.checked)} />{' '}
          上下対称
        </label>
        <label className="check">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />{' '}
          グリッド
        </label>
        <label className="check">
          <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} />{' '}
          オニオンスキン
        </label>
        <div className="section-title">キャンバス</div>
        <div className="button-row">
          <ActionButton label="サイズ" onClick={resize} />
          <ActionButton
            label="左右反転"
            onClick={() => transform('h')}
            icon={<FlipHorizontal size={16} />}
          />
          <ActionButton
            label="上下反転"
            onClick={() => transform('v')}
            icon={<FlipVertical size={16} />}
          />
        </div>
        <div className="button-row">
          <ActionButton
            label="90°回転"
            onClick={() => transform('rotate')}
            icon={<RotateCw size={16} />}
          />
          <ActionButton label="表示反転" onClick={() => setFlipView(!flipView)} />
        </div>
      </div>
    </aside>
  );
}
