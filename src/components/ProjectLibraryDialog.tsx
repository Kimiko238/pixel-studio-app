import type { StudioController } from '../hooks/usePixelStudio';
import { useState } from 'react';
import { LogIn, Plus, Trash2 } from 'lucide-react';
import { canvasFromPixels, currentAnimation } from '../model';
import { bytes } from '../utils/drawing';
import { configured, login } from '../cloud';
import { PyxelPaletteExport } from './PyxelPaletteExport';
type Props = Pick<
  StudioController,
  | 'setLibrary'
  | 'newProject'
  | 'search'
  | 'setSearch'
  | 'folder'
  | 'setFolder'
  | 'folders'
  | 'sort'
  | 'setSort'
  | 'user'
  | 'online'
  | 'projectCloudState'
  | 'redirectLoginError'
  | 'pendingCount'
  | 'syncProjects'
  | 'filtered'
  | 'openProject'
  | 'rename'
  | 'changeFolder'
  | 'duplicate'
  | 'remove'
>;
export function ProjectLibraryDialog({
  setLibrary,
  newProject,
  search,
  setSearch,
  folder,
  setFolder,
  folders,
  sort,
  setSort,
  user,
  online,
  projectCloudState,
  redirectLoginError,
  pendingCount,
  syncProjects,
  filtered,
  openProject,
  rename,
  changeFolder,
  duplicate,
  remove,
}: Props) {
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string>();
  const errorMessage = loginError ?? redirectLoginError;
  const signIn = async () => {
    setLoggingIn(true);
    setLoginError('');
    try {
      await login(true);
    } catch (error) {
      setLoginError(
        error instanceof Error && error.message === '許可されていないGoogleアカウントです'
          ? error.message
          : 'Googleログインに失敗しました。通信を確認して、もう一度お試しください。',
      );
    } finally {
      setLoggingIn(false);
    }
  };
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setLibrary(false);
      }}
    >
      <div className="dialog wide">
        <div className="dialoghead">
          <h2>作品一覧</h2>
          <button onClick={() => setLibrary(false)}>×</button>
        </div>
        <div className="librarytools">
          <button onClick={newProject}>
            <Plus size={16} /> 新規作品
          </button>
          <input
            placeholder="作品名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="updated">更新日順</option>
            <option value="name">名前順</option>
            <option value="size">容量順</option>
          </select>
        </div>
        {configured && (
          <section aria-label="作品のクラウド保存">
            {user ? (
              <div className="librarytools">
                <p role="status">
                  {user.email} ·{' '}
                  {!online
                    ? 'オフライン・端末に保存'
                    : projectCloudState === 'error'
                      ? '同期できませんでした'
                      : projectCloudState === 'syncing' || projectCloudState === 'idle'
                        ? '作品を同期中…'
                        : 'クラウドと同期済み'}
                  {pendingCount > 0 && `（同期待ち ${pendingCount} 件）`}
                </p>
                <button
                  onClick={syncProjects}
                  disabled={!online || projectCloudState === 'syncing'}
                >
                  {projectCloudState === 'error' ? '同期を再試行' : '同期する'}
                </button>
              </div>
            ) : (
              <>
                <p>同じGoogleアカウントでログインすると、PC・スマホから保存した作品を開けます。</p>
                <button onClick={signIn} disabled={loggingIn}>
                  <LogIn size={16} /> {loggingIn ? 'ログイン中…' : 'Googleでログイン'}
                </button>
                {errorMessage && <p role="alert">{errorMessage}</p>}
              </>
            )}
          </section>
        )}
        <div className="cards">
          {filtered.map((p) => (
            <div className="workcard" key={p.id}>
              <div className="thumbnail">
                <img
                  src={canvasFromPixels(
                    currentAnimation(p).frames[0].pixels,
                    p.width,
                    p.height,
                  ).toDataURL()}
                  alt="作品サムネイル"
                />
              </div>
              <strong>{p.name}</strong>
              <small>
                {p.folder} · {p.width}×{p.height} · {(bytes(p) / 1024).toFixed(1)}KB
              </small>
              <small>{new Date(p.updated).toLocaleString('ja-JP')}</small>
              <div className="cardactions">
                <button onClick={() => openProject(p)}>開く</button>
                <button onClick={() => rename(p)}>名前</button>
                <button onClick={() => changeFolder(p)}>移動</button>
                <button onClick={() => duplicate(p)}>複製</button>
                <button onClick={() => remove(p)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <PyxelPaletteExport project={p} />
            </div>
          ))}
          {filtered.length === 0 && (
            <p>
              {user && online && (projectCloudState === 'idle' || projectCloudState === 'syncing')
                ? '作品を読み込み中…'
                : search || folder !== 'すべて'
                  ? '条件に一致する作品がありません。'
                  : '保存した作品はありません。'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
