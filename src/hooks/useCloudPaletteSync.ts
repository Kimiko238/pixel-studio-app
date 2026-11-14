/** 名前付きパレットをFirestoreと同期する。編集中の作品や色は勝手に切り替えない。 */
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { User } from 'firebase/auth';
import { cloudSavePalette, listenCloudPalettes } from '../cloud';
import { mergeCloudPaletteLibrary, type PaletteLibrary } from '../paletteSettings';

export type PaletteCloudState =
  'signed-out' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';
export function useCloudPaletteSync(
  user: User | null,
  online: boolean,
  library: PaletteLibrary,
  libraryRef: MutableRefObject<PaletteLibrary>,
  persist: (next: PaletteLibrary) => boolean,
) {
  const [paletteCloudState, setState] = useState<PaletteCloudState>('signed-out');
  const [paletteCloudError, setError] = useState('');
  const [readyUid, setReadyUid] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const knownIds = useRef(new Set<string>());

  useEffect(() => {
    setReadyUid(null);
    knownIds.current = new Set();
    setError('');
    if (!user) {
      setState('signed-out');
      return;
    }
    if (!online) {
      setState('offline');
      return;
    }
    let active = true;
    setState('connecting');
    const unsubscribe = listenCloudPalettes(
      user,
      (remote, fromCache) => {
        if (!active || fromCache) return;
        knownIds.current = new Set(remote.map((p) => p.id));
        const next = mergeCloudPaletteLibrary(libraryRef.current, remote);
        if (next !== libraryRef.current && !persist(next)) {
          setState('error');
          setError('受け取ったパレットを端末に保存できませんでした。');
          return;
        }
        setReadyUid(user.uid);
        setError('');
        setState(
          libraryRef.current.palettes.some((p) => !knownIds.current.has(p.id))
            ? 'syncing'
            : 'synced',
        );
      },
      () => {
        if (!active) return;
        setState('error');
        setError('クラウドに接続できませんでした。通信を確認して再試行してください。');
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, online, persist, libraryRef, attempt]);

  useEffect(() => {
    if (!user || !online || readyUid !== user.uid) return;
    const pending = library.palettes.filter((p) => !knownIds.current.has(p.id));
    if (!pending.length) return;
    let active = true;
    setState('syncing');
    Promise.all(pending.map((palette) => cloudSavePalette(user, palette)))
      .then(() => {
        if (!active) return;
        pending.forEach((p) => knownIds.current.add(p.id));
        setError('');
        setState('synced');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
        setError('端末には保存済みですが、クラウドへ保存できませんでした。再試行してください。');
      });
    return () => {
      active = false;
    };
  }, [user, online, readyUid, library.palettes]);

  return {
    paletteCloudState,
    paletteCloudError,
    retryPaletteCloud: () => setAttempt((v) => v + 1),
  };
}
