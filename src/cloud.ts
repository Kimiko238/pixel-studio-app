/**
 * Firebase Authentication（認証）とFirestore（作品データ保存）への接続。
 * アプリの公開先であるFirebase Hostingとは別の機能なので、公開だけでは同期は有効にならない。
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import type { Project } from './model';
import type { SavedPalette } from './paletteSettings';
import { isSavedPalette, palettesMatch } from './paletteSettings';
// VITE_から始まる環境変数はViteがビルド時に埋め込む。接続情報の用意は.envで行う。
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
// 未設定なら初期化を省き、端末内保存だけでアプリを利用できるようにする。
export const configured = Boolean(
  config.apiKey && config.projectId && import.meta.env.VITE_ALLOWED_EMAIL,
);
// 開発中の再読み込みなどでFirebaseアプリを重複作成しないよう、既存のものを優先する。
const app = configured ? (getApps()[0] ?? initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const store = app ? getFirestore(app) : null;
// 画面でログインを許可するメールを照合する。データへのアクセス制御はFirestoreルールも担当。
export const allowed = (u: User | null) => !!u && u.email === import.meta.env.VITE_ALLOWED_EMAIL;
// ログイン状態の変化を親へ通知し、戻り値で購読解除できるようにする。
export const listen = (fn: (u: User | null) => void) =>
  auth ? onAuthStateChanged(auth, (u) => fn(allowed(u) ? u : null)) : () => {};
// Google認証のポップアップを開く。許可されていないアカウントなら直後にログアウトする。
export const login = async () => {
  if (!auth) throw Error('Firebase設定が必要です');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: import.meta.env.VITE_ALLOWED_EMAIL });
  // 認証用ドメインと同じ場合だけリダイレクトを使い、それ以外はストレージ制限を避けてポップアップを使う。
  if (
    window.matchMedia('(pointer: coarse)').matches &&
    window.location.hostname === config.authDomain
  ) {
    await signInWithRedirect(auth, provider);
    return;
  }
  const r = await signInWithPopup(auth, provider);
  if (!allowed(r.user)) {
    await signOut(auth);
    throw Error('許可されていないGoogleアカウントです');
  }
  return r.user;
};
// リダイレクトから戻った場合も、許可されたアカウントか確認する。
export const completeRedirectLogin = async () => {
  if (!auth) return;
  const result = await getRedirectResult(auth);
  if (result && !allowed(result.user)) {
    await signOut(auth);
    throw Error('同期には指定したGoogleアカウントでログインしてください。');
  }
};
export const logout = () => (auth ? signOut(auth) : Promise.resolve());
// ユーザーごとの保存先：users/{ユーザーID}/projects/{作品ID}。
const ref = (u: User, id: string) => doc(store!, 'users', u.uid, 'projects', id);
// 作品が存在しない場合はnullを返す。同期側はこの結果と版番号を使って競合を判断する。
export const cloudGet = async (u: User, id: string) => {
  const d = await getDoc(ref(u, id));
  return d.exists() ? (d.data() as Project) : null;
};
// 指定ユーザーのクラウド作品を一覧取得する。
export const cloudList = async (u: User) => {
  const q = await getDocs(collection(store!, 'users', u.uid, 'projects'));
  return q.docs.map((d) => d.data() as Project);
};
// setDocは同じ作品IDのドキュメントを更新し、なければ新規作成する。
export const cloudPut = (u: User, p: Project) => setDoc(ref(u, p.id), p);
export const cloudDelete = (u: User, id: string) => deleteDoc(ref(u, id));

// パレットは1件ずつ独立したドキュメントへ保存し、別の端末から追加しても衝突しにくくする。
const paletteCollection = (u: User) => collection(store!, 'users', u.uid, 'palettes');
export const listenCloudPalettes = (
  u: User,
  onChange: (palettes: SavedPalette[], fromCache: boolean) => void,
  onError: (error: Error) => void,
) =>
  onSnapshot(
    paletteCollection(u),
    { includeMetadataChanges: true },
    (snapshot) => {
      const palettes = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })).filter(isSavedPalette);
      onChange(palettes, snapshot.metadata.fromCache);
    },
    onError,
  );

export const cloudSavePalette = async (u: User, palette: SavedPalette) => {
  const target = doc(paletteCollection(u), palette.id);
  // 既存の名前付きデータは書き換えず、未保存のパレットだけを追加する。
  await runTransaction(store!, async (transaction) => {
    const existing = await transaction.get(target);
    if (existing.exists()) {
      const data = existing.data();
      if (
        data.name !== palette.name ||
        !Array.isArray(data.colors) ||
        !palettesMatch(data.colors, palette.colors)
      ) {
        throw Error('パレットの競合を検出しました。もう一度同期してください。');
      }
      return;
    }
    transaction.set(target, { name: palette.name, colors: palette.colors });
  });
};
