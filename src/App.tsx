/**
 * 画面全体の配置を決めるルートコンポーネント。
 * 読み進める順番：App → componentsの画面部品 → hooks/usePixelStudio → model・storage。
 * propsは親から子へ渡す値や関数。子から操作関数を呼ぶと状態が変わり、画面に反映される。
 */
import { Upload } from 'lucide-react';
import { useState } from 'react';
import { MobileEditorBar, type MobilePanel } from './components/MobileEditorBar';
import { configured } from './cloud';
import { usePixelStudio } from './hooks/usePixelStudio';
import { AppHeader } from './components/AppHeader';
import { ToolSidebar } from './components/ToolSidebar';
import { CanvasEditor } from './components/CanvasEditor';
import { AnimationTimeline } from './components/AnimationTimeline';
import { PixelPreview } from './components/PixelPreview';
import { ProjectLibraryDialog } from './components/ProjectLibraryDialog';
import { ExportDialog } from './components/ExportDialog';
import { SettingsDialog } from './components/SettingsDialog';
export default function App() {
  // 操作に必要な状態と関数をフックから受け取り、各画面部品へpropsとして渡す。
  const studio = usePixelStudio();
  // この値はスマホの操作パネルだけに使う表示状態。nullなら閉じている。
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const { status, preview, library, exportDialog, settings, inputRef, importFile } = studio;
  return (
    <div className="app">
      {/* 作品一覧・保存・書き出し・設定を開く共通ヘッダー。 */}
      <AppHeader
        online={studio.online}
        user={studio.user}
        pendingCount={studio.pendingCount}
        openLibrary={studio.openLibrary}
        save={studio.save}
        setExportDialog={studio.setExportDialog}
        setSettings={studio.setSettings}
      />
      <div className="workspace">
        {mobilePanel && (
          <button
            className="mobile-panel-backdrop"
            aria-label="操作パネルを閉じる"
            onClick={() => setMobilePanel(null)}
          />
        )}
        {/* PCでは左サイドバー、スマホでは必要なときに開くパネルとして表示する。 */}
        <ToolSidebar
          user={studio.user}
          paletteCloudState={studio.paletteCloudState}
          paletteCloudError={studio.paletteCloudError}
          retryPaletteCloud={studio.retryPaletteCloud}
          paletteLibrary={studio.paletteLibrary}
          paletteSaveError={studio.paletteSaveError}
          savePaletteAs={studio.savePaletteAs}
          selectSavedPalette={studio.selectSavedPalette}
          importPalettes={studio.importPalettes}
          mobileTools={mobilePanel === 'tools' || mobilePanel === 'palette'}
          setMobileTools={() => setMobilePanel(null)}
          mobileSection={mobilePanel === 'palette' ? 'palette' : 'tools'}
          tool={studio.tool}
          setTool={studio.setTool}
          undo={studio.undo}
          redo={studio.redo}
          copySelection={studio.copySelection}
          paste={studio.paste}
          moveSelection={studio.moveSelection}
          flipSelection={studio.flipSelection}
          replaceColor={studio.replaceColor}
          symH={studio.symH}
          setSymH={studio.setSymH}
          symV={studio.symV}
          setSymV={studio.setSymV}
          grid={studio.grid}
          setGrid={studio.setGrid}
          onion={studio.onion}
          setOnion={studio.setOnion}
          resize={studio.resize}
          transform={studio.transform}
          setFlipView={studio.setFlipView}
          flipView={studio.flipView}
          project={studio.project}
          color={studio.color}
          setColor={studio.setColor}
          commit={studio.commit}
        />
        <main className="main">
          {/* canvasの表示と入力イベントを担当。描画データの変更はstudio側へ依頼する。 */}
          <CanvasEditor
            project={studio.project}
            setProject={studio.setProject}
            setDirty={studio.setDirty}
            setZoom={studio.setZoom}
            setPan={studio.setPan}
            zoom={studio.zoom}
            viewRef={studio.viewRef}
            pan={studio.pan}
            grid={studio.grid}
            canvasRef={studio.canvasRef}
            flipView={studio.flipView}
            pointerDown={studio.pointerDown}
            pointerMove={studio.pointerMove}
            pointerUp={studio.pointerUp}
            pointerCancel={studio.pointerCancel}
            tool={studio.tool}
            selection={studio.selection}
            cursor={studio.cursor}
            dirty={studio.dirty}
            setPreview={studio.setPreview}
            preview={studio.preview}
          />
          {/* コマ操作もPCでは常時表示し、スマホでは開閉する。切り替えはCSSとクラス名で制御。 */}
          <div className={'timeline-panel' + (mobilePanel === 'animation' ? ' is-open' : '')}>
            <div className="mobile-panel-heading">
              <b>アニメーション</b>
              <button aria-label="コマ操作を閉じる" onClick={() => setMobilePanel(null)}>
                ×
              </button>
            </div>
            <AnimationTimeline
              anim={studio.anim}
              chooseAnimation={studio.chooseAnimation}
              project={studio.project}
              addAnimation={studio.addAnimation}
              commit={studio.commit}
              setFrameIndex={studio.setFrameIndex}
              setPlaying={studio.setPlaying}
              playing={studio.playing}
              active={studio.active}
              frameRef={studio.frameRef}
              frameIndex={studio.frameIndex}
              addFrame={studio.addFrame}
              duplicateFrame={studio.duplicateFrame}
              moveFrame={studio.moveFrame}
              removeFrame={studio.removeFrame}
            />
          </div>
        </main>
      </div>
      {/* スマホ専用の下部操作バー。PCではCSSで非表示にする。 */}
      <MobileEditorBar
        project={studio.project}
        color={studio.color}
        setColor={studio.setColor}
        tool={studio.tool}
        setTool={studio.setTool}
        selection={studio.selection}
        moveSelection={studio.moveSelection}
        clearSelection={studio.clearSelection}
        flipView={studio.flipView}
        undo={studio.undo}
        redo={studio.redo}
        panel={mobilePanel}
        onPanelChange={setMobilePanel}
      />
      <footer>
        {status} · {configured ? 'Firebase設定あり' : 'Firebase未設定：端末内保存で利用できます'}
      </footer>
      {preview && (
        <PixelPreview
          setPreview={studio.setPreview}
          active={studio.active}
          project={studio.project}
        />
      )}
      {/* 条件付きレンダリング：対応するフラグがtrueのときだけダイアログを作る。 */}
      {library && (
        <ProjectLibraryDialog
          setLibrary={studio.setLibrary}
          newProject={studio.newProject}
          search={studio.search}
          setSearch={studio.setSearch}
          folder={studio.folder}
          setFolder={studio.setFolder}
          folders={studio.folders}
          sort={studio.sort}
          setSort={studio.setSort}
          user={studio.user}
          online={studio.online}
          projectCloudState={studio.projectCloudState}
          redirectLoginError={studio.redirectLoginError}
          pendingCount={studio.pendingCount}
          syncProjects={studio.syncProjects}
          filtered={studio.filtered}
          openProject={studio.openProject}
          rename={studio.rename}
          changeFolder={studio.changeFolder}
          duplicate={studio.duplicate}
          remove={studio.remove}
        />
      )}
      {exportDialog && (
        <ExportDialog
          setExportDialog={studio.setExportDialog}
          pyxel={studio.pyxel}
          setPyxel={studio.setPyxel}
          transparent={studio.transparent}
          setTransparent={studio.setTransparent}
          bg={studio.bg}
          setBg={studio.setBg}
          sheet={studio.sheet}
          setSheet={studio.setSheet}
          cols={studio.cols}
          setCols={studio.setCols}
          exportPixels={studio.exportPixels}
          active={studio.active}
          project={studio.project}
          exportNow={studio.exportNow}
        />
      )}
      {settings && (
        <SettingsDialog
          setSettings={studio.setSettings}
          user={studio.user}
          shortcuts={studio.shortcuts}
          setShortcuts={studio.setShortcuts}
          inputRef={studio.inputRef}
        />
      )}
      {/* ファイル入力自体は隠し、設定画面などのボタンからref.current.click()で開く。 */}
      <input
        ref={inputRef}
        type="file"
        accept=".json,.png,image/png"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importFile(f);
          e.target.value = '';
        }}
      />
      <button
        className="quickimport"
        onClick={() => inputRef.current?.click()}
        title="PNG / JSON読み込み"
      >
        <Upload size={18} />
      </button>
    </div>
  );
}
