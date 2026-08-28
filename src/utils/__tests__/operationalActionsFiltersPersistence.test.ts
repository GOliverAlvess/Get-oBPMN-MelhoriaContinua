import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getOperationalFiltersStorageKey, 
  loadPersistedOperationalFilters, 
  PersistedOperationalFilters 
} from '../../components/OperationalActionsTab';

describe('AUD-008: Persistência de Filtros no Histórico de Ações (sessionStorage)', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    // Mock sessionStorage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
      }
    });
  });

  it('deve gerar chave de armazenamento isolada por usuário', () => {
    expect(getOperationalFiltersStorageKey('user-123')).toBe('gipflow_operational_actions_filters_user-123');
    expect(getOperationalFiltersStorageKey('user-456')).toBe('gipflow_operational_actions_filters_user-456');
    expect(getOperationalFiltersStorageKey('')).toBe('gipflow_operational_actions_filters_guest');
  });

  it('deve salvar e carregar filtros estruturados com integridade', () => {
    const filters: PersistedOperationalFilters = {
      searchTerm: 'Revisão',
      filterProjects: ['proj-1', 'proj-2'],
      filterResponsibles: ['resp-1'],
      filterStatuses: ['Em andamento'],
      filterPriorities: ['Alta'],
      filterDeadlineAlertOnly: false,
      filterAlertStatuses: ['Próximo do vencimento'],
      forecastStartDate: '2026-08-01',
      forecastEndDate: '2026-08-31',
      forecastShortcut: 'custom',
      viewMode: 'list',
      scopeMode: 'my_actions'
    };

    const key = getOperationalFiltersStorageKey('user-123');
    sessionStorage.setItem(key, JSON.stringify(filters));

    const loaded = loadPersistedOperationalFilters('user-123');
    expect(loaded).toEqual(filters);
  });

  it('deve isolar filtros entre usuários distintos', () => {
    const filtersUser1: PersistedOperationalFilters = {
      searchTerm: 'Projeto Alpha',
      scopeMode: 'my_actions'
    };
    const filtersUser2: PersistedOperationalFilters = {
      searchTerm: 'Projeto Beta',
      scopeMode: 'all_actions'
    };

    sessionStorage.setItem(getOperationalFiltersStorageKey('user-1'), JSON.stringify(filtersUser1));
    sessionStorage.setItem(getOperationalFiltersStorageKey('user-2'), JSON.stringify(filtersUser2));

    expect(loadPersistedOperationalFilters('user-1')?.searchTerm).toBe('Projeto Alpha');
    expect(loadPersistedOperationalFilters('user-2')?.searchTerm).toBe('Projeto Beta');
  });

  it('deve retornar null e limpar entrada corrompida de forma segura sem lançar exceção', () => {
    const key = getOperationalFiltersStorageKey('user-broken');
    sessionStorage.setItem(key, '{ invalid json string %%%');

    const result = loadPersistedOperationalFilters('user-broken');
    expect(result).toBeNull();
    // A chave corrompida deve ter sido removida
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('deve retornar null se não houver dados no sessionStorage', () => {
    const result = loadPersistedOperationalFilters('user-empty');
    expect(result).toBeNull();
  });
});
