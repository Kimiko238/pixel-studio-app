import { uid, type Project } from './model';

const DB = 'pixel-studio-private';
const PROJECTS = 'projects';
const QUEUE = 'project-sync';
type StoredProject = Project & { cloudRevision?: number };
type LegacyPending = { id: string; action: 'save' | 'delete'; baseRevision: number; at: number };
type Pending = LegacyPending & { operationId: string; cloudRevision?: number };
export type ProjectChange = Pending & { project?: Project };

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS))
        db.createObjectStore(PROJECTS, { keyPath: 'id' });
      const queue = db.createObjectStore(QUEUE, { keyPath: 'id' });
      let legacy: LegacyPending[] = [];
      try {
        const stored = JSON.parse(localStorage.getItem('pixel-studio-pending') || '[]');
        if (Array.isArray(stored)) legacy = stored;
      } catch {
        // The previous queue may be unavailable or unreadable.
      }
      for (const item of legacy) {
        if (typeof item?.id === 'string' && (item.action === 'save' || item.action === 'delete'))
          queue.put({ ...item, operationId: uid() });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });

const transaction = async <T>(
  mode: IDBTransactionMode,
  run: (projects: IDBObjectStore, queue: IDBObjectStore) => Promise<T>,
) => {
  const db = await open();
  try {
    const tx = db.transaction([PROJECTS, QUEUE], mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? Error('端末への保存が中断されました'));
    });
    const result = run(tx.objectStore(PROJECTS), tx.objectStore(QUEUE)).catch((error) => {
      if (tx.error === null) {
        try {
          tx.abort();
        } catch {
          // The browser may already have finished aborting the transaction.
        }
      }
      throw error;
    });
    const [value] = await Promise.all([result, done]);
    return value;
  } finally {
    db.close();
  }
};

const read = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const editable = ({ cloudRevision: _cloudRevision, ...project }: StoredProject): Project => project;

export const listLocal = () =>
  transaction('readonly', async (projects, queue) => {
    const [saved, waiting] = await Promise.all([
      read<StoredProject[]>(projects.getAll()),
      read(queue.count()),
    ]);
    return { saved: saved.map(editable), waiting };
  });

export const stageProject = (project: Project, baseRevision: number, action: Pending['action']) =>
  transaction('readwrite', async (projects, queue) => {
    const [existing, pending] = await Promise.all([
      read<StoredProject | undefined>(projects.get(project.id)),
      read<Pending | undefined>(queue.get(project.id)),
    ]);
    const cloudRevision = pending?.cloudRevision ?? existing?.cloudRevision;
    queue.put({
      id: project.id,
      action,
      baseRevision: pending?.baseRevision ?? baseRevision,
      cloudRevision,
      at: Date.now(),
      operationId: uid(),
    } satisfies Pending);
    if (action === 'delete') {
      projects.delete(project.id);
      return project;
    }
    const saved = {
      ...project,
      revision: Math.max(project.revision, (existing?.revision ?? -1) + 1),
    };
    projects.put({ ...saved, cloudRevision });
    return saved;
  });

export const pendingProjects = () =>
  transaction('readonly', async (projects, queue) => {
    const items = await read<Pending[]>(queue.getAll());
    return Promise.all(
      items
        .sort((a, b) => a.at - b.at)
        .map(async (item) => {
          const project = await read<StoredProject | undefined>(projects.get(item.id));
          return { ...item, project: project && editable(project) };
        }),
    );
  });

export const finishProjectSync = (
  sent: ProjectChange,
  { project, copy }: { project?: Project; copy?: Project },
) =>
  transaction('readwrite', async (projects, queue) => {
    const current = await read<Pending | undefined>(queue.get(sent.id));
    if (copy) projects.put({ ...copy, cloudRevision: copy.revision });
    if (current?.operationId === sent.operationId) {
      queue.delete(sent.id);
      if (project) projects.put({ ...project, cloudRevision: project.revision });
      else if (copy) projects.delete(sent.id);
    } else if (current && project && !copy && sent.action === 'save' && sent.project) {
      // A newer save made during upload must still be sent against this version.
      queue.put({ ...current, baseRevision: project.revision, cloudRevision: project.revision });
    }
  });

export const mergeCloudProjects = (remote: Project[]) =>
  transaction('readwrite', async (projects, queue) => {
    const [local, waiting] = await Promise.all([
      read<StoredProject[]>(projects.getAll()),
      read<IDBValidKey[]>(queue.getAllKeys()),
    ]);
    const pendingIds = new Set(waiting);
    const localById = new Map(local.map((project) => [project.id, project]));
    const remoteIds = new Set(remote.map((project) => project.id));
    for (const project of remote) {
      const existing = localById.get(project.id);
      if (pendingIds.has(project.id)) continue;
      if (
        !existing ||
        existing.cloudRevision !== undefined ||
        project.revision >= existing.revision
      )
        projects.put({ ...project, cloudRevision: project.revision });
    }
    for (const project of local) {
      if (
        project.cloudRevision !== undefined &&
        !pendingIds.has(project.id) &&
        !remoteIds.has(project.id)
      )
        projects.delete(project.id);
    }
  });
