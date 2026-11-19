/**
 * 編集機能をまとめるカスタムフック。use〜という名前でReactの状態・副作用を組み合わせる。
 * 主な流れ：入力イベント → 座標/ピクセル計算 → commitで作品更新 → useEffectでcanvasへ描画。
 * 作品の保存は「保存」ボタンで行い、パレット設定の保持はusePaletteLibraryが別に担当する。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Project,
  type Frame,
  type Animation,
  COLORS,
  uid,
  frame,
  createProject,
  clone,
  currentAnimation,
  resizePixels,
  canvasFromPixels,
  download,
  pngBlob,
  nearestColor,
  fileName,
} from '../model';
import {
  listLocal,
  stageProject,
  pendingProjects,
  finishProjectSync,
  mergeCloudProjects,
} from '../storage';
import {
  configured,
  listen,
  completeRedirectLogin,
  consumeProjectLoginReturn,
  cloudApplyProject,
  cloudList,
} from '../cloud';
import type { User } from 'firebase/auth';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

import type { Tool, Selection } from '../tools';
import {
  px,
  points,
  mutate,
  fill,
  bytes,
  moveSelectionPixels,
  selectionContentBounds,
} from '../utils/drawing';
import { loadSharedPalette } from '../paletteSettings';
import { usePaletteLibrary } from './usePaletteLibrary';
type SelectionGesture = {
  pointerId: number;
  x: number;
  y: number;
  frame: Frame;
  previousSelection: Selection | null;
  move: { area: Selection; bounds: Selection } | null;
};

export function usePixelStudio() {
  // useStateは画面に反映したい値を保持する。setProjectで更新するとReactが再描画する。
  // 初期化関数は初回に使われ、前回の作業用パレットを持つ空の作品を作る。
  const [project, setProject] = useState<Project>(() => ({
    ...createProject(),
    palette: loadSharedPalette(),
  }));
  const [user, setUser] = useState<User | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const {
    paletteLibrary,
    sharedPalette,
    paletteSaveError,
    savePaletteAs,
    selectSavedPalette,
    importPalettes,
    paletteCloudState,
    paletteCloudError,
    retryPaletteCloud,
  } = usePaletteLibrary(project, user, online);
  const [projectCloudState, setProjectCloudState] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [redirectLoginError, setRedirectLoginError] = useState('');
  const syncTask = useRef(Promise.resolve());
  const activeUser = useRef<User | null>(null);
  const [saved, setSaved] = useState<Project[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  // 描画に関する状態。実際のピクセル配列はprojectに、拡大率や表示反転は別の状態に持つ。
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState(project.palette[8] ?? project.palette[0] ?? COLORS[0]);
  const [zoom, setZoom] = useState(24);
  const [grid, setGrid] = useState(true);
  const [symH, setSymH] = useState(false);
  const [symV, setSymV] = useState(false);
  const [onion, setOnion] = useState(false);
  const [flipView, setFlipView] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionGesture = useRef<SelectionGesture | null>(null);
  const [selectionPreview, setSelectionPreview] = useState<{
    frame: Frame;
    area: Selection;
    pixels: string[];
  } | null>(null);
  const [clipboard, setClipboard] = useState<{ pixels: string[]; w: number; h: number } | null>(
    null,
  );
  // dirtyは「作品に未保存の変更があるか」。パレット設定の自動保存とは別に管理する。
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('準備完了');
  // ここからは一覧・設定・プレビュー・書き出しなど、画面の開閉や表示条件。
  const [library, setLibrary] = useState(false);
  const [settings, setSettings] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [folder, setFolder] = useState('すべて');
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [pyxel, setPyxel] = useState(false);
  const [transparent, setTransparent] = useState(true);
  const [bg, setBg] = useState('#ff00ff');
  const [sheet, setSheet] = useState<'horizontal' | 'vertical' | 'columns'>('horizontal');
  const [cols, setCols] = useState(4);
  // 押し始めた位置・描画前のピクセル・移動表示用の座標を、ドラッグ中だけ覚えておく。
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    pixels: string[];
    panX: number;
    panY: number;
  } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  // historyは戻す前の作品、futureはやり直せる作品の配列。状態は作品全体のコピーで保持する。
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('pixel-shortcuts') || '{}');
    } catch {
      return {};
    }
  });
  // DOMを直接操作するためのref。stateと違い、refの更新そのものでは再描画しない。
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // タイマーやイベント処理が、作成時点の古い値を参照し続けないよう最新値をrefにも入れる。
  const frameRef = useRef(frameIndex);
  frameRef.current = frameIndex;
  const projectRef = useRef(project);
  projectRef.current = project;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  // 選択中のアニメーションとコマを、作品データとframeIndexから取り出す。
  const anim = currentAnimation(project),
    active = anim.frames[Math.min(frameIndex, anim.frames.length - 1)] || anim.frames[0];
  // Undoの対象となる編集の共通入口。元データを複製してからfnへ渡すので履歴を壊さない。
  // 同じ内容なら更新を省き、変更があれば直前の作品を履歴に積み、Redoを消して未保存にする。
  const commit = useCallback((fn: (p: Project) => Project) => {
    setProject((prev) => {
      const next = fn(clone(prev));
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      setHistory((h) => [...h.slice(-99), prev]);
      setFuture([]);
      setDirty(true);
      return next;
    });
  }, []);
  // ピクセル変更をcommit経由で確定する。同じlink IDのコマにも、同じ内容の配列をコピーする。
  const editPixels = useCallback(
    (pixels: string[]) =>
      commit((p) => {
        const a = currentAnimation(p);
        const f = a.frames[Math.min(frameRef.current, a.frames.length - 1)];
        const linked = f.link;
        a.frames.forEach((g) => {
          if (g.id === f.id || (linked && g.link === linked)) g.pixels = [...pixels];
        });
        return p;
      }),
    [commit],
  );
  // Undo：直前の作品をhistoryから取り出し、現在の作品をfutureへ退避する。
  const undo = useCallback(() => {
    if (!history.length) return;
    const prev = history.at(-1)!;
    setFuture((f) => [...f, project]);
    setHistory((h) => h.slice(0, -1));
    setProject({ ...prev, revision: project.revision });
    setDirty(true);
  }, [history, project]);
  // Redo：futureから作品を戻し、現在の作品をhistoryへ積み直す。
  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future.at(-1)!;
    setHistory((h) => [...h, project]);
    setFuture((f) => f.slice(0, -1));
    setProject({ ...next, revision: project.revision });
    setDirty(true);
  }, [future, project]);
  // IndexedDBから保存済み作品を読み直す。編集画面のprojectとは別の一覧用データ。
  const refresh = useCallback(async () => {
    try {
      const { saved, waiting } = await listLocal();
      setSaved(saved);
      setPendingCount(waiting);
    } catch {
      setStatus('保存一覧を読み込めませんでした');
    }
  }, []);
  useEffect(() => {
    // 初回表示時に一覧を取得し、Firebase設定があればログイン状態の監視も始める。
    // listenの戻り値を返すことで、画面破棄時に監視を解除できる。
    refresh();
    if (configured) {
      if (consumeProjectLoginReturn()) setLibrary(true);
      void completeRedirectLogin().catch(() => {
        const message =
          'Googleログインを完了できませんでした。指定したアカウントでもう一度お試しください。';
        setRedirectLoginError(message);
        setStatus(message);
      });
      return listen((next) => {
        activeUser.current = next;
        setUser(next);
        if (!next) setProjectCloudState('idle');
      });
    }
  }, [refresh]);
  useEffect(() => {
    // ブラウザのオンライン・オフライン通知に合わせて通信状態を更新する。
    const on = () => setOnline(navigator.onLine),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    // 未保存の作品があるときは、ページを離れる前にブラウザ標準の確認を出す。
    const fn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, []);
  const syncProjects = useCallback(() => {
    if (!user || !navigator.onLine) return;
    const sync = async () => {
      if (activeUser.current !== user || !navigator.onLine) return;
      setProjectCloudState('syncing');
      let failed = false;
      try {
        for (const change of await pendingProjects()) {
          if (activeUser.current !== user || !navigator.onLine) return;
          try {
            const result = await cloudApplyProject(user, change);
            await finishProjectSync(change, result);
            if (result.copy) setStatus('別端末で変更されたため、作品一覧に両方の版を残しました');
            else if (result.conflict)
              setStatus('別端末で更新された作品があるため、クラウド版を残しました');
          } catch {
            // 送信できなかった操作は残し、他の作品の同期は続ける。
            failed = true;
          }
        }
        if (activeUser.current !== user || !navigator.onLine) return;
        const remote = await cloudList(user);
        if (activeUser.current !== user) return;
        await mergeCloudProjects(remote);
      } catch {
        failed = true;
      } finally {
        await refresh();
        if (activeUser.current === user) setProjectCloudState(failed ? 'error' : 'synced');
      }
    };
    syncTask.current = syncTask.current
      .then(async () => {
        if (navigator.locks) await navigator.locks.request('pixel-studio-project-sync', sync);
        else await sync();
      })
      .catch(() => setProjectCloudState('error'));
  }, [user, refresh]);
  const openLibrary = () => {
    setLibrary(true);
    syncProjects();
  };
  useEffect(() => {
    if (online) syncProjects();
  }, [syncProjects, online]);
  // 作品の手動保存。まずIndexedDBへ保存し、その後クラウド送信用のキューへ登録する。
  // asNew=trueでは新しい作品IDを発行し、元の作品を上書きしない。
  const save = async (asNew = false) => {
    try {
      let p = clone(project);
      if (asNew) {
        const name = prompt('別名で保存する作品名', p.name + ' コピー');
        if (!name) return;
        p.id = uid();
        p.name = name;
        p.revision = 0;
      } else p.revision += 1;
      p.updated = Date.now();
      if (bytes(p) > 500_000)
        alert('この作品は容量が大きくなっています。保存容量にご注意ください。');
      p = await stageProject(p, asNew ? 0 : project.revision, 'save');
      if (projectRef.current === project) {
        setProject(p);
        setDirty(false);
      } else if (!asNew && projectRef.current.id === project.id) {
        setProject((current) =>
          current.id === p.id && current.revision < p.revision
            ? { ...current, revision: p.revision }
            : current,
        );
      }
      setStatus('端末に保存しました');
      await refresh();
      syncProjects();
    } catch (e) {
      alert('保存に失敗しました: ' + String(e));
    }
  };
  // 保存済み作品を編集画面へ読み込み、前の作品の履歴・選択範囲などをリセットする。
  const openProject = (p: Project) => {
    if (dirty && !confirm('保存していない変更を破棄しますか？')) return;
    setProject(clone(p));
    setFrameIndex(0);
    setHistory([]);
    setFuture([]);
    setSelection(null);
    setDirty(false);
    setLibrary(false);
  };
  // 端末内で作品を削除し、クラウドの削除はキューを通して反映する。
  const remove = async (p: Project) => {
    if (!confirm(`「${p.name}」を完全削除しますか？\nこの操作は取り消せません。`)) return;
    try {
      await stageProject(p, p.revision, 'delete');
      setStatus('作品を削除しました');
      await refresh();
      syncProjects();
    } catch {
      setStatus('作品を削除できませんでした');
    }
  };
  const saveLibraryChange = async (p: Project, baseRevision: number) => {
    try {
      const saved = await stageProject(p, baseRevision, 'save');
      await refresh();
      syncProjects();
      return saved;
    } catch {
      setStatus('作品を保存できませんでした');
      return null;
    }
  };
  // 元データを複製して別の作品として保存する。
  const duplicate = (p: Project) =>
    saveLibraryChange(
      { ...clone(p), id: uid(), name: p.name + ' コピー', updated: Date.now(), revision: 0 },
      0,
    );
  const rename = async (p: Project) => {
    const name = prompt('作品名を変更', p.name);
    if (!name) return;
    const next = { ...p, name, updated: Date.now(), revision: p.revision + 1 };
    const saved = await saveLibraryChange(next, p.revision);
    if (saved) {
      setProject((current) =>
        current.id === p.id && current.revision === p.revision
          ? { ...current, name, updated: next.updated, revision: saved.revision }
          : current,
      );
    }
  };
  const changeFolder = async (p: Project) => {
    const name = prompt('フォルダ名（新しい名前でも可）', p.folder);
    if (name === null) return;
    const next = { ...p, folder: name || '未分類', updated: Date.now(), revision: p.revision + 1 };
    const saved = await saveLibraryChange(next, p.revision);
    if (saved) {
      setProject((current) =>
        current.id === p.id && current.revision === p.revision
          ? { ...current, folder: next.folder, updated: next.updated, revision: saved.revision }
          : current,
      );
    }
  };
  // 入力した寸法を検証して空の作品を作る。色はパレットライブラリの作業用コピーを引き継ぐ。
  const newProject = () => {
    if (dirty && !confirm('保存していない変更を破棄しますか？')) return;
    const w = Number(prompt('横幅（ピクセル）', '16')),
      h = Number(prompt('高さ（ピクセル）', '16'));
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w * h > 1048576) {
      alert('1以上の整数で、合計約100万ピクセル以下を指定してください');
      return;
    }
    const next = createProject('無題の作品', w, h);
    next.palette = [...sharedPalette];
    setProject(next);
    setColor(next.palette[0] ?? COLORS[0]);
    setFrameIndex(0);
    setHistory([]);
    setFuture([]);
    setDirty(true);
    setLibrary(false);
  };
  // JSONは外部入力なので、作品として必要な寸法・コマ・ピクセル配列があるか確認する。
  const importJSON = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Project;
      if (
        !data.name ||
        !Number.isInteger(data.width) ||
        !Number.isInteger(data.height) ||
        data.width < 1 ||
        data.height < 1 ||
        data.width * data.height > 1048576 ||
        !Array.isArray(data.animations) ||
        !data.animations.length ||
        data.animations.some(
          (a) =>
            !Array.isArray(a.frames) ||
            a.frames.some(
              (f) => !Array.isArray(f.pixels) || f.pixels.length !== data.width * data.height,
            ),
        )
      )
        throw Error('作品形式が正しくありません');
      data.id = uid();
      data.name += '（読み込み）';
      data.revision = 0;
      data.updated = Date.now();
      openProject(data);
      setDirty(true);
    } catch (e) {
      alert('JSON読み込み失敗: ' + String(e));
    }
  };
  // PNGをキャンバスへ描いてRGBA値を読み、1ピクセルずつ16進数の色文字列へ変換する。
  // これは絵を読み込む機能。パレット用PNGの色抽出はutils/palette.tsに分けている。
  const importPNG = async (file: File) => {
    const image = new Image();
    image.onload = () => {
      let w = project.width,
        h = project.height;
      const choice = prompt(
        `画像サイズ ${image.width}×${image.height}px\n1: 元のサイズに変更 / 2: 現在のサイズへ縮小拡大 / 3: 左上から切り抜き`,
        '1',
      );
      if (!choice) return;
      if (choice === '1') {
        w = image.width;
        h = image.height;
      }
      if (w * h > 1048576) {
        alert('画像が大きすぎます');
        return;
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      // ドット絵がぼけないよう、画像サイズを変えるときの補間を無効にする。
      ctx.imageSmoothingEnabled = false;
      if (choice === '2') ctx.drawImage(image, 0, 0, w, h);
      else ctx.drawImage(image, 0, 0);
      const raw = ctx.getImageData(0, 0, w, h).data;
      const pixels = Array.from({ length: w * h }, (_, i) =>
        raw[i * 4 + 3] < 128
          ? ''
          : '#' +
            Array.from(raw.slice(i * 4, i * 4 + 3))
              .map((n) => n.toString(16).padStart(2, '0'))
              .join(''),
      );
      commit((p) => {
        if (w !== p.width || h !== p.height) {
          p.animations.forEach((a) =>
            a.frames.forEach((f) => (f.pixels = resizePixels(f.pixels, p.width, p.height, w, h))),
          );
          p.width = w;
          p.height = h;
        }
        currentAnimation(p).frames[frameRef.current].pixels = pixels;
        return p;
      });
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  };
  // ファイルの種類に応じて作品JSONの読み込みと画像の読み込みを振り分ける。
  const importFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.json')) await importJSON(file);
    else if (file.type.startsWith('image/')) await importPNG(file);
    else alert('PNGまたはJSONを選択してください');
  };
  // 全コマの寸法を変更する。拡大縮小する場合と、左上を基準に切り抜き・余白追加する場合がある。
  const resize = () => {
    const w = Number(prompt('新しい横幅', String(project.width))),
      h = Number(prompt('新しい高さ', String(project.height)));
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w * h > 1048576) return;
    const scale = confirm(
      'OK: 全体を新しいサイズに拡大・縮小\nキャンセル: キャンバスの大きさだけ変更',
    );
    commit((p) => {
      p.animations.forEach((a) =>
        a.frames.forEach(
          (f) => (f.pixels = resizePixels(f.pixels, p.width, p.height, w, h, scale)),
        ),
      );
      p.width = w;
      p.height = h;
      return p;
    });
    setSelection(null);
  };
  // 座標を変換して左右反転・上下反転・90度回転する。回転時は縦横の寸法が入れ替わる。
  const transform = (kind: 'h' | 'v' | 'rotate') => {
    commit((p) => {
      const f = currentAnimation(p).frames[frameRef.current],
        w = p.width,
        h = p.height;
      const old = [...f.pixels];
      const result = Array(w * h).fill('');
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let nx = x,
            ny = y;
          if (kind === 'h') nx = w - 1 - x;
          if (kind === 'v') ny = h - 1 - y;
          if (kind === 'rotate') {
            nx = h - 1 - y;
            ny = x;
          }
          const dest = kind === 'rotate' ? ny * h + nx : ny * w + nx;
          result[dest] = old[y * w + x];
        }
      if (kind === 'rotate') {
        p.animations.forEach((a) =>
          a.frames.forEach((fr) => {
            const next = Array(w * h).fill('');
            for (let y = 0; y < h; y++)
              for (let x = 0; x < w; x++) next[x * h + (h - 1 - y)] = fr.pixels[y * w + x];
            fr.pixels = next;
          }),
        );
        p.width = h;
        p.height = w;
      } else f.pixels = result;
      return p;
    });
  };
  const clearSelection = () => {
    selectionGesture.current = null;
    setSelectionPreview(null);
    setSelection(null);
  };
  // 選択範囲をアプリ内のクリップボードへコピーする。OSのクリップボードとは別の状態。
  const copySelection = () => {
    if (!selection) return;
    const { x, y, w, h } = selection;
    setClipboard({
      pixels: Array.from(
        { length: w * h },
        (_, i) => active.pixels[(y + Math.floor(i / w)) * project.width + x + (i % w)],
      ),
      w,
      h,
    });
    setStatus('範囲をコピーしました');
  };
  // コピーした矩形を選択位置（未選択なら左上）へ貼る。キャンバス外の座標は無視する。
  const paste = () => {
    if (!clipboard) return;
    const x = selection?.x ?? 0,
      y = selection?.y ?? 0;
    const next = [...active.pixels];
    for (let j = 0; j < clipboard.h; j++)
      for (let i = 0; i < clipboard.w; i++) {
        const at = px(x + i, y + j, project.width, project.height);
        if (at >= 0) next[at] = clipboard.pixels[j * clipboard.w + i];
      }
    editPixels(next);
    setSelection({ x, y, w: clipboard.w, h: clipboard.h });
  };
  // 選択範囲の元の位置を消してから移動先へ描き、選択枠の位置も一緒に更新する。
  const moveSelection = (dx: number, dy: number) => {
    if (!selection) return;
    editPixels(
      moveSelectionPixels(active.pixels, selection, dx, dy, project.width, project.height),
    );
    setSelection({ ...selection, x: selection.x + dx, y: selection.y + dy });
  };
  // 選択範囲の中だけ左右を入れ替える。キャンバス全体の反転とは別の操作。
  const flipSelection = () => {
    if (!selection) return;
    const { x, y, w, h } = selection,
      next = [...active.pixels];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const at = px(x + i, y + j, project.width, project.height),
          src = px(x + w - 1 - i, y + j, project.width, project.height);
        if (at >= 0 && src >= 0) next[at] = active.pixels[src];
      }
    editPixels(next);
  };
  // 現在のコマで指定色に一致するピクセルだけを別の色に置き換える。
  const replaceColor = () => {
    const old = prompt('置換元の色（#RRGGBB）', color);
    if (!old) return;
    const next = prompt('置換先の色（#RRGGBB）', '#ffffff');
    if (!next || !/^#[0-9a-fA-F]{6}$/.test(next)) return;
    editPixels(
      active.pixels.map((c) => (c.toLowerCase() === old.toLowerCase() ? next.toLowerCase() : c)),
    );
  };
  // 現在のコマの直後に空のコマを挿入して、選択を新しいコマへ移す。
  const addFrame = () => {
    commit((p) => {
      currentAnimation(p).frames.splice(frameRef.current + 1, 0, frame(p.width, p.height));
      return p;
    });
    setFrameIndex((i) => i + 1);
  };
  // linked=trueなら同じlink IDを持たせる。editPixelsがそのIDを使ってコマ間の編集を同期する。
  const duplicateFrame = (linked = false) => {
    commit((p) => {
      const a = currentAnimation(p),
        f = a.frames[frameRef.current];
      if (linked && !f.link) f.link = uid();
      a.frames.splice(frameRef.current + 1, 0, { ...clone(f), id: uid(), pixels: [...f.pixels] });
      return p;
    });
    setFrameIndex((i) => i + 1);
  };
  // アニメーションには最低1コマを残す。削除後は選択番号が負にならないよう調整する。
  const removeFrame = () => {
    if (anim.frames.length === 1) return;
    commit((p) => {
      currentAnimation(p).frames.splice(frameRef.current, 1);
      return p;
    });
    setFrameIndex((i) => Math.max(0, i - 1));
  };
  // 隣のコマと配列内の位置を入れ替えて、表示・再生の順序を変更する。
  const moveFrame = (dir: number) => {
    const j = frameIndex + dir;
    if (j < 0 || j >= anim.frames.length) return;
    commit((p) => {
      const f = currentAnimation(p).frames;
      [f[frameIndex], f[j]] = [f[j], f[frameIndex]];
      return p;
    });
    setFrameIndex(j);
  };
  // 作品の中に新しいアニメーションを追加し、それを選択状態にする。
  const addAnimation = () => {
    const name = prompt('アニメーション名', '新しいアニメーション');
    if (!name) return;
    const a: Animation = {
      id: uid(),
      name,
      fps: 8,
      mode: 'loop',
      frames: [frame(project.width, project.height)],
    };
    commit((p) => {
      p.animations.push(a);
      p.activeAnimation = a.id;
      return p;
    });
    setFrameIndex(0);
  };
  // アニメーションを切り替えたら、その先頭のコマから編集を始める。
  const chooseAnimation = (id: string) => {
    commit((p) => {
      p.activeAnimation = id;
      return p;
    });
    setFrameIndex(0);
  };
  // 書き出し専用の色変換。元のコマを変更せず、Pyxel色への変換や透明色の代替を行う。
  const exportPixels = (f: Frame) =>
    f.pixels.map((c) => (c ? (pyxel ? nearestColor(c, COLORS) : c) : transparent ? '' : bg));
  // 書き出し形式ごとに処理を分ける。PNGは現在のコマ、シートとGIFは選択中アニメーションを使う。
  const exportNow = async (kind: 'png' | 'sheet' | 'gif' | 'json') => {
    try {
      if (kind === 'json') {
        download(
          new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
          fileName(project.name) + '.json',
        );
        return;
      }
      if (kind === 'png') {
        download(
          await pngBlob(canvasFromPixels(exportPixels(active), project.width, project.height)),
          fileName(project.name) + '.png',
        );
        return;
      }
      const frames = anim.frames;
      // コマ番号を「列=i%列数・行=floor(i/列数)」に分解して、1枚の画像へ並べる。
      if (kind === 'sheet') {
        const n = frames.length,
          columns = sheet === 'horizontal' ? n : sheet === 'vertical' ? 1 : Math.max(1, cols),
          rows = Math.ceil(n / columns),
          c = document.createElement('canvas');
        c.width = columns * project.width;
        c.height = rows * project.height;
        const ctx = c.getContext('2d')!;
        frames.forEach((f, i) =>
          ctx.drawImage(
            canvasFromPixels(exportPixels(f), project.width, project.height),
            (i % columns) * project.width,
            Math.floor(i / columns) * project.height,
          ),
        );
        download(await pngBlob(c), fileName(project.name) + '-sheet.png');
        return;
      }
      // 各コマをRGBA→パレット色→色番号の配列へ変換し、表示時間とともにGIFへ追加する。
      if (kind === 'gif') {
        const gif = GIFEncoder();
        for (const f of frames) {
          const c = canvasFromPixels(exportPixels(f), project.width, project.height),
            data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
          const palette = quantize(data, 256, { format: 'rgba4444' });
          const index = applyPalette(data, palette, 'rgba4444');
          gif.writeFrame(index, c.width, c.height, {
            palette,
            delay: f.duration || Math.round(1000 / anim.fps),
            repeat: anim.mode === 'once' ? -1 : 0,
          });
        }
        gif.finish();
        download(new Blob([gif.bytes()], { type: 'image/gif' }), fileName(project.name) + '.gif');
      }
      setExportDialog(false);
    } catch (e) {
      alert('書き出し失敗: ' + String(e));
    }
  };
  const previewedMove =
    tool === 'select' && selectionPreview?.frame === active ? selectionPreview : null;
  const canvasPixels = previewedMove?.pixels ?? active.pixels;
  // Reactの状態をHTML canvasへ反映する。必要なら1つ前のコマを薄く重ねてから現在のコマを描く。
  const drawPreview = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const w = project.width,
      h = project.height;
    c.width = w;
    c.height = h;
    ctx.clearRect(0, 0, w, h);
    if (onion && frameIndex > 0) {
      ctx.globalAlpha = 0.25;
      ctx.drawImage(canvasFromPixels(anim.frames[frameIndex - 1].pixels, w, h), 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(canvasFromPixels(canvasPixels, w, h), 0, 0);
  }, [project, anim, canvasPixels, frameIndex, onion]);
  // 依存する作品や選択コマが変わったあとに、canvasへの描画処理を実行する。
  useEffect(drawPreview, [drawPreview]);
  // 画面上のポインター位置を、拡大表示前のドット座標へ変換する。表示反転時はX座標も逆にする。
  const getPos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * project.width),
      y = Math.floor(((e.clientY - r.top) / r.height) * project.height);
    return { x: flipView ? project.width - 1 - x : x, y };
  };
  const dragSelection = (gesture: SelectionGesture, x: number, y: number, finish: boolean) => {
    const { width, height } = project;
    const limit = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    if (gesture.move) {
      const { area, bounds } = gesture.move;
      const dx = limit(x - gesture.x, -bounds.x, width - bounds.x - bounds.w);
      const dy = limit(y - gesture.y, -bounds.y, height - bounds.y - bounds.h);
      if (!dx && !dy) {
        setSelectionPreview(null);
        return;
      }
      const left = Math.max(0, area.x + dx);
      const top = Math.max(0, area.y + dy);
      const destination = {
        x: left,
        y: top,
        w: Math.min(width, area.x + area.w + dx) - left,
        h: Math.min(height, area.y + area.h + dy) - top,
      };
      const pixels = moveSelectionPixels(gesture.frame.pixels, area, dx, dy, width, height);
      if (finish) {
        editPixels(pixels);
        setSelection(destination);
      } else {
        setSelectionPreview({ frame: gesture.frame, area: destination, pixels });
      }
    } else {
      const endX = limit(x, 0, width - 1);
      const endY = limit(y, 0, height - 1);
      setSelection({
        x: Math.min(gesture.x, endX),
        y: Math.min(gesture.y, endY),
        w: Math.abs(endX - gesture.x) + 1,
        h: Math.abs(endY - gesture.y) + 1,
      });
    }
  };
  // 押した瞬間：操作の開始位置を記録し、ツールに応じて描画・色取得・塗りつぶしを始める。
  // PointerEventなので、マウス・指・ペンを同じ処理で扱える。
  const pointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    // canvasの外へ指が動いても、この操作の移動・終了イベントを受け取れるようにする。
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    setCursor({ x, y });
    if (tool === 'select') {
      const inside =
        selection &&
        x >= selection.x &&
        x < selection.x + selection.w &&
        y >= selection.y &&
        y < selection.y + selection.h;
      const bounds =
        inside && selectionContentBounds(active.pixels, selection, project.width, project.height);
      const move = inside ? { area: selection, bounds: bounds || selection } : null;
      const gesture = {
        pointerId: e.pointerId,
        x,
        y,
        frame: active,
        previousSelection: selection,
        move,
      };
      selectionGesture.current = gesture;
      setPlaying(false);
      if (!move) dragSelection(gesture, x, y, false);
      return;
    }
    setDrag({ x, y, pixels: [...active.pixels], panX: e.clientX, panY: e.clientY });
    if (tool === 'picker') {
      const c = active.pixels[px(x, y, project.width, project.height)];
      if (c) setColor(c);
      return;
    }
    if (tool === 'pan') return;
    if (tool === 'bucket') {
      editPixels(fill(active.pixels, x, y, project.width, project.height, color));
      return;
    }
    if (tool === 'pencil' || tool === 'eraser') {
      const id = px(x, y, project.width, project.height);
      if (id >= 0)
        editPixels(
          mutate(
            active.pixels,
            [id],
            tool === 'eraser' ? '' : color,
            project.width,
            project.height,
            symH,
            symV,
          ),
        );
    }
  };
  // 移動中：ペンは前の位置と現在地を線で結び、素早く動かしたときの描き漏れを防ぐ。
  // 図形ツールは開始時のピクセルから毎回プレビューを作り、まだ履歴には確定しない。
  const pointerMove = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    const { x, y } = getPos(e);
    setCursor({ x, y });
    const gesture = selectionGesture.current;
    if (gesture?.pointerId === e.pointerId) {
      if (tool === 'select' && gesture.frame === active) dragSelection(gesture, x, y, false);
      return;
    }
    if (!drag) return;
    if (tool === 'pan') {
      setPan((p) => ({ x: p.x + e.clientX - drag.panX, y: p.y + e.clientY - drag.panY }));
      setDrag({ ...drag, panX: e.clientX, panY: e.clientY });
      return;
    }
    if (tool === 'pencil' || tool === 'eraser') {
      const ids = points('line', drag.x, drag.y, x, y, project.width, project.height);
      const out = mutate(
        active.pixels,
        ids,
        tool === 'eraser' ? '' : color,
        project.width,
        project.height,
        symH,
        symV,
      );
      editPixels(out);
      setDrag({ ...drag, x, y });
      return;
    }
    if (tool === 'line' || tool === 'rect' || tool === 'fillrect' || tool === 'ellipse') {
      const ids = points(tool, drag.x, drag.y, x, y, project.width, project.height);
      const out = mutate(drag.pixels, ids, color, project.width, project.height, symH, symV);
      setProject((p) => {
        const q = clone(p);
        currentAnimation(q).frames[frameRef.current].pixels = out;
        return q;
      });
    }
  };
  // 離した瞬間：図形のプレビューを開始前の状態に戻してから、commit経由で完成形を確定する。
  const pointerUp = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    const gesture = selectionGesture.current;
    if (gesture?.pointerId === e.pointerId) {
      selectionGesture.current = null;
      setSelectionPreview(null);
      if (tool === 'select' && gesture.frame === active) {
        const { x, y } = getPos(e);
        dragSelection(gesture, x, y, true);
      }
      return;
    }
    if (!drag) return;
    if (['line', 'rect', 'fillrect', 'ellipse'].includes(tool)) {
      const { x, y } = getPos(e);
      const ids = points(tool, drag.x, drag.y, x, y, project.width, project.height);
      const out = mutate(drag.pixels, ids, color, project.width, project.height, symH, symV);
      setProject((p) => {
        const q = clone(p);
        currentAnimation(q).frames[frameRef.current].pixels = drag.pixels;
        return q;
      });
      editPixels(out);
    }
    setDrag(null);
  };
  const pointerCancel = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    const gesture = selectionGesture.current;
    if (gesture?.pointerId === e.pointerId) {
      selectionGesture.current = null;
      setSelectionPreview(null);
      if (gesture.frame === active) setSelection(gesture.previousSelection);
    }
    setDrag(null);
  };
  useEffect(() => {
    // 再生中だけタイマーを動かす。ループ・1回再生・往復で次のコマの選び方を変える。
    if (!playing) return;
    let i = frameIndex,
      dir = 1;
    const t = setInterval(
      () => {
        const a = currentAnimation(projectRef.current),
          count = a.frames.length;
        if (count < 2) return;
        if (a.mode === 'pingpong') {
          if (i + dir >= count || i + dir < 0) dir *= -1;
          i += dir;
        } else if (a.mode === 'once') {
          if (i >= count - 1) {
            setPlaying(false);
            return;
          }
          i++;
        } else i = (i + 1) % count;
        setFrameIndex(i);
      },
      Math.max(30, active.duration || 1000 / anim.fps),
    );
    // 再生条件が変わるときや画面破棄時に、古いタイマーを止めて二重再生を防ぐ。
    return () => clearInterval(t);
  }, [playing, anim.fps, anim.mode, active.duration]);
  useEffect(() => {
    // キーボード操作を保存・Undo/Redo・ツール変更などへ変換する。文字入力中は処理を避ける。
    const fn = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.ctrlKey && e.key.toLowerCase() === 'r')
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        paste();
        return;
      }
      const defaults: Record<string, Tool> = {
        b: 'pencil',
        e: 'eraser',
        g: 'bucket',
        i: 'picker',
        l: 'line',
        r: 'rect',
        m: 'select',
        h: 'pan',
      };
      const key = e.key.toLowerCase();
      const match = (Object.entries(defaults) as [string, Tool][]).find(
        ([k]) => (shortcuts[k] || k) === key,
      );
      if (match) setTool(match[1]);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });
  // Setでフォルダ名の重複を除く。以下の一覧は検索・フォルダ・並び順から毎回計算する。
  const folders = ['すべて', ...new Set(saved.map((p) => p.folder))];
  const filtered = saved
    .filter(
      (p) =>
        (folder === 'すべて' || p.folder === folder) &&
        p.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'size'
          ? bytes(b) - bytes(a)
          : b.updated - a.updated,
    );

  // コンポーネントへ公開する値と操作。ここに含めたものがAppから各画面部品へ渡される。
  return {
    sharedPalette,
    paletteSaveError,
    paletteLibrary,
    savePaletteAs,
    selectSavedPalette,
    importPalettes,
    paletteCloudState,
    paletteCloudError,
    retryPaletteCloud,
    online,
    user,
    setLibrary,
    openLibrary,
    save,
    setExportDialog,
    setSettings,
    setPan,
    tool,
    setTool,
    undo,
    redo,
    copySelection,
    paste,
    moveSelection,
    clearSelection,
    flipSelection,
    replaceColor,
    symH,
    setSymH,
    symV,
    setSymV,
    grid,
    setGrid,
    onion,
    setOnion,
    resize,
    transform,
    setFlipView,
    flipView,
    project,
    color,
    setColor,
    commit,
    setProject,
    setDirty,
    setZoom,
    zoom,
    viewRef,
    pan,
    canvasRef,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    selection: previewedMove?.area ?? selection,
    cursor,
    dirty,
    setPreview,
    preview,
    anim,
    chooseAnimation,
    addAnimation,
    setFrameIndex,
    setPlaying,
    playing,
    active,
    frameRef,
    frameIndex,
    addFrame,
    duplicateFrame,
    moveFrame,
    removeFrame,
    newProject,
    search,
    setSearch,
    folder,
    setFolder,
    folders,
    sort,
    setSort,
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
    pyxel,
    setPyxel,
    transparent,
    setTransparent,
    bg,
    setBg,
    sheet,
    setSheet,
    cols,
    setCols,
    exportPixels,
    exportNow,
    shortcuts,
    setShortcuts,
    inputRef,
    status,
    library,
    exportDialog,
    settings,
    importFile,
  };
}
export type StudioController = ReturnType<typeof usePixelStudio>;
