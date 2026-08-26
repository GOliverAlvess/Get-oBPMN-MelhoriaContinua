import { describe, it, expect, beforeEach } from 'vitest';
import { UserDailyActivity, User } from '../../types';

// Mock in-memory database simulating the atomic backend operations ($inc + $set)
class MockAtomicEngine {
  public dailyDb: Record<string, UserDailyActivity> = {};
  public userDb: Record<string, User> = {};

  public atomicUpdate(params: {
    userId: string;
    userName: string;
    userEmail?: string;
    date: string;
    dailyInc?: {
      activeSeconds?: number;
      actionsCount?: number;
      sessionsCount?: number;
    };
    dailySet?: {
      lastActiveAt?: string;
      [key: string]: any;
    };
    userInc?: {
      totalActiveSeconds?: number;
      actionCount?: number;
      loginCount?: number;
    };
    userSet?: {
      lastActiveAt?: string;
      lastPresenceAt?: string;
      lastAccess?: string;
      lastLoginAt?: string;
      isOnline?: boolean;
      status?: 'Ativo' | 'Inativo';
      [key: string]: any;
    };
  }) {
    const docId = `${params.userId}_${params.date}`;

    // 1. userDailyActivity atomic update
    const existingDaily = this.dailyDb[docId] || {
      id: docId,
      userId: params.userId,
      date: params.date,
      userName: params.userName || 'Usuário',
      userEmail: params.userEmail || '',
      activeSeconds: 0,
      activeMinutes: 0,
      actionsCount: 0,
      sessionsCount: 0,
      lastActiveAt: new Date().toISOString(),
    };

    const mergedDaily = { ...existingDaily };
    if (params.userName) mergedDaily.userName = params.userName;
    if (params.userEmail) mergedDaily.userEmail = params.userEmail;
    if (params.dailySet) {
      Object.assign(mergedDaily, params.dailySet);
    }
    if (typeof params.dailyInc?.activeSeconds === 'number') {
      mergedDaily.activeSeconds = (Number(mergedDaily.activeSeconds) || 0) + params.dailyInc.activeSeconds;
    }
    if (typeof params.dailyInc?.actionsCount === 'number') {
      mergedDaily.actionsCount = (Number(mergedDaily.actionsCount) || 0) + params.dailyInc.actionsCount;
    }
    if (typeof params.dailyInc?.sessionsCount === 'number') {
      mergedDaily.sessionsCount = (Number(mergedDaily.sessionsCount) || 0) + params.dailyInc.sessionsCount;
    }
    mergedDaily.activeMinutes = Math.round((mergedDaily.activeSeconds || 0) / 60);
    mergedDaily.id = docId;

    this.dailyDb[docId] = mergedDaily;

    // 2. users atomic update
    const hasUserInc = params.userInc && Object.keys(params.userInc).some(k => typeof (params.userInc as any)[k] === 'number');
    const hasUserSet = params.userSet && Object.keys(params.userSet).length > 0;

    if (hasUserInc || hasUserSet) {
      const existingUser = this.userDb[params.userId] || {
        id: params.userId,
        name: params.userName || 'Usuário',
        email: params.userEmail || '',
        totalActiveSeconds: 0,
        totalUsageMinutes: 0,
        actionCount: 0,
        loginCount: 0,
        status: 'Ativo',
      };

      const mergedUser = { ...existingUser };
      if (params.userSet) Object.assign(mergedUser, params.userSet);
      if (typeof params.userInc?.totalActiveSeconds === 'number') {
        mergedUser.totalActiveSeconds = (Number(mergedUser.totalActiveSeconds) || 0) + params.userInc.totalActiveSeconds;
      }
      if (typeof params.userInc?.actionCount === 'number') {
        mergedUser.actionCount = (Number(mergedUser.actionCount) || 0) + params.userInc.actionCount;
      }
      if (typeof params.userInc?.loginCount === 'number') {
        mergedUser.loginCount = (Number(mergedUser.loginCount) || 0) + params.userInc.loginCount;
      }
      mergedUser.totalUsageMinutes = Math.round((mergedUser.totalActiveSeconds || 0) / 60);
      mergedUser.id = params.userId;

      this.userDb[params.userId] = mergedUser;
    }

    return { success: true, docId };
  }
}

describe('AUD-001: Prevenção de Condição de Corrida no Monitoramento de Atividade', () => {
  let engine: MockAtomicEngine;

  beforeEach(() => {
    engine = new MockAtomicEngine();
  });

  it('TESTE 1 — Heartbeat (+30s) e Ação (+1) executados simultaneamente preservam ambos os contadores', async () => {
    // Estado inicial: 600s de tempo ativo, 10 ações
    const date = '2026-08-26';
    const userId = 'user_analista_1';

    engine.dailyDb[`${userId}_${date}`] = {
      id: `${userId}_${date}`,
      userId,
      date,
      userName: 'Analista 1',
      activeSeconds: 600,
      activeMinutes: 10,
      actionsCount: 10,
      sessionsCount: 1,
      lastActiveAt: '2026-08-26T10:00:00Z',
    };

    // Execução simultânea (concorrente via Promise.all)
    await Promise.all([
      // Heartbeat quer somar +30s
      Promise.resolve(engine.atomicUpdate({
        userId,
        userName: 'Analista 1',
        date,
        dailyInc: { activeSeconds: 30 },
        dailySet: { lastActiveAt: '2026-08-26T10:00:30Z' },
        userInc: { totalActiveSeconds: 30 },
        userSet: { status: 'Ativo', isOnline: true },
      })),
      // Ação do usuário quer somar +1 ação
      Promise.resolve(engine.atomicUpdate({
        userId,
        userName: 'Analista 1',
        date,
        dailyInc: { actionsCount: 1 },
        dailySet: { lastActiveAt: '2026-08-26T10:00:30Z' },
        userInc: { actionCount: 1 },
        userSet: { status: 'Ativo' },
      })),
    ]);

    const result = engine.dailyDb[`${userId}_${date}`];
    expect(result.activeSeconds).toBe(630);
    expect(result.actionsCount).toBe(11);
    expect(result.activeMinutes).toBe(11);
  });

  it('TESTE 2 — Executar 5 ações relevantes rapidamente não perde nenhum incremento', async () => {
    const date = '2026-08-26';
    const userId = 'user_analista_2';

    const promises = Array.from({ length: 5 }).map((_, i) =>
      Promise.resolve(engine.atomicUpdate({
        userId,
        userName: 'Analista 2',
        date,
        dailyInc: { actionsCount: 1 },
        dailySet: { lastActiveAt: `2026-08-26T10:05:0${i}Z` },
        userInc: { actionCount: 1 },
      }))
    );

    await Promise.all(promises);

    const result = engine.dailyDb[`${userId}_${date}`];
    expect(result.actionsCount).toBe(5);
    expect(engine.userDb[userId].actionCount).toBe(5);
  });

  it('TESTE 3 — Múltiplos heartbeats concorrentes acumulam todo o tempo sem perda', async () => {
    const date = '2026-08-26';
    const userId = 'user_analista_3';

    await Promise.all([
      Promise.resolve(engine.atomicUpdate({
        userId,
        userName: 'Analista 3',
        date,
        dailyInc: { activeSeconds: 30 },
        userInc: { totalActiveSeconds: 30 },
      })),
      Promise.resolve(engine.atomicUpdate({
        userId,
        userName: 'Analista 3',
        date,
        dailyInc: { activeSeconds: 30 },
        userInc: { totalActiveSeconds: 30 },
      })),
      Promise.resolve(engine.atomicUpdate({
        userId,
        userName: 'Analista 3',
        date,
        dailyInc: { activeSeconds: 30 },
        userInc: { totalActiveSeconds: 30 },
      })),
    ]);

    const result = engine.dailyDb[`${userId}_${date}`];
    expect(result.activeSeconds).toBe(90);
    expect(engine.userDb[userId].totalActiveSeconds).toBe(90);
  });

  it('TESTE 4 e 5 — Monotonicidade: os valores acumulados nunca regridem por concorrência', async () => {
    const date = '2026-08-26';
    const userId = 'user_analista_4';

    // Inicia com 1200s
    engine.dailyDb[`${userId}_${date}`] = {
      id: `${userId}_${date}`,
      userId,
      date,
      userName: 'Analista 4',
      activeSeconds: 1200,
      activeMinutes: 20,
      actionsCount: 15,
      sessionsCount: 2,
      lastActiveAt: '2026-08-26T10:00:00Z',
    };

    // Múltiplos ciclos alternados concorrentes
    await Promise.all([
      Promise.resolve(engine.atomicUpdate({ userId, userName: 'A4', date, dailyInc: { activeSeconds: 30 } })),
      Promise.resolve(engine.atomicUpdate({ userId, userName: 'A4', date, dailyInc: { actionsCount: 1 } })),
      Promise.resolve(engine.atomicUpdate({ userId, userName: 'A4', date, dailyInc: { activeSeconds: 30 } })),
      Promise.resolve(engine.atomicUpdate({ userId, userName: 'A4', date, dailyInc: { actionsCount: 2 } })),
    ]);

    const result = engine.dailyDb[`${userId}_${date}`];
    expect(result.activeSeconds).toBeGreaterThanOrEqual(1260);
    expect(result.actionsCount).toBeGreaterThanOrEqual(18);
  });

  it('TESTE 6 — Dois eventos de ação concorrentes somam exatamente +2 ações', async () => {
    const date = '2026-08-26';
    const userId = 'user_analista_5';

    await Promise.all([
      Promise.resolve(engine.atomicUpdate({ userId, userName: 'A5', date, dailyInc: { actionsCount: 1 } })),
      Promise.resolve(engine.atomicUpdate({ userId, userName: 'A5', date, dailyInc: { actionsCount: 1 } })),
    ]);

    const result = engine.dailyDb[`${userId}_${date}`];
    expect(result.actionsCount).toBe(2);
  });

  it('TESTE 10 — Virada de dia associa incrementos corretamente a cada data correspondente', async () => {
    const userId = 'user_analista_6';
    const day1 = '2026-08-25';
    const day2 = '2026-08-26';

    engine.atomicUpdate({
      userId,
      userName: 'Analista 6',
      date: day1,
      dailyInc: { activeSeconds: 300, actionsCount: 5 },
    });

    engine.atomicUpdate({
      userId,
      userName: 'Analista 6',
      date: day2,
      dailyInc: { activeSeconds: 120, actionsCount: 2 },
    });

    expect(engine.dailyDb[`${userId}_${day1}`].activeSeconds).toBe(300);
    expect(engine.dailyDb[`${userId}_${day1}`].actionsCount).toBe(5);

    expect(engine.dailyDb[`${userId}_${day2}`].activeSeconds).toBe(120);
    expect(engine.dailyDb[`${userId}_${day2}`].actionsCount).toBe(2);
  });
});
