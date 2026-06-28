export function ref(storage: any, path: string) {
  return { path };
}

export async function uploadBytes(ref: any, file: any) {
  // Mock upload by returning a fake result
  return { ref };
}

export async function getDownloadURL(ref: any) {
  // In a real app we would upload to a server endpoint, 
  // here we just return a fake URL or a placeholder image.
  return `https://via.placeholder.com/800x600?text=${encodeURIComponent(ref.path)}`;
}

export const db = {};
export const storage = {};

export const logout = async () => {
  try {
    const safeStorage = (await import('./safeStorage')).safeStorage;
    safeStorage.removeItem('mock_auth_username');
    safeStorage.removeItem('mock_auth_password');
    window.dispatchEvent(new Event('auth-state-change'));
  } catch (error) {
    console.error('Error signing out', error);
  }
};

export function collection(db: any, path: string, ...segments: string[]) {
  const fullPath = segments.length > 0 ? [path, ...segments].join('/') : path;
  return { path: fullPath, type: 'collection' };
}

export function doc(db: any, path?: string, ...segments: string[]) {
  if (db && typeof db === 'object' && db.type === 'collection') {
    const collPath = db.path;
    const generatedId = Math.random().toString(36).substring(2, 15);
    return { path: collPath + '/' + generatedId, id: generatedId, type: 'doc' };
  }
  
  if (!path) {
    return { path: '', id: '', type: 'doc' };
  }

  if (segments.length > 0) {
    const fullPath = [path, ...segments].join('/');
    const generatedId = segments[segments.length - 1];
    return { path: fullPath, id: generatedId, type: 'doc' };
  }
  
  const generatedId = path.split('/').pop() || '';
  return { path, id: generatedId, type: 'doc' };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return { ...collectionRef, constraints };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, dir: string = 'asc') {
  return { type: 'orderBy', field, dir };
}

export async function getDocs(query: any) {
  const res = await fetch('/api/db/getDocs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });
  const data = await res.json();
  const docs = data.map((d: any) => ({
    id: d.id,
    data: () => d.data,
    exists: () => true
  }));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: any) => docs.forEach(cb)
  };
}

export async function getDoc(docRef: any) {
  const res = await fetch('/api/db/getDoc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docRef)
  });
  if (res.status === 404) {
    return { exists: () => false };
  }
  const data = await res.json();
  return {
    id: data?.id,
    data: () => data?.data,
    exists: () => !!data
  };
}

export async function setDoc(docRef: any, data: any, options?: any) {
  await fetch('/api/db/setDoc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docRef, data, options })
  });
}

export async function addDoc(collectionRef: any, data: any) {
  const res = await fetch('/api/db/addDoc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionRef, data })
  });
  const result = await res.json();
  return { id: result.id, path: collectionRef.path + '/' + result.id };
}

export async function updateDoc(docRef: any, data: any) {
  await fetch('/api/db/updateDoc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docRef, data })
  });
}

export async function deleteDoc(docRef: any) {
  await fetch('/api/db/deleteDoc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docRef)
  });
}

export function onSnapshot(ref: any, callback: any, onError?: any) {
  let isCancelled = false;
  
  const poll = async () => {
    if (isCancelled) return;
    try {
      if (ref.type === 'doc') {
        const snap = await getDoc(ref);
        if (!isCancelled) callback(snap);
      } else {
        const snap = await getDocs(ref);
        if (!isCancelled) callback(snap);
      }
    } catch (err) {
      console.warn("Polling error:", err);
      if (onError) {
        try {
          onError(err);
        } catch (callbackErr) {
          console.error("Error in onSnapshot error handler callback:", callbackErr);
        }
      }
    }
    if (!isCancelled) {
      setTimeout(poll, 15000); // poll every 15s
    }
  };
  
  poll();
  return () => { isCancelled = true; };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function arrayUnion(...args: any[]) {
  return { __op: 'arrayUnion', args };
}

export function arrayRemove(...args: any[]) {
  return { __op: 'arrayRemove', args };
}

export function increment(num: number) {
  return { __op: 'increment', value: num };
}

export function withTimeout<T>(promise: Promise<T>, ms: number = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

export function handleFirestoreError(err: any, type: any, path: any) {
  console.warn("DB Error", type, path, err);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
