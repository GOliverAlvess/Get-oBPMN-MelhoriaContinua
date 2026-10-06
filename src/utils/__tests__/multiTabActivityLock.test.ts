import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  acquireTabLock, 
  releaseTabLock 
} from '../../lib/userActivityTracker';

describe('AUD-009: Coordenação Multi-Abas e Prevenção de Duplicidade de Tempo Ativo', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Reset mock storage
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockLocalStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
      }
    });

    vi.stubGlobal('document', {
      hidden: false,
      hasFocus: () => true
    });
  });

  it('Cenário 1: Uma única aba deve adquirir liderança normalmente', () => {
    const userId = 'user-gabriel';
    const tabA = 'tab_A_111';

    const result = acquireTabLock(userId, tabA);
    expect(result).toBe(true);

    const stored = JSON.parse(mockLocalStorage[`gip_active_tab_${userId}`]);
    expect(stored.tabId).toBe(tabA);
  });

  it('Cenário 2: Duas abas abertas simultaneamente — apenas a aba líder contabiliza tempo', () => {
    const userId = 'user-gabriel';
    const tabA = 'tab_A_111';
    const tabB = 'tab_B_222';

    // Aba A adquire o lock
    const resultA = acquireTabLock(userId, tabA);
    expect(resultA).toBe(true);

    // Aba B tenta adquirir imediatamente enquanto Aba A é líder ativa (< 2.5s)
    const resultB = acquireTabLock(userId, tabB);
    expect(resultB).toBe(false);

    // Aba A renova o lock
    const renewA = acquireTabLock(userId, tabA);
    expect(renewA).toBe(true);

    // Aba B continua bloqueada de contabilizar duplicado
    const stillBlockedB = acquireTabLock(userId, tabB);
    expect(stillBlockedB).toBe(false);
  });

  it('Cenário 3: Três abas abertas simultaneamente — apenas 1 aba contabiliza (evita tempo triplicado)', () => {
    const userId = 'user-gabriel';
    const tabA = 'tab_A_111';
    const tabB = 'tab_B_222';
    const tabC = 'tab_C_333';

    // Aba A é líder
    expect(acquireTabLock(userId, tabA)).toBe(true);

    // Aba B e Aba C tentam no mesmo instante
    expect(acquireTabLock(userId, tabB)).toBe(false);
    expect(acquireTabLock(userId, tabC)).toBe(false);

    // Verificação de integridade do storage
    const stored = JSON.parse(mockLocalStorage[`gip_active_tab_${userId}`]);
    expect(stored.tabId).toBe(tabA);
  });

  it('Cenário 4: Troca de aba e liberação imediata ao fechar/minimizar a aba líder', () => {
    const userId = 'user-gabriel';
    const tabA = 'tab_A_111';
    const tabB = 'tab_B_222';

    // Aba A adquire o lock
    expect(acquireTabLock(userId, tabA)).toBe(true);
    expect(acquireTabLock(userId, tabB)).toBe(false);

    // Aba A fecha ou vai para segundo plano (chama releaseTabLock)
    releaseTabLock(userId, tabA);

    // Aba B agora consegue assumir imediatamente a liderança sem delay
    expect(acquireTabLock(userId, tabB)).toBe(true);

    // Agora Aba B é a líder confirmada
    const stored = JSON.parse(mockLocalStorage[`gip_active_tab_${userId}`]);
    expect(stored.tabId).toBe(tabB);
  });

  it('Cenário 5: Expiração segura por timeout caso a aba líder trave sem cleanup', () => {
    const userId = 'user-gabriel';
    const tabA = 'tab_A_111';
    const tabB = 'tab_B_222';

    // Aba A grava lock com timestamp antigo (3 segundos atrás)
    const oldTimestamp = Date.now() - 3000;
    mockLocalStorage[`gip_active_tab_${userId}`] = JSON.stringify({ tabId: tabA, timestamp: oldTimestamp });

    // Aba B tenta adquirir: como o lock expirou (> 2.5s), Aba B assume
    const resultB = acquireTabLock(userId, tabB);
    expect(resultB).toBe(true);

    const stored = JSON.parse(mockLocalStorage[`gip_active_tab_${userId}`]);
    expect(stored.tabId).toBe(tabB);
  });

  it('Cenário 6: Isolamento estrito por usuário (Gabriel e Matheus não competem pelo mesmo lock)', () => {
    const userGabriel = 'user_gabriel_01';
    const userMatheus = 'user_matheus_02';
    const tabGabriel = 'tab_gabriel_1';
    const tabMatheus = 'tab_matheus_1';

    // Gabriel adquire lock
    expect(acquireTabLock(userGabriel, tabGabriel)).toBe(true);

    // Matheus também adquire seu próprio lock sem conflito
    expect(acquireTabLock(userMatheus, tabMatheus)).toBe(true);

    // Ambos possuem chaves isoladas no storage
    expect(JSON.parse(mockLocalStorage[`gip_active_tab_${userGabriel}`]).tabId).toBe(tabGabriel);
    expect(JSON.parse(mockLocalStorage[`gip_active_tab_${userMatheus}`]).tabId).toBe(tabMatheus);
  });

  it('Cenário 7: Fallback seguro quando localStorage lança exceção (ex: modo anônimo restrito / quota)', () => {
    const userId = 'user-gabriel';

    // Mock localStorage lançando erro de segurança
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError: The operation is insecure.');
      },
      setItem: () => {
        throw new Error('SecurityError: The operation is insecure.');
      }
    });

    // Se document tem foco ativo e está visível, permite contagem na aba com foco
    vi.stubGlobal('document', {
      hidden: false,
      hasFocus: () => true
    });

    const focusedTab = acquireTabLock(userId, 'tab_focused');
    expect(focusedTab).toBe(true);

    // Mas uma aba em segundo plano / sem foco NÃO é autorizada
    vi.stubGlobal('document', {
      hidden: false,
      hasFocus: () => false // sem foco
    });

    const unfocusedTab = acquireTabLock(userId, 'tab_unfocused');
    expect(unfocusedTab).toBe(false);

    // Aba oculta também é rejeitada
    vi.stubGlobal('document', {
      hidden: true,
      hasFocus: () => true
    });

    const hiddenTab = acquireTabLock(userId, 'tab_hidden');
    expect(hiddenTab).toBe(false);
  });

  it('Cenário 8: Rejeita userId vazio ou inválido por segurança', () => {
    expect(acquireTabLock('', 'tab_1')).toBe(false);
  });
});
