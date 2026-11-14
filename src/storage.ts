/**
 * 端末内の作品保存と、クラウド送信待ちキューを担当する。
 * 作品本体：IndexedDB／送信待ち情報：localStorage。どちらも同じURL・ブラウザ内の保存。
 */
import type { Project } from './model';
const DB = 'pixel-studio-private',
  STORE = 'projects';
// IndexedDBを開く。初回作成時だけonupgradeneededが呼ばれ、作品IDをキーにする保存場所を作る。
const db = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE))
        r.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
// 読み取り/書き込みの共通処理。リクエストの発行直後ではなく、トランザクション完了時に解決する。
// <T>は返す値の型を呼び出し元から指定できるジェネリック型。
const operation = async <T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore, done: (v: T) => void) => void,
) => {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    let value: T;
    t.oncomplete = () => {
      d.close();
      resolve(value);
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
    fn(t.objectStore(STORE), (v) => {
      value = v;
    });
  });
};
// 全作品を取り出し、一覧表示などに使う。
export const listLocal = () =>
  operation<Project[]>('readonly', (s, done) => {
    const r = s.getAll();
    r.onsuccess = () => done(r.result);
  });
// 同じIDがあれば更新、なければ新規追加。作品のパレットも一緒に保存する。
export const putLocal = (p: Project) =>
  operation<void>('readwrite', (s, done) => {
    s.put(p);
    done();
  });
// 作品IDに対応する端末内データを削除する。
export const deleteLocal = (id: string) =>
  operation<void>('readwrite', (s, done) => {
    s.delete(id);
    done();
  });
// クラウドへ未送信の操作。baseRevisionは編集・削除の基準になったクラウドの版番号。
export type Pending = { id: string; action: 'save' | 'delete'; baseRevision: number; at: number };
const KEY = 'pixel-studio-pending';
// キューは小さなJSONなのでlocalStorageに保持し、オフラインでも残せるようにする。
export const pending = (): Pending[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};
// 同じ作品の古い送信予定を除き、最新の保存/削除予定を登録する。
export const enqueue = (v: Pending) =>
  localStorage.setItem(KEY, JSON.stringify([...pending().filter((x) => x.id !== v.id), v]));
// 送信に成功した作品だけキューから除く。
export const dequeue = (id: string) =>
  localStorage.setItem(KEY, JSON.stringify(pending().filter((x) => x.id !== id)));
