import { db, doc, getDoc, setDoc, atomicUpdateUserActivity } from '../firebase';
import { User, UserDailyActivity } from '../types';

/**
 * Constantes de rastreamento de atividade do usuário no GIP Flow
 * Regra Oficial: Inatividade estrita após 5 MINUTOS sem interação.
 */
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade sem interação
export const HEARTBEAT_INTERVAL_MS = 30 * 1000; // Intervalo de 30s para heartbeat de presença e flush de tempo ativo
export const THROTTLE_INTERACTION_MS = 1000; // Throttle de 1s para registrar interações de mouse/teclado

// Identificador único da aba atual para coordenação multi-abas
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

interface TrackerState {
  userId: string | null;
  userName: string;
  userEmail: string;
  lastInteractionTime: number;
  isTabVisible: boolean;
  isWindowFocused: boolean;
  unpersistedSeconds: number;
  currentDateStr: string;
  intervalId: any;
  lastThrottledInteraction: number;
  lastActiveHeartbeatSent: number;
  wasPreviouslyActive: boolean;
  cleanupListeners: (() => void) | null;
}

const state: TrackerState = {
  userId: null,
  userName: '',
  userEmail: '',
  lastInteractionTime: Date.now(),
  isTabVisible: typeof document !== 'undefined' ? !document.hidden : true,
  isWindowFocused: typeof document !== 'undefined' ? document.hasFocus() : true,
  unpersistedSeconds: 0,
  currentDateStr: getTodayDateString(),
  intervalId: null,
  lastThrottledInteraction: 0,
  lastActiveHeartbeatSent: 0,
  wasPreviouslyActive: true,
  cleanupListeners: null,
};

/**
 * Retorna a data atual no formato YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Registra uma interação do usuário na interface do GIP Flow.
 * Renova a presença ativa sem necessariamente incrementar Ações Realizadas.
 */
export function recordUserInteraction() {
  const now = Date.now();
  if (now - state.lastThrottledInteraction < THROTTLE_INTERACTION_MS) {
    return;
  }
  state.lastThrottledInteraction = now;
  state.lastInteractionTime = now;
  state.isWindowFocused = true;
}

/**
 * Verifica se a aba atual tem autorização para registrar o tempo deste segundo
 * para evitar duplicação quando múltiplas abas do GIP Flow estiverem abertas simultaneamente.
 */
function acquireTabLock(userId: string): boolean {
  if (typeof localStorage === 'undefined') return true;

  try {
    const lockKey = `gip_active_tab_${userId}`;
    const rawLock = localStorage.getItem(lockKey);
    const now = Date.now();

    if (rawLock) {
      const lockData = JSON.parse(rawLock);
      // Se outra aba atualizou o lock há menos de 2.5 segundos e não é esta aba, cede a contagem
      if (lockData.tabId !== TAB_ID && now - lockData.timestamp < 2500) {
        return false;
      }
    }

    // Esta aba assume o lock de contagem ativa
    localStorage.setItem(lockKey, JSON.stringify({ tabId: TAB_ID, timestamp: now }));
    return true;
  } catch {
    return true;
  }
}

/**
 * Persiste o tempo ativo acumulado no Firestore e atualiza os contadores consolidados.
 * @param forcePresenceStatus Opcional para forçar envio de status Inativo ou Ativo
 */
export async function flushActiveTime(forcePresenceStatus?: 'Ativo' | 'Inativo'): Promise<void> {
  if (!state.userId) {
    return;
  }

  const secondsToPersist = state.unpersistedSeconds;
  state.unpersistedSeconds = 0;

  const targetDateStr = state.currentDateStr;
  const userId = state.userId;
  const userName = state.userName;
  const userEmail = state.userEmail;
  const nowIso = new Date().toISOString();

  const now = Date.now();
  const isWithin5Min = (now - state.lastInteractionTime) <= INACTIVITY_TIMEOUT_MS;
  const isCurrentlyActive = state.isTabVisible && isWithin5Min;
  const finalStatus: 'Ativo' | 'Inativo' = forcePresenceStatus || (isCurrentlyActive ? 'Ativo' : 'Inativo');

  try {
    // Atualização atômica concorrente-segura (AUD-001)
    await atomicUpdateUserActivity({
      userId,
      userName,
      userEmail,
      date: targetDateStr,
      dailyInc: secondsToPersist > 0 ? { activeSeconds: secondsToPersist } : undefined,
      dailySet: {
        lastActiveAt: nowIso,
      },
      userInc: secondsToPersist > 0 ? { totalActiveSeconds: secondsToPersist } : undefined,
      userSet: {
        lastActiveAt: nowIso,
        lastPresenceAt: nowIso,
        isOnline: finalStatus === 'Ativo',
        status: finalStatus,
      },
    });
  } catch (err) {
    console.warn('Erro ao salvar tempo ativo consolidado:', err);
    // Se falhar o envio, recupera os segundos para tentar novamente no próximo ciclo
    state.unpersistedSeconds += secondsToPersist;
  }
}

/**
 * Registra o início de uma nova sessão autenticada (se ainda não registrada nesta sessão de navegador)
 */
export async function registerUserSessionStart(user: { id: string; name: string; email?: string }): Promise<void> {
  if (!user?.id || typeof sessionStorage === 'undefined') return;

  const sessionKey = `gip_session_started_${user.id}`;
  const existingSession = sessionStorage.getItem(sessionKey);

  // Se a aba já registrou a sessão na inicialização deste navegador, não duplica no F5/refresh
  if (existingSession) {
    return;
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  sessionStorage.setItem(sessionKey, sessionId);

  const todayStr = getTodayDateString();
  const nowIso = new Date().toISOString();

  try {
    // Atualização atômica concorrente-segura (AUD-001)
    await atomicUpdateUserActivity({
      userId: user.id,
      userName: user.name,
      userEmail: user.email || '',
      date: todayStr,
      dailyInc: {
        sessionsCount: 1,
      },
      dailySet: {
        lastActiveAt: nowIso,
      },
      userInc: {
        loginCount: 1,
      },
      userSet: {
        name: user.name,
        email: user.email || '',
        lastAccess: nowIso,
        lastLoginAt: nowIso,
        lastActiveAt: nowIso,
        lastPresenceAt: nowIso,
        isOnline: true,
        status: 'Ativo',
      },
    });
  } catch (err) {
    console.warn('Erro ao registrar início de sessão:', err);
  }
}

/**
 * Inicializa o rastreador de tempo ativo do usuário atual
 */
export function initUserActivityTracker(user: { id: string; name: string; email?: string } | null): () => void {
  // Encerra qualquer instância anterior
  if (state.cleanupListeners) {
    state.cleanupListeners();
  }

  if (!user || !user.id) {
    state.userId = null;
    return () => {};
  }

  state.userId = user.id;
  state.userName = user.name || 'Usuário';
  state.userEmail = user.email || '';
  state.lastInteractionTime = Date.now();
  state.unpersistedSeconds = 0;
  state.currentDateStr = getTodayDateString();
  state.isTabVisible = typeof document !== 'undefined' ? !document.hidden : true;
  state.isWindowFocused = typeof document !== 'undefined' ? document.hasFocus() : true;
  state.wasPreviouslyActive = true;

  // Registra o início da sessão autenticada (se for primeira abertura da sessão)
  registerUserSessionStart(user);

  // Listeners de interação do usuário para manter o estado ativo
  const handleInteraction = () => {
    recordUserInteraction();
  };

  const handleVisibilityChange = () => {
    state.isTabVisible = !document.hidden;
    if (!state.isTabVisible) {
      // Quando a aba vai para segundo plano ou minimizada, faz flush imediato do que acumulou e pausa
      flushActiveTime('Inativo');
    } else {
      // Quando retorna ao primeiro plano, atualiza o timestamp de interação
      recordUserInteraction();
    }
  };

  const handleWindowFocus = () => {
    state.isTabVisible = true;
    state.isWindowFocused = true;
    recordUserInteraction();
  };

  const handleWindowBlur = () => {
    // Se a janela perde o foco (ex: usuário mudou para Excel, Teams, etc.), para imediatamente a contagem
    state.isWindowFocused = false;
    flushActiveTime();
  };

  const handleBeforeUnload = () => {
    // Flush imediato e marca como offline/inativo ao fechar
    flushActiveTime('Inativo');
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('mousedown', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('scroll', handleInteraction, { passive: true });
    window.addEventListener('mousemove', handleInteraction, { passive: true });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
  }

  let accumulatedHeartbeatMs = 0;

  // Intervalo de contagem de 1 segundo: avalia se o usuário está ativo
  state.intervalId = setInterval(() => {
    if (!state.userId) return;

    const now = Date.now();
    const timeSinceLastInteraction = now - state.lastInteractionTime;

    // Condições obrigatórias para acumular tempo ativo:
    // 1. Aba deve estar visível e não minimizada (document.visibilityState !== 'hidden')
    // 2. Última interação deve estar dentro da janela estrita de 5 minutos (INACTIVITY_TIMEOUT_MS)
    // 3. Esta aba deve deter o lock ativo (evita duplicar contagem com múltiplas abas abertas)
    const isWithinInactivityWindow = timeSinceLastInteraction <= INACTIVITY_TIMEOUT_MS;
    const isEligible = state.isTabVisible && isWithinInactivityWindow;

    // Transição de Ativo -> Inativo (ao atingir exatamente 5 minutos sem interação)
    if (!isEligible && state.wasPreviouslyActive) {
      state.wasPreviouslyActive = false;
      // Usuário ultrapassou o limite de 5 minutos: faz flush e marca Inativo imediatamente
      flushActiveTime('Inativo');
      return;
    }

    if (isEligible) {
      state.wasPreviouslyActive = true;

      if (acquireTabLock(state.userId)) {
        // Suporte à transição de meia-noite
        const todayStr = getTodayDateString();
        if (todayStr !== state.currentDateStr) {
          // Virou o dia! Faz flush do tempo do dia anterior e reseta para o novo dia
          flushActiveTime();
          state.currentDateStr = todayStr;
        }

        state.unpersistedSeconds += 1;
        accumulatedHeartbeatMs += 1000;

        // A cada HEARTBEAT_INTERVAL_MS (30s) de tempo ativo real, persiste no Firestore
        if (accumulatedHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
          accumulatedHeartbeatMs = 0;
          flushActiveTime('Ativo');
        }
      }
    }
  }, 1000);

  const cleanup = () => {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('mousemove', handleInteraction);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    }

    // Salva qualquer tempo restante pendente
    flushActiveTime('Inativo');
    state.userId = null;
  };

  state.cleanupListeners = cleanup;
  return cleanup;
}

/**
 * Limpa o rastreamento de sessão do usuário no logout
 */
export function clearUserSessionTracker(userId?: string) {
  if (typeof sessionStorage !== 'undefined' && userId) {
    sessionStorage.removeItem(`gip_session_started_${userId}`);
  }
  flushActiveTime('Inativo');
}
