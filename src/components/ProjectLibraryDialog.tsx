/**
 * 端末内に保存した作品の一覧。検索・フォルダ・並び替え条件は親のフックで計算する。
 * 各カードの操作は親へ依頼し、クラウドから取得するときだけリモート作品を端末内へ反映する。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { Plus, Trash2 } from 'lucide-react';
import { canvasFromPixels, currentAnimation } from '../model';
import { bytes } from '../utils/drawing';
import { cloudList } from '../cloud';
import { listLocal, putLocal } from '../storage';
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
  | 'refresh'
  | 'setStatus'
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
  refresh,
  setStatus,
  filtered,
  openProject,
  rename,
  changeFolder,
  duplicate,
  remove,
}: Props) {
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
          <button
            onClick={async () => {
              if (!user) return alert('Googleログインが必要です');
              const remote = await cloudList(user);
              for (const p of remote) {
                const local = (await listLocal()).find((q) => q.id === p.id);
                if (!local || local.revision < p.revision) await putLocal(p);
              }
              await refresh();
              setStatus('クラウド作品を読み込みました');
            }}
            disabled={!user}
          >
            クラウドから取得
          </button>
        </div>
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
            </div>
          ))}
          {filtered.length === 0 && <p>保存した作品はありません。まず「保存」を押してください。</p>}
        </div>
      </div>
    </div>
  );
}
