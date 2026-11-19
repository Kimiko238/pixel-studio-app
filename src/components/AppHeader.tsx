/**
 * 作品一覧・保存・書き出し・設定への入口。ボタンを押すと親の状態や保存処理を呼び出す。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { Cloud, CloudOff, FolderOpen, Save, Download, Settings } from 'lucide-react';
import { ActionButton } from './ActionButton';
type Props = Pick<
  StudioController,
  'online' | 'user' | 'pendingCount' | 'openLibrary' | 'save' | 'setExportDialog' | 'setSettings'
>;
export function AppHeader({
  online,
  user,
  pendingCount,
  openLibrary,
  save,
  setExportDialog,
  setSettings,
}: Props) {
  return (
    <header className="top">
      <div className="brand">
        <span className="brandmark">▦</span>
        <strong>Pixel Studio</strong>
        <small>PRIVATE</small>
      </div>
      <div className="topactions">
        <span className="save-status">
          {online ? <Cloud size={15} /> : <CloudOff size={15} />}{' '}
          {user ? 'クラウド接続' : 'ローカル'}{' '}
          {pendingCount > 0 ? `・同期待ち ${pendingCount}` : ''}
        </span>
        <ActionButton label="作品一覧" onClick={openLibrary} icon={<FolderOpen size={17} />} />
        <ActionButton label="保存" onClick={() => save()} icon={<Save size={17} />} />
        <ActionButton label="別名保存" onClick={() => save(true)} />
        <ActionButton
          label="書き出し"
          onClick={() => setExportDialog(true)}
          icon={<Download size={17} />}
        />
        <button className="iconbutton" title="設定" onClick={() => setSettings(true)}>
          <Settings size={19} />
        </button>
      </div>
    </header>
  );
}
