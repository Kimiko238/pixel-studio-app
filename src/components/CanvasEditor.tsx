/**
 * 作品名・拡大率・キャンバスの表示を担当する。
 * 実際のピクセル更新やポインター処理は親から受け取るため、この部品は配置と表示調整を中心に扱う。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { useCallback, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { bytes } from '../utils/drawing';
import { canvasFitZoom } from '../utils/canvasViewport';
type Props = Pick<
  StudioController,
  | 'project'
  | 'setProject'
  | 'setDirty'
  | 'setZoom'
  | 'setPan'
  | 'zoom'
  | 'viewRef'
  | 'pan'
  | 'grid'
  | 'canvasRef'
  | 'flipView'
  | 'pointerDown'
  | 'pointerMove'
  | 'pointerUp'
  | 'setDrag'
  | 'selection'
  | 'cursor'
  | 'dirty'
  | 'setPreview'
  | 'preview'
>;
export function CanvasEditor({
  project,
  setProject,
  setDirty,
  setZoom,
  setPan,
  zoom,
  viewRef,
  pan,
  grid,
  canvasRef,
  flipView,
  pointerDown,
  pointerMove,
  pointerUp,
  setDrag,
  selection,
  cursor,
  dirty,
  setPreview,
  preview,
}: Props) {
  // DOMの実際の表示寸法から倍率を計算し、移動量とスクロールも初期位置へ戻す。
  const fitCanvas = useCallback(() => {
    const view = viewRef.current;
    if (!view || !view.clientWidth || !view.clientHeight) return;
    setZoom(canvasFitZoom(project.width, project.height, view.clientWidth, view.clientHeight));
    setPan({ x: 0, y: 0 });
    view.scrollTo(0, 0);
  }, [project.width, project.height, setZoom, setPan, viewRef]);

  // ResizeObserverで回転や画面サイズ変更を検知する。スマホだけ自動フィットし、後で監視を解除する。
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const mobile = window.matchMedia(
      '(max-width: 800px), (max-height: 500px) and (pointer: coarse)',
    );
    const fitOnMobile = () => {
      if (mobile.matches) fitCanvas();
    };
    const observer = new ResizeObserver(fitOnMobile);
    observer.observe(view);
    mobile.addEventListener('change', fitOnMobile);
    return () => {
      observer.disconnect();
      mobile.removeEventListener('change', fitOnMobile);
    };
  }, [fitCanvas, viewRef]);

  return (
    <>
      <div className="editorbar">
        <div className="projectname">
          <input
            value={project.name}
            // 作品名の入力はvalueをstateへ戻す制御された入力。変更したら未保存の印を付ける。
            onChange={(e) => {
              setProject((p) => ({ ...p, name: e.target.value }));
              setDirty(true);
            }}
            aria-label="作品名"
          />
          <span>
            {project.width} × {project.height}px
          </span>
        </div>
        <div className="zoom">
          <button aria-label="縮小" onClick={() => setZoom((z) => Math.max(0.125, z - 4))}>
            −
          </button>
          <span>{Number(zoom.toFixed(2))}×</span>
          <button aria-label="拡大" onClick={() => setZoom((z) => Math.min(60, z + 4))}>
            ＋
          </button>
          <button className="standard-zoom" onClick={() => setZoom(16)}>
            標準
          </button>
          <button onClick={fitCanvas}>全体</button>
        </div>
      </div>
      {/* 描画領域の外枠。Ctrl/Cmd＋ホイールで表示倍率を変更する。 */}
      <div
        className="canvas-area"
        ref={viewRef}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom((z) => Math.max(2, Math.min(60, z + (e.deltaY < 0 ? 2 : -2))));
          }
        }}
      >
        <div className="canvas-transform" style={{ transform: `translate(${pan.x}px,${pan.y}px)` }}>
          <div
            className={'canvas-holder ' + (grid ? 'show-grid' : '')}
            style={{
              width: project.width * zoom,
              height: project.height * zoom,
              backgroundSize: `${zoom}px ${zoom}px`,
            }}
          >
            {/* 表示サイズはCSS、画像データの寸法はdrawPreview側で設定する。
                touchAction:noneにより、この上ではブラウザのスクロールより描画操作を優先する。 */}
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
                transform: flipView ? 'scaleX(-1)' : undefined,
                touchAction: 'none',
              }}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={() => setDrag(null)}
            />
            {selection && (
              <div
                className="selection"
                style={{
                  left: selection.x * zoom,
                  top: selection.y * zoom,
                  width: selection.w * zoom,
                  height: selection.h * zoom,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="underbar">
        <span>
          座標 {cursor.x}, {cursor.y}
        </span>
        <span>{dirty ? '● 未保存' : '✓ 保存済み'}</span>
        <span>{(bytes(project) / 1024).toFixed(1)} KB</span>
        <button onClick={() => setPreview(!preview)}>
          <ImageIcon size={15} /> プレビュー
        </button>
      </div>
    </>
  );
}
