/**
 * スマホ用の常時表示バー。描画を邪魔しないよう、よく使う操作と色だけを並べる。
 * panelがnullならパネルを閉じ、tools/palette/animationなら対応するパネルを開く。
 */
import { Brush, Eraser, Palette, SlidersHorizontal, Film, Undo2, Redo2 } from 'lucide-react';
import type { StudioController } from '../hooks/usePixelStudio';

export type MobilePanel = 'tools' | 'palette' | 'animation' | null;
type Props = Pick<
  StudioController,
  'project' | 'color' | 'setColor' | 'tool' | 'setTool' | 'undo' | 'redo'
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
  undo,
  redo,
  panel,
  onPanelChange,
}: Props) {
  const toggle = (next: MobilePanel) => onPanelChange(panel === next ? null : next);
  return (
    <div className="mobile-editor-bar">
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
      <nav className="mobile-actions" aria-label="描画操作">
        <button
          aria-pressed={tool === 'pencil'}
          onClick={() => {
            setTool('pencil');
            onPanelChange(null);
          }}
        >
          <Brush size={20} />
          <span>ペン</span>
        </button>
        <button
          aria-pressed={tool === 'eraser'}
          onClick={() => {
            setTool('eraser');
            onPanelChange(null);
          }}
        >
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
