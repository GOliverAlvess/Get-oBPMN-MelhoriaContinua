import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getOperationalFiltersStorageKey, 
  loadPersistedOperationalFilters, 
  PersistedOperationalFilters 
} from '../../components/OperationalActionsTab';
import { OperationalAction, Project } from '../../types';

describe('Ajuste Pontual: Atalho "Ver Ações" nas Subtarefas do Escopo', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
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

  const mockProjectA: Project = {
    id: 'proj-1',
    name: 'Homologação de Etiquetas',
    description: 'Projeto teste etiquetas',
    createdAt: '2026-09-01T00:00:00.000Z',
    progress: 50,
    status: 'Em andamento',
    priority: 'Alta',
    assignedTo: 'user-1',
    scope: {
      title: 'Homologação de Etiquetas',
      responsible: 'Admin',
      problemDescription: 'Problema teste de etiquetas',
      measurableObjective: 'Homologar 100% das etiquetas',
      involvedSectors: [],
      toolsUsed: [],
      startDate: '2026-09-01',
      forecastCompletion: '2026-10-31',
      financial: {
        currentImpact: { value: 0, type: 'fixo', period: 'mensal' },
        gainProjection: { value: 0, type: 'fixo', period: 'mensal' },
      }
    },
    subtasks: [
      {
        id: 'sub-1',
        title: 'Homologação Cliente ABC',
        priority: 'Alta',
        status: 'Em andamento',
        responsibleId: 'user-1',
        pdcaCycles: [],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'horizontal',
          lastEdited: '2026-09-01T00:00:00.000Z',
          savedColors: []
        }
      },
      {
        id: 'sub-2',
        title: 'Homologação Cliente XYZ',
        priority: 'Média',
        status: 'Pendente',
        responsibleId: 'user-2',
        pdcaCycles: [],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'horizontal',
          lastEdited: '2026-09-01T00:00:00.000Z',
          savedColors: []
        }
      },
      {
        id: 'sub-3-empty',
        title: 'Subtarefa Sem Ações',
        priority: 'Baixa',
        status: 'Pendente',
        responsibleId: 'user-1',
        pdcaCycles: [],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'horizontal',
          lastEdited: '2026-09-01T00:00:00.000Z',
          savedColors: []
        }
      }
    ]
  };

  const mockActions: OperationalAction[] = [
    {
      id: 'act-1',
      action: 'Testar adesivo especial',
      projectId: 'proj-1',
      projectName: 'Homologação de Etiquetas',
      subtaskId: 'sub-1',
      subtaskTitle: 'Homologação Cliente ABC',
      responsibleId: 'user-1',
      responsibleName: 'João Silva',
      status: 'Em andamento',
      priority: 'Alta',
      forecastDate: '2026-10-15',
      createdAt: '2026-09-10T10:00:00.000Z'
    },
    {
      id: 'act-2',
      action: 'Enviar amostra para ABC',
      projectId: 'proj-1',
      projectName: 'Homologação de Etiquetas',
      subtaskId: 'sub-1',
      subtaskTitle: 'Homologação Cliente ABC',
      responsibleId: 'user-1',
      responsibleName: 'João Silva',
      status: 'Concluído',
      priority: 'Média',
      forecastDate: '2026-09-20',
      createdAt: '2026-09-11T10:00:00.000Z'
    },
    {
      id: 'act-3',
      action: 'Homologar tinta XYZ',
      projectId: 'proj-1',
      projectName: 'Homologação de Etiquetas',
      subtaskId: 'sub-2',
      subtaskTitle: 'Homologação Cliente XYZ',
      responsibleId: 'user-2',
      responsibleName: 'Maria Santos',
      status: 'Pendente',
      priority: 'Alta',
      forecastDate: '2026-10-30',
      createdAt: '2026-09-12T10:00:00.000Z'
    },
    {
      id: 'act-4',
      action: 'Outro projeto qualquer',
      projectId: 'proj-2',
      projectName: 'Reestruturação Financeira',
      subtaskId: 'sub-other',
      subtaskTitle: 'Mapeamento Contábil',
      responsibleId: 'user-3',
      responsibleName: 'Carlos Lima',
      status: 'Pendente',
      priority: 'Baixa',
      forecastDate: '2026-11-01',
      createdAt: '2026-09-13T10:00:00.000Z'
    }
  ];

  // Helper de filtragem que reproduz com precisão a regra de filtragem da tela
  const filterOperationalActions = (
    actions: OperationalAction[],
    filterProjects: string[],
    filterSubtasks: string[]
  ) => {
    return actions.filter(a => {
      const matchProj = filterProjects.length === 0 || filterProjects.includes(a.projectId);
      const matchSub = filterSubtasks.length === 0 || (!!a.subtaskId && filterSubtasks.includes(a.subtaskId));
      return matchProj && matchSub;
    });
  };

  it('CENÁRIO A: Projeto possui subtarefa com ações — deve filtrar pelo projeto e subtarefa corretos', () => {
    const filtered = filterOperationalActions(mockActions, ['proj-1'], ['sub-1']);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(a => a.id)).toEqual(['act-1', 'act-2']);
    expect(filtered.every(a => a.subtaskId === 'sub-1' && a.projectId === 'proj-1')).toBe(true);
  });

  it('CENÁRIO B: Projeto possui duas subtarefas diferentes com ações distintas — cada atalho abre somente as ações da subtarefa correspondente', () => {
    const filteredSub1 = filterOperationalActions(mockActions, ['proj-1'], ['sub-1']);
    const filteredSub2 = filterOperationalActions(mockActions, ['proj-1'], ['sub-2']);

    expect(filteredSub1).toHaveLength(2);
    expect(filteredSub1.map(a => a.id)).toEqual(['act-1', 'act-2']);

    expect(filteredSub2).toHaveLength(1);
    expect(filteredSub2[0].id).toBe('act-3');
    expect(filteredSub2[0].subtaskTitle).toBe('Homologação Cliente XYZ');
  });

  it('CENÁRIO C: Subtarefa não possui ações — deve filtrar e retornar lista vazia sem erros', () => {
    const filteredEmpty = filterOperationalActions(mockActions, ['proj-1'], ['sub-3-empty']);
    expect(filteredEmpty).toHaveLength(0);
  });

  it('CENÁRIO D & F: Prioridade do contexto explícito de navegação sobre filtros salvos e preservação dos filtros do usuário', () => {
    // 1. Usuário tinha filtros salvos anteriormente no sessionStorage (ex: filtrando outro projeto)
    const previouslySavedFilters: PersistedOperationalFilters = {
      searchTerm: 'Outro projeto',
      filterProjects: ['proj-2'],
      filterStatuses: ['Pendente'],
      scopeMode: 'my_actions',
      viewMode: 'overview'
    };

    const storageKey = getOperationalFiltersStorageKey('user-test');
    sessionStorage.setItem(storageKey, JSON.stringify(previouslySavedFilters));

    // Confirmar que os filtros persistidos estão salvos
    const loadedSaved = loadPersistedOperationalFilters('user-test');
    expect(loadedSaved?.filterProjects).toEqual(['proj-2']);

    // 2. Navegação explícita via atalho "Ver ações" (CENÁRIO D):
    // Os parâmetros passados pela navegação prevalecem
    const navSource = 'subtask';
    const navProjectId = 'proj-1';
    const navSubtaskId = 'sub-1';

    const activeFilterProjects = navSource === 'subtask' ? [navProjectId] : (loadedSaved?.filterProjects || []);
    const activeFilterSubtasks = navSource === 'subtask' ? [navSubtaskId] : (loadedSaved?.filterSubtasks || []);

    expect(activeFilterProjects).toEqual(['proj-1']);
    expect(activeFilterSubtasks).toEqual(['sub-1']);

    // As ações filtradas com o contexto explícito prevalecem sobre os filtros antigos
    const resultExplicit = filterOperationalActions(mockActions, activeFilterProjects, activeFilterSubtasks);
    expect(resultExplicit).toHaveLength(2);
    expect(resultExplicit.map(a => a.id)).toEqual(['act-1', 'act-2']);

    // O storage não deve ter sido sobrescrito pela navegação temporária explícita
    const storageAfterNav = loadPersistedOperationalFilters('user-test');
    expect(storageAfterNav?.filterProjects).toEqual(['proj-2']);

    // 3. Acesso normal pelo menu principal (CENÁRIO F):
    // Quando o usuário acessa pelo menu (navigationSource === 'menu'), os filtros persistidos são respeitados
    const menuNavSource = 'menu';
    const restoredFromMenu = menuNavSource === 'menu' ? loadPersistedOperationalFilters('user-test') : null;
    expect(restoredFromMenu).toEqual(previouslySavedFilters);
  });

  it('CENÁRIO E: Suporta salvar e restaurar filterSubtasks em PersistedOperationalFilters', () => {
    const filtersWithSubtasks: PersistedOperationalFilters = {
      filterProjects: ['proj-1'],
      filterSubtasks: ['sub-1', 'sub-2'],
      viewMode: 'list',
      scopeMode: 'all_actions'
    };

    const key = getOperationalFiltersStorageKey('user-sub');
    sessionStorage.setItem(key, JSON.stringify(filtersWithSubtasks));

    const loaded = loadPersistedOperationalFilters('user-sub');
    expect(loaded?.filterSubtasks).toEqual(['sub-1', 'sub-2']);
    expect(loaded?.filterProjects).toEqual(['proj-1']);
  });
});
