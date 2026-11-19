/**
 * パレット保存の案内・Googleログイン・ショートカット・ファイル読み込みをまとめた設定画面。
 * ショートカットはstateとlocalStorageを更新し、次回起動にも残す。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { LogIn, Upload } from 'lucide-react';
import { configured, login, logout } from '../cloud';
type Props = Pick<
  StudioController,
  'setSettings' | 'user' | 'shortcuts' | 'setShortcuts' | 'inputRef'
>;
export function SettingsDialog({ setSettings, user, shortcuts, setShortcuts, inputRef }: Props) {
  return (
    <div className="overlay">
      <div className="dialog">
        <div className="dialoghead">
          <h2>設定</h2>
          <button onClick={() => setSettings(false)}>×</button>
        </div>
        <h3>パレットの保存</h3>
        <p>
          パレット欄で名前を入力して「別名で保存」すると、複数のパレットを保存できます。「保存したパレットを使う」から切り替えてください。
        </p>
        <p>
          色を編集しても名前付きパレットは上書きされません。編集中の色は次回起動・新規作品へ引き継がれます。保存先は同じURL・ブラウザ内です。
        </p>
        <p>
          別のスマホやPCでは、同じGoogleアカウントにログインすると、名前を付けて保存したパレットが一覧へ自動で追加されます。
        </p>
        <h3>クラウド保存</h3>
        <p>
          {configured
            ? 'Firebase設定済み'
            : 'Firebaseの接続情報が未設定です。.envを設定してください。'}
        </p>
        {user ? (
          <>
            <p>ログイン中: {user.email}</p>
            <button onClick={() => logout()}>ログアウト</button>
          </>
        ) : (
          <button
            disabled={!configured}
            onClick={async () => {
              try {
                await login();
              } catch (e) {
                alert(String(e));
              }
            }}
          >
            <LogIn size={16} /> Googleログイン
          </button>
        )}
        <p>
          ログイン中に「保存」を押すと作品がクラウドにも保存されます。別端末では同じGoogleアカウントでログインして「作品一覧」を開いてください。
        </p>
        <h3>ショートカット</h3>
        <p className="hint">各操作のキーを入力してください。重複は設定できません。</p>
        {Object.entries({
          b: 'ペン',
          e: '消しゴム',
          g: '塗りつぶし',
          i: 'スポイト',
          l: '直線',
          r: '四角',
          m: '選択',
          h: '表示移動',
        }).map(([k, label]) => (
          <label className="shortcut" key={k}>
            {label}
            <input
              maxLength={1}
              value={shortcuts[k] ?? k}
              onChange={(e) => {
                const v = e.target.value.toLowerCase();
                if (v && Object.entries(shortcuts).some(([key, val]) => key !== k && val === v)) {
                  alert('すでに使用されているキーです');
                  return;
                }
                const next = { ...shortcuts, [k]: v };
                setShortcuts(next);
                localStorage.setItem('pixel-shortcuts', JSON.stringify(next));
              }}
            />
          </label>
        ))}
        <h3>作品の読み込み</h3>
        <button onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> PNG / JSONを読み込む
        </button>
        <p className="hint">
          ブラウザデータを消すと端末内の作品は失われる場合があります。JSON出力もご利用ください。
        </p>
      </div>
    </div>
  );
}
