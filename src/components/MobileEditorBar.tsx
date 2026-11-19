/**
 * スマホ用の常時表示バー。描画を邪魔しないよう、よく使う操作と色だけを並べる。
 * panelがnullならパネルを閉じ、tools/palette/animationなら対応するパネルを開く。
 */
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Brush,
  Eraser,
  Film,
  MousePointer2,
  Palette,
  Redo2,
  SlidersHorizontal,
  Undo2,
  X,
} from 'lucide-react';
import type { StudioController } from '../hooks/usePixelStudio';

export type MobilePanel = 'tools' | 'palette' | 'animation' | null;
type Props = Pick<
  StudioController,
  | 'project'
  | 'color'
  | 'setColor'
  | 'tool'
  | 'setTool'
  | 'selection'
  | 'moveSelection'
  | 'clearSelection'
  | 'flipView'
  | 'undo'
  | 'redo'
> & {
  panel: MobilePanel;
  onPanelChange: (panel: MobilePanel) => void;
};

export function MobileEditorBar({
  project,
  color,
  setColor,
  tool,
  setTool,
  selection,
  moveSelection,
  clearSelection,
  flipView,
  undo,
  redo,
  panel,
  onPanelChange,
}: Props) {
  const selecting = tool === 'select';
  const horizontalStep = flipView ? -1 : 1;
  const chooseTool = (next: 'pencil' | 'eraser' | 'select') => {
    if (selecting && next !== 'select') clearSelection();
    setTool(next);
    onPanelChange(null);
  };
  const toggle = (next: MobilePanel) => onPanelChange(panel === next ? null : next);
  return (
    <div className="mobile-editor-bar">
      <div className="mobile-edit-row">
        <button
          className={selecting ? 'mobile-select active' : 'mobile-select'}
          aria-label={selecting ? '選択を解除' : undefined}
          onClick={() => chooseTool(selecting ? 'pencil' : 'select')}
        >
          {selecting ? <X size={18} /> : <MousePointer2 size={18} />}
          {selecting ? '解除' : '選択'}
        </button>
        {selecting ? (
          <div className="mobile-selection-controls" role="group" aria-label="選択範囲を移動">
            <button
              aria-label="左に移動"
              disabled={!selection}
              onClick={() => moveSelection(-horizontalStep, 0)}
            >
              <ArrowLeft size={20} />
            </button>
            <button
              aria-label="上に移動"
              disabled={!selection}
              onClick={() => moveSelection(0, -1)}
            >
              <ArrowUp size={20} />
            </button>
            <button aria-label="下に移動" disabled={!selection} onClick={() => moveSelection(0, 1)}>
              <ArrowDown size={20} />
            </button>
            <button
              aria-label="右に移動"
              disabled={!selection}
              onClick={() => moveSelection(horizontalStep, 0)}
            >
              <ArrowRight size={20} />
            </button>
          </div>
        ) : (
          <div className="mobile-colors" role="group" aria-label="描画色の選択">
            <span
              className="mobile-current-color"
              style={{ background: color }}
              title={`選択中 ${color}`}
            />
            <div className="mobile-color-strip">
              {project.palette.map((c, i) => (
                <button
                  key={i}
                  aria-label={`描画色 ${c}`}
                  aria-pressed={color === c}
                  style={{ background: c }}
                  className={color === c ? 'chosen' : ''}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <nav className="mobile-actions" aria-label="描画操作">
        <button aria-pressed={tool === 'pencil'} onClick={() => chooseTool('pencil')}>
          <Brush size={20} />
          <span>ペン</span>
        </button>
        <button aria-pressed={tool === 'eraser'} onClick={() => chooseTool('eraser')}>
          <Eraser size={20} />
          <span>消しゴム</span>
        </button>
        <button onClick={undo}>
          <Undo2 size={20} />
          <span>戻す</span>
        </button>
        <button onClick={redo}>
          <Redo2 size={20} />
          <span>やり直し</span>
        </button>
        <button aria-expanded={panel === 'tools'} onClick={() => toggle('tools')}>
          <SlidersHorizontal size={20} />
          <span>ツール</span>
        </button>
        <button aria-expanded={panel === 'palette'} onClick={() => toggle('palette')}>
          <Palette size={20} />
          <span>パレット</span>
        </button>
        <button aria-expanded={panel === 'animation'} onClick={() => toggle('animation')}>
          <Film size={20} />
          <span>コマ</span>
        </button>
      </nav>
    </div>
  );
}
