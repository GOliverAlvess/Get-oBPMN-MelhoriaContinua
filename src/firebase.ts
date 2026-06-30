// NoSQL & Local Auth Compatibility Layer (Replaces Firebase)
import { cn } from './lib/utils';

// Check if this window was opened as a Google OAuth callback popup
if (typeof window !== 'undefined' && window.location.hash && window.opener) {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get('access_token');
  if (accessToken) {
    try {
      window.opener.postMessage({ type: 'GOOGLE_OAUTH_TOKEN', token: accessToken }, window.location.origin);
      window.close();
    } catch (e) {
      console.error('Error sending OAuth token message:', e);
    }
  }
}

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
  profile?: string;
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
    // Check if real Google Client ID is configured
    const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    
    if (googleClientId) {
      // 1. Real Google Sign-In Flow
      const redirectUri = window.location.origin;
      const scope = 'profile email openid';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
      
      const authWindow = window.open(authUrl, 'google_oauth_popup', 'width=500,height=600');
      if (!authWindow) {
        alert('Por favor, permita pop-ups para fazer login com o Google.');
        reject(new Error('Popup blocked'));
        return;
      }
      
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'GOOGLE_OAUTH_TOKEN') {
          const token = event.data.token;
          window.removeEventListener('message', messageHandler);
          
          try {
            // Fetch profile info from Google
            const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
            if (!userInfoRes.ok) throw new Error("Falha ao obter perfil do Google");
            const googleUser = await userInfoRes.json();
            const email = googleUser.email?.toLowerCase();
            
            // Validate email against database
            const usersRes = await fetch(`${API_BASE}/users`);
            if (!usersRes.ok) throw new Error("Falha ao consultar banco de dados de usuários");
            const dbUsers = await usersRes.json();
            
            let matchedUser = dbUsers.find((u: any) => u.email?.toLowerCase() === email);
            
            // Local seed fallback as double guarantee for master admin
            if (!matchedUser) {
              const seeds = [
                { id: "ga_oliveira_master", name: "Gabriel Oliveira", email: "ga.oliveira@ativalog.com.br", profile: "Usuário Master", sector: "Diretoria" },
                { id: "biel_alves_master", name: "Gabriel Alves", email: "bielalves201@gmail.com", profile: "Usuário Master", sector: "Administração" }
              ];
              const matchedSeed = seeds.find(s => s.email.toLowerCase() === email);
              if (matchedSeed) {
                // Save seed user to database
                await fetch(`${API_BASE}/users/${matchedSeed.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ data: matchedSeed, merge: true })
                });
                matchedUser = matchedSeed;
              }
            }
            
            if (!matchedUser) {
              alert("Usuário não autorizado. Entre em contato com o administrador.");
              reject(new Error("Usuário não autorizado"));
              return;
            }
            
            const mockUser: FirebaseUser = {
              uid: matchedUser.id,
              email: matchedUser.email,
              displayName: matchedUser.name,
              photoURL: googleUser.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(matchedUser.name)}`,
              emailVerified: true,
              isAnonymous: false,
              tenantId: null,
              providerData: [],
              profile: matchedUser.profile || 'Usuário Analista'
            };
            
            authInstance.currentUser = mockUser;
            localStorage.setItem('pdca_auth_user', JSON.stringify(mockUser));
            authInstance.emitChange();
            resolve({ user: mockUser });
          } catch (err: any) {
            alert(`Erro na autenticação: ${err.message}`);
            reject(err);
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      return;
    }

    // 2. Simulated Google Account Selector Flow (Fallback when Google Client ID is not configured)
    if (document.getElementById('custom-auth-modal')) return;

    const modalContainer = document.createElement('div');
    modalContainer.id = 'custom-auth-modal';
    modalContainer.className = 'fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in';

    document.body.appendChild(modalContainer);

    let currentStep: 'email' | 'password' | 'first_access' = 'email';
    let emailVal = '';
    let userIdVal = '';

    const cleanup = () => {
      if (document.body.contains(modalContainer)) {
        document.body.removeChild(modalContainer);
      }
    };

    const render = () => {
      let contentHtml = '';

      if (currentStep === 'email') {
        contentHtml = `
          <div class="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl max-w-sm w-full p-8 md:p-10 space-y-8 transform scale-95 transition-all duration-200">
            <!-- App Icon -->
            <div class="flex justify-center">
              <svg class="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.99 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.9 3.03C6.35 7.55 8.95 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.44-1.1 2.66-2.33 3.48l3.63 2.81c2.13-1.96 3.76-4.85 3.76-8.44z"/>
                <path fill="#FBBC05" d="M5.4 10.53a7.19 7.19 0 010 2.94l-3.9 3.03A11.964 11.964 0 011 12c0-1.63.32-3.18.9-4.61l3.5 3.14z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.81c-1.1.74-2.51 1.18-4.33 1.18-3.05 0-5.65-2.51-6.57-5.49l-3.9 3.03C3.4 20.35 7.35 23 12 23z"/>
              </svg>
            </div>
            
            <div class="text-center space-y-2">
              <h2 class="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Fazer login</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400 font-medium">Insira seu e-mail cadastrado</p>
            </div>

            <form id="auth-form" class="space-y-6">
              <div id="auth-error-container" class="hidden text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3.5 rounded-xl font-bold leading-relaxed"></div>
              
              <div class="space-y-1">
                <div class="relative">
                  <input type="email" id="auth-email" required placeholder="E-mail" value="${emailVal || 'ga.oliveira@ativalog.com.br'}"
                    class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium placeholder:text-slate-400" />
                </div>
              </div>

              <div class="flex justify-between items-center pt-4">
                <button id="auth-cancel" type="button" class="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors">
                  Cancelar
                </button>
                <button type="submit" id="auth-submit-btn"
                  class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white rounded-xl font-bold text-sm shadow-md shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2">
                  Próxima
                </button>
              </div>
            </form>
          </div>
        `;
      } else if (currentStep === 'password') {
        contentHtml = `
          <div class="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl max-w-sm w-full p-8 md:p-10 space-y-8 transform scale-95 transition-all duration-200">
            <!-- App Icon -->
            <div class="flex justify-center">
              <svg class="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.99 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.9 3.03C6.35 7.55 8.95 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.44-1.1 2.66-2.33 3.48l3.63 2.81c2.13-1.96 3.76-4.85 3.76-8.44z"/>
                <path fill="#FBBC05" d="M5.4 10.53a7.19 7.19 0 010 2.94l-3.9 3.03A11.964 11.964 0 011 12c0-1.63.32-3.18.9-4.61l3.5 3.14z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.81c-1.1.74-2.51 1.18-4.33 1.18-3.05 0-5.65-2.51-6.57-5.49l-3.9 3.03C3.4 20.35 7.35 23 12 23z"/>
              </svg>
            </div>
            
            <div class="text-center space-y-2">
              <h2 class="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Insira sua senha</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400 font-medium truncate">${emailVal}</p>
            </div>

            <form id="auth-form" class="space-y-6">
              <div id="auth-error-container" class="hidden text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3.5 rounded-xl font-bold leading-relaxed"></div>
              
              <div class="space-y-1">
                <div class="relative">
                  <input type="password" id="auth-password" required placeholder="Senha" autofocus
                    class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium placeholder:text-slate-400" />
                </div>
              </div>

              <div class="flex justify-between items-center pt-4">
                <button id="auth-back" type="button" class="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors">
                  Voltar
                </button>
                <button type="submit" id="auth-submit-btn"
                  class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white rounded-xl font-bold text-sm shadow-md shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2">
                  Entrar
                </button>
              </div>
            </form>
          </div>
        `;
      } else if (currentStep === 'first_access') {
        contentHtml = `
          <div class="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl max-w-sm w-full p-8 md:p-10 space-y-8 transform scale-95 transition-all duration-200">
            <!-- App Icon -->
            <div class="flex justify-center">
              <svg class="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <div class="text-center space-y-2">
              <h2 class="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Primeiro Acesso</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">Crie uma senha de acesso seguro para sua conta corporativa.</p>
              <p class="text-xs text-indigo-600 dark:text-indigo-400 font-bold truncate">${emailVal}</p>
            </div>

            <form id="auth-form" class="space-y-4">
              <div id="auth-error-container" class="hidden text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3.5 rounded-xl font-bold leading-relaxed"></div>
              
              <div class="space-y-3">
                <div class="space-y-1">
                  <label class="text-xs font-semibold text-slate-500 dark:text-slate-400">Nova Senha (mín. 6 caracteres)</label>
                  <input type="password" id="auth-new-password" required placeholder="Nova Senha" minlength="6" autofocus
                    class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium placeholder:text-slate-400" />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-semibold text-slate-500 dark:text-slate-400">Confirmar Nova Senha</label>
                  <input type="password" id="auth-confirm-password" required placeholder="Confirmar Nova Senha" minlength="6"
                    class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium placeholder:text-slate-400" />
                </div>
              </div>

              <div class="flex justify-between items-center pt-4">
                <button id="auth-back" type="button" class="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors">
                  Voltar
                </button>
                <button type="submit" id="auth-submit-btn"
                  class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white rounded-xl font-bold text-sm shadow-md shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2">
                  Confirmar e Entrar
                </button>
              </div>
            </form>
          </div>
        `;
      }

      modalContainer.innerHTML = contentHtml;

      // Attach event listeners based on the current step
      const form = modalContainer.querySelector('#auth-form') as HTMLFormElement;
      const cancelBtn = modalContainer.querySelector('#auth-cancel') as HTMLButtonElement | null;
      const backBtn = modalContainer.querySelector('#auth-back') as HTMLButtonElement | null;

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          cleanup();
          reject(new Error('Login cancelado pelo usuário'));
        });
      }

      if (backBtn) {
        backBtn.addEventListener('click', () => {
          currentStep = 'email';
          render();
        });
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorContainer = modalContainer.querySelector('#auth-error-container') as HTMLDivElement;
        const submitBtn = modalContainer.querySelector('#auth-submit-btn') as HTMLButtonElement;

        errorContainer.classList.add('hidden');
        errorContainer.textContent = '';
        submitBtn.disabled = true;

        if (currentStep === 'email') {
          const emailInput = modalContainer.querySelector('#auth-email') as HTMLInputElement;
          emailVal = emailInput.value.trim().toLowerCase();
          submitBtn.textContent = 'Verificando...';

          try {
            const res = await fetch('/api/auth/check-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailVal })
            });

            if (!res.ok) {
              const errBody = await res.json();
              throw new Error(errBody.error || 'Erro ao conectar com o servidor.');
            }

            const data = await res.json();
            if (!data.exists) {
              throw new Error('Usuário não autorizado. Entre em contato com o administrador.');
            }

            userIdVal = data.userId;
            if (data.hasPassword) {
              currentStep = 'password';
            } else {
              currentStep = 'first_access';
            }
            render();
          } catch (err: any) {
            errorContainer.textContent = err.message || 'Erro inesperado.';
            errorContainer.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Próxima';
          }

        } else if (currentStep === 'password') {
          const passwordInput = modalContainer.querySelector('#auth-password') as HTMLInputElement;
          const passwordVal = passwordInput.value;
          submitBtn.textContent = 'Autenticando...';

          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailVal, password: passwordVal })
            });

            if (!res.ok) {
              const errBody = await res.json();
              throw new Error(errBody.error || 'Senha incorreta ou erro no login.');
            }

            const data = await res.json();
            const loggedInUser = data.user;

            const mockUser: FirebaseUser = {
              uid: loggedInUser.id,
              email: loggedInUser.email,
              displayName: loggedInUser.name,
              photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(loggedInUser.name)}`,
              emailVerified: true,
              isAnonymous: false,
              tenantId: null,
              providerData: [],
              profile: loggedInUser.profile || 'Usuário Analista'
            };

            authInstance.currentUser = mockUser;
            localStorage.setItem('pdca_auth_user', JSON.stringify(mockUser));
            authInstance.emitChange();
            cleanup();
            resolve({ user: mockUser });
          } catch (err: any) {
            errorContainer.textContent = err.message || 'Erro de autenticação.';
            errorContainer.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar';
          }

        } else if (currentStep === 'first_access') {
          const newPasswordInput = modalContainer.querySelector('#auth-new-password') as HTMLInputElement;
          const confirmPasswordInput = modalContainer.querySelector('#auth-confirm-password') as HTMLInputElement;
          const newPassword = newPasswordInput.value;
          const confirmPassword = confirmPasswordInput.value;

          if (newPassword !== confirmPassword) {
            errorContainer.textContent = 'As senhas não coincidem.';
            errorContainer.classList.remove('hidden');
            submitBtn.disabled = false;
            return;
          }

          if (newPassword.length < 6) {
            errorContainer.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            errorContainer.classList.remove('hidden');
            submitBtn.disabled = false;
            return;
          }

          submitBtn.textContent = 'Registrando senha...';

          try {
            const res = await fetch('/api/auth/register-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: userIdVal, password: newPassword })
            });

            if (!res.ok) {
              const errBody = await res.json();
              throw new Error(errBody.error || 'Erro ao registrar senha.');
            }

            const data = await res.json();
            const loggedInUser = data.user;

            const mockUser: FirebaseUser = {
              uid: loggedInUser.id,
              email: loggedInUser.email,
              displayName: loggedInUser.name,
              photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(loggedInUser.name)}`,
              emailVerified: true,
              isAnonymous: false,
              tenantId: null,
              providerData: [],
              profile: loggedInUser.profile || 'Usuário Analista'
            };

            authInstance.currentUser = mockUser;
            localStorage.setItem('pdca_auth_user', JSON.stringify(mockUser));
            authInstance.emitChange();
            cleanup();
            resolve({ user: mockUser });
          } catch (err: any) {
            errorContainer.textContent = err.message || 'Erro ao definir senha.';
            errorContainer.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar e Entrar';
          }
        }
      });
    };

    render();
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

function getAuthHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (auth.currentUser?.email) {
    headers['x-user-email'] = auth.currentUser.email;
  }
  if (auth.currentUser?.uid) {
    headers['x-user-uid'] = auth.currentUser.uid;
  }
  return headers;
}

async function handleResponse(response: Response, defaultMessage: string) {
  if (!response.ok) {
    try {
      const errBody = await response.json();
      if (errBody?.error) {
        throw new Error(errBody.error);
      }
    } catch (e: any) {
      if (e.message && e.message !== 'Unexpected token < in JSON at position 0') {
        throw e;
      }
    }
    throw new Error(defaultMessage);
  }
}

export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }) {
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data, merge: options?.merge !== false }),
  });
  await handleResponse(response, `Failed to set document: ${response.statusText}`);
  return Promise.resolve();
}

export async function updateDoc(docRef: DocumentReference, data: any) {
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data }),
  });
  await handleResponse(response, `Failed to update document: ${response.statusText}`);
  return Promise.resolve();
}

export async function deleteDoc(docRef: DocumentReference) {
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  await handleResponse(response, `Failed to delete document: ${response.statusText}`);
  return Promise.resolve();
}

export async function addDoc(colRef: CollectionReference, data: any) {
  const url = `${API_BASE}/${colRef.name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data }),
  });
  await handleResponse(response, `Failed to add document: ${response.statusText}`);
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
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (response.status === 404) {
    return new MockDocumentSnapshot(docRef.id, null);
  }
  await handleResponse(response, `Failed to fetch document: ${response.statusText}`);
  const data = await response.json();
  return new MockDocumentSnapshot(docRef.id, data);
}

export async function getDocs(queryRef: CollectionReference | QueryReference) {
  const collectionName = queryRef.type === 'query' ? queryRef.collection : queryRef.name;
  const url = `${API_BASE}/${collectionName}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  await handleResponse(response, `Failed to fetch collection docs: ${response.statusText}`);
  const data = await response.json();
  return new MockQuerySnapshot(data);
}

// --- REAL-TIME SYNC VIA SERVER-SENT EVENTS (SSE) ---

interface ActiveListener {
  id: string;
  target: DocumentReference | CollectionReference | QueryReference;
  callback: (snapshot: any) => void;
  onError?: (error: any) => void;
  currentDocs: any[];
  currentDoc: any | null;
  resync: () => Promise<void>;
}

const activeListeners = new Set<ActiveListener>();
let eventSource: EventSource | null = null;
let reconnectTimeout: any = null;

function handleIncomingMutation(payload: { collection: string; id: string; type: "set" | "update" | "delete"; data: any }) {
  const { collection, id, type, data } = payload;

  for (const listener of activeListeners) {
    const target = listener.target;
    const isCollection = target.type === 'collection' || target.type === 'query';
    const listenerColName = isCollection 
      ? (target.type === 'query' ? (target as QueryReference).collection : (target as CollectionReference).name)
      : (target as DocumentReference).collection;

    if (listenerColName !== collection) continue;

    if (isCollection) {
      const updatedDocs = [...listener.currentDocs];
      const index = updatedDocs.findIndex(d => d.id === id);

      if (type === 'delete') {
        if (index !== -1) {
          updatedDocs.splice(index, 1);
        } else {
          continue;
        }
      } else {
        if (index !== -1) {
          updatedDocs[index] = { ...updatedDocs[index], ...data };
        } else {
          updatedDocs.push(data);
        }
      }

      listener.currentDocs = updatedDocs;
      listener.callback(new MockQuerySnapshot(updatedDocs));
    } else {
      if ((target as DocumentReference).id !== id) continue;

      if (type === 'delete') {
        listener.currentDoc = null;
        listener.callback(new MockDocumentSnapshot(id, null));
      } else {
        listener.currentDoc = { ...listener.currentDoc, ...data };
        listener.callback(new MockDocumentSnapshot(id, listener.currentDoc));
      }
    }
  }
}

function connectSync() {
  if (eventSource) {
    eventSource.close();
  }

  const es = new EventSource('/api/db-sync');
  eventSource = es;

  es.onopen = () => {
    console.log('📡 Real-time sync connected successfully.');
    for (const listener of activeListeners) {
      listener.resync();
    }
  };

  es.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (!payload || !payload.collection) return;
      handleIncomingMutation(payload);
    } catch (e) {
      console.error('Error handling sync message:', e);
    }
  };

  es.onerror = () => {
    console.warn('⚠️ Real-time sync connection lost. Reconnecting...');
    es.close();
    eventSource = null;
    
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connectSync, 3000);
  };
}

export function onSnapshot(
  target: DocumentReference | CollectionReference | QueryReference,
  callback: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  if (!eventSource && typeof window !== 'undefined') {
    connectSync();
  }

  const listenerId = Math.random().toString(36).substring(2, 11);

  const listener: ActiveListener = {
    id: listenerId,
    target,
    callback,
    onError,
    currentDocs: [],
    currentDoc: null,
    resync: async function() {
      try {
        if (target.type === 'doc') {
          const snapshot = await getDoc(target);
          this.currentDoc = snapshot.data();
          this.callback(snapshot);
        } else {
          const snapshot = await getDocs(target as any);
          this.currentDocs = snapshot.docs.map(d => d.data());
          this.callback(snapshot);
        }
      } catch (e) {
        if (this.onError) this.onError(e);
      }
    }
  };

  listener.resync();
  activeListeners.add(listener);

  return () => {
    activeListeners.delete(listener);
  };
}
