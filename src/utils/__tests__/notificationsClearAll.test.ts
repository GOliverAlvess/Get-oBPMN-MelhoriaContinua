import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearAllNotifications, checkAndNotifyActionDeadlines } from '../../lib/notificationService';
import { NotificationItem, OperationalAction } from '../../types';
import * as apiUrlModule from '../apiUrl';

describe('AUD-002: Notificações - Operação "Limpar todas" e Prevenção de Ressurreição', () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = global.localStorage;

  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockLocalStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
      }),
      length: 0,
      key: vi.fn(() => null),
    } as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
    vi.restoreAllMocks();
  });

  it('deve chamar o endpoint correto utilizando getApiUrl respeitando subpaths (/pdca)', async () => {
    const getApiUrlSpy = vi.spyOn(apiUrlModule, 'getApiUrl');

    const mockNotifications: NotificationItem[] = [
      {
        id: 'notif_1',
        usuario_id: 'user_123',
        tipo: 'card',
        mensagem: 'Card 1',
        referencia_id: 'p1',
        lida: false,
        data: '2026-08-26T10:00:00.000Z',
      },
      {
        id: 'notif_2',
        usuario_id: 'user_123',
        tipo: 'acao',
        mensagem: 'Ação 1',
        referencia_id: 'a1',
        lida: true,
        data: '2026-08-26T10:00:00.000Z',
      },
    ];

    let capturedUrl = '';
    let capturedOptions: any = null;

    global.fetch = vi.fn(async (url: any, options: any) => {
      capturedUrl = url.toString();
      capturedOptions = options;
      return {
        ok: true,
        json: async () => ({ success: true, count: 2 }),
      } as Response;
    });

    await clearAllNotifications(mockNotifications, 'user_123', 'test@empresa.com');

    // Verifica que getApiUrl foi utilizado com o path relativo oficial
    expect(getApiUrlSpy).toHaveBeenCalledWith('/api/notifications/clear-all');
    expect(capturedUrl).toContain('/api/notifications/clear-all');

    // Verifica headers de autenticação
    expect(capturedOptions.headers['x-user-uid']).toBe('user_123');
    expect(capturedOptions.headers['x-user-email']).toBe('test@empresa.com');

    // Verifica payload com notificationIds
    const parsedBody = JSON.parse(capturedOptions.body);
    expect(parsedBody.notificationIds).toEqual(['notif_1', 'notif_2']);
  });

  it('deve marcar localStorage para todas as variações de identificador do usuário ao limpar', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);

    const mockNotifications: NotificationItem[] = [
      {
        id: 'notif_1',
        usuario_id: 'user_internal_id',
        tipo: 'acao',
        mensagem: 'Notificação',
        referencia_id: 'ref1',
        lida: false,
        data: new Date().toISOString(),
      },
    ];

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, count: 1 }),
    } as Response));

    await clearAllNotifications(mockNotifications, 'auth_uid_456', 'User@Empresa.COM');

    expect(mockLocalStorage[`daily_deadline_alert_${todayStr}_auth_uid_456`]).toBe('true');
    expect(mockLocalStorage[`daily_deadline_alert_${todayStr}_user@empresa.com`]).toBe('true');
    expect(mockLocalStorage[`daily_deadline_alert_${todayStr}_user_internal_id`]).toBe('true');
  });

  it('não deve recriar notificação diária de prazo após "Limpar todas"', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);

    // Simula que o usuário acabou de limpar todas as notificações
    mockLocalStorage[`daily_deadline_alert_${todayStr}_user_123`] = 'true';
    mockLocalStorage[`daily_deadline_alert_${todayStr}_user@empresa.com`] = 'true';

    const actions: OperationalAction[] = [
      {
        id: 'act_1',
        projectId: 'proj_1',
        projectName: 'Projeto A',
        subtaskId: 'sub_1',
        subtaskTitle: 'Subtarefa 1',
        action: 'Ação Urgente',
        forecastDate: todayStr, // hoje
        responsibleId: 'user_123',
        responsibleName: 'Usuário Teste',
        status: 'Pendente',
        priority: 'Alta',
        createdAt: '2026-08-26T08:00:00.000Z',
      },
    ];

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // existingNotifications vazio (como fica logo após Limpar todas)
    await checkAndNotifyActionDeadlines(
      'user_123',
      'user@empresa.com',
      'Usuário Teste',
      actions,
      []
    );

    // Não deve disparar criação de notificação nem requisições
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deve lançar erro e não mascarar quando o backend retornar falha na limpeza', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Erro de conexão com o banco de dados.' }),
    } as Response));

    const mockNotifications: NotificationItem[] = [
      {
        id: 'notif_1',
        usuario_id: 'user_123',
        tipo: 'card',
        mensagem: 'Card 1',
        referencia_id: 'p1',
        lida: false,
        data: '2026-08-26T10:00:00.000Z',
      },
    ];

    await expect(
      clearAllNotifications(mockNotifications, 'user_123', 'user@empresa.com')
    ).rejects.toThrow('Erro de conexão com o banco de dados.');
  });
});
