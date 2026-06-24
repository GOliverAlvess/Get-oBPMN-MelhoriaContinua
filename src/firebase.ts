// NoSQL & Local Auth Compatibility Layer (Replaces Firebase)
import { cn } from './lib/utils';

export const dbId = 'local-nosql-db';
export const db = { name: 'local-nosql' };

// --- LOCAL AUTHENTICATION MOCK & PERSISTENCE ---

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: any[];
}

class MockAuth {
  private listeners: ((user: FirebaseUser | null) => void)[] = [];
  public currentUser: FirebaseUser | null = null;

  constructor() {
    // Restore session from localStorage if available
    const saved = localStorage.getItem('pdca_auth_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  public onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    this.listeners.push(callback);
    // Call immediately with current state
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public emitChange() {
    this.listeners.forEach(callback => callback(this.currentUser));
  }

  public signOut() {
    this.currentUser = null;
    localStorage.removeItem('pdca_auth_user');
    this.emitChange();
    return Promise.resolve();
  }
}

export const auth = new MockAuth();
export const googleProvider = { providerId: 'google.com' };

export function onAuthStateChanged(authInstance: MockAuth, callback: (user: FirebaseUser | null) => void) {
  return authInstance.onAuthStateChanged(callback);
}

// Sleek, beautiful modern modal for custom login without Google/Firebase OAuth setup
export function signInWithPopup(authInstance: MockAuth, provider: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check if modal already exists
    if (document.getElementById('custom-auth-modal')) return;

    const modalContainer = document.createElement('div');
    modalContainer.id = 'custom-auth-modal';
    modalContainer.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in';

    modalContainer.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6 transform scale-95 transition-transform duration-200">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none">
            <span class="text-xl font-black">P</span>
          </div>
          <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Entrar no Sistema</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Insira suas credenciais para acessar os planos de ação</p>
        </div>

        <form id="auth-form" class="space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Nome Completo</label>
            <input type="text" id="auth-name" required value="Gabriel Alves"
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Endereço de E-mail</label>
            <input type="email" id="auth-email" required value="bielalves201@gmail.com"
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
          </div>

          <button type="submit"
            class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2">
            Confirmar Login
          </button>
        </form>

        <div class="text-center">
          <button id="auth-cancel" type="button" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalContainer);

    const form = modalContainer.querySelector('#auth-form') as HTMLFormElement;
    const cancelBtn = modalContainer.querySelector('#auth-cancel') as HTMLButtonElement;

    const cleanup = () => {
      if (document.body.contains(modalContainer)) {
        document.body.removeChild(modalContainer);
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = modalContainer.querySelector('#auth-name') as HTMLInputElement;
      const emailInput = modalContainer.querySelector('#auth-email') as HTMLInputElement;

      const mockUser: FirebaseUser = {
        uid: 'user_' + Math.random().toString(36).substring(2, 9),
        email: emailInput.value.trim(),
        displayName: nameInput.value.trim(),
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameInput.value)}`,
        emailVerified: true,
        isAnonymous: false,
        tenantId: null,
        providerData: []
      };

      authInstance.currentUser = mockUser;
      localStorage.setItem('pdca_auth_user', JSON.stringify(mockUser));
      authInstance.emitChange();
      cleanup();
      resolve({ user: mockUser });
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      reject(new Error('Login cancelado pelo usuário'));
    });
  });
}

// --- FIRESTORE COMPATIBILITY TYPES ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Database Error: ', error, operationType, path);
  throw error;
}

// Query structure mocks
export interface CollectionReference {
  type: 'collection';
  name: string;
}

export interface DocumentReference {
  type: 'doc';
  collection: string;
  id: string;
  path: string;
}

export interface QueryReference {
  type: 'query';
  collection: string;
  constraints: any[];
}

export function collection(dbInstance: any, name: string): CollectionReference {
  return { type: 'collection', name };
}

export function doc(parent: any, ...paths: string[]): DocumentReference {
  if (parent.type === 'collection') {
    return {
      type: 'doc',
      collection: parent.name,
      id: paths[0],
      path: `${parent.name}/${paths[0]}`
    };
  }
  // If parent is db
  return {
    type: 'doc',
    collection: paths[0],
    id: paths[1],
    path: `${paths[0]}/${paths[1]}`
  };
}

export function query(colRef: CollectionReference, ...constraints: any[]): QueryReference {
  return { type: 'query', collection: colRef.name, constraints };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

// --- API FETCH & OPERATIONS ---

const API_BASE = '/api/db';

export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }) {
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, merge: options?.merge !== false }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set document: ${response.statusText}`);
  }
  return Promise.resolve();
}

export async function updateDoc(docRef: DocumentReference, data: any) {
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update document: ${response.statusText}`);
  }
  return Promise.resolve();
}

export async function deleteDoc(docRef: DocumentReference) {
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const response = await fetch(url, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
  return Promise.resolve();
}

export async function addDoc(colRef: CollectionReference, data: any) {
  const url = `${API_BASE}/${colRef.name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add document: ${response.statusText}`);
  }
  const result = await response.json();
  return { id: result.id };
}

// Document Snapshots helpers
class MockDocumentSnapshot {
  constructor(public id: string, private _data: any) {}
  exists() {
    return !!this._data;
  }
  data() {
    return this._data;
  }
}

class MockQuerySnapshot {
  public docs: MockDocumentSnapshot[] = [];
  constructor(documents: { id: string; [key: string]: any }[]) {
    this.docs = documents.map(doc => new MockDocumentSnapshot(doc.id, doc));
  }
  forEach(callback: (doc: MockDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export async function getDoc(docRef: DocumentReference) {
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const response = await fetch(url);
  if (response.status === 404) {
    return new MockDocumentSnapshot(docRef.id, null);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }
  const data = await response.json();
  return new MockDocumentSnapshot(docRef.id, data);
}

export async function getDocs(queryRef: CollectionReference | QueryReference) {
  const collectionName = queryRef.type === 'query' ? queryRef.collection : queryRef.name;
  const url = `${API_BASE}/${collectionName}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch collection docs: ${response.statusText}`);
  }
  const data = await response.json();
  return new MockQuerySnapshot(data);
}

// --- REAL-TIME SYNC VIA SMART POLLING ---

export function onSnapshot(
  target: DocumentReference | CollectionReference | QueryReference,
  callback: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  let active = true;
  let lastHash = '';

  const check = async () => {
    if (!active) return;
    try {
      let snapshot: any;
      if (target.type === 'doc') {
        snapshot = await getDoc(target);
      } else {
        snapshot = await getDocs(target as any);
      }

      // Compute a hash of the snapshot's data
      const currentData = target.type === 'doc' ? snapshot.data() : snapshot.docs.map((d: any) => d.data());
      const currentHash = JSON.stringify(currentData);

      if (currentHash !== lastHash) {
        lastHash = currentHash;
        callback(snapshot);
      }
    } catch (e) {
      if (onError) onError(e);
      else console.error('onSnapshot polling error:', e);
    }
  };

  // Run immediate first check
  check();

  // Poll every 2.5 seconds
  const interval = setInterval(check, 2500);

  return () => {
    active = false;
    clearInterval(interval);
  };
}
