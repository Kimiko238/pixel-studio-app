/** Googleアカウントへのログインと、パレットの同期状態を表示する。 */
import { useState } from 'react';
import { Cloud, LogIn, RefreshCw } from 'lucide-react';
import type { StudioController } from '../hooks/usePixelStudio';
import { configured, login } from '../cloud';

type Props = Pick<
  StudioController,
  'user' | 'paletteCloudState' | 'paletteCloudError' | 'retryPaletteCloud'
>;
export function PaletteCloudControls({
  user,
  paletteCloudState,
  paletteCloudError,
  retryPaletteCloud,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const labels = {
    'signed-out': 'ログインすると、別のスマホやPCでも保存したパレットを使えます。',
    connecting: '保存したパレットを読み込み中…',
    syncing: 'パレットをクラウドに保存中…',
    synced: 'クラウド保存済み。同じGoogleアカウントで別の端末でも使えます。',
    offline: 'オフラインです。端末に保存し、接続後に同期します。',
    error: paletteCloudError,
  };
  return (
    <div className="palette-cloud">
      <strong>
        <Cloud size={16} /> 端末間でパレットを共有
      </strong>
      {!user ? (
        <button
          className="button"
          disabled={!configured || busy}
          onClick={async () => {
            setBusy(true);
            setLoginError('');
            try {
              await login();
            } catch {
              setLoginError(
                'Googleログインを完了できませんでした。指定したアカウントで、通常のブラウザからお試しください。',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogIn size={16} /> {busy ? 'ログイン中…' : 'Googleでログインして同期'}
        </button>
      ) : (
        <small className="hint">{user.email}</small>
      )}
      <p
        className={
          'palette-feedback' +
          (paletteCloudState === 'error' || loginError ? ' palette-feedback-error' : '')
        }
        role="status"
      >
        {(!user && loginError) || labels[paletteCloudState]}
      </p>
      {user && paletteCloudState === 'error' && (
        <button onClick={retryPaletteCloud}>
          <RefreshCw size={14} /> 同期を再試行
        </button>
      )}
      <small className="hint">
        「別名で保存」したパレットが自動で同期されます。編集中の絵や色は勝手に切り替わりません。
      </small>
    </div>
  );
}
