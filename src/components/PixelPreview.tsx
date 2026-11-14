/**
 * 現在のコマを元のピクセル寸法で表示する小さなプレビュー。編集データは書き換えない。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { canvasFromPixels } from '../model';
type Props = Pick<StudioController, 'setPreview' | 'active' | 'project'>;
export function PixelPreview({ setPreview, active, project }: Props) {
  return (
    <div className="floating-preview">
      <div>
        <b>原寸プレビュー</b>
        <button onClick={() => setPreview(false)}>×</button>
      </div>
      <img
        src={canvasFromPixels(active.pixels, project.width, project.height).toDataURL()}
        alt="原寸"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
