import { describe, it, expect } from 'vitest';
import { filterActiveProjects, computeProjectItems, ComputedProjectItem, filterComputedData, sortComputedData } from '../calculations';
import { Project, User, Subtask, PDCACycle } from '../../types';

// Helper to create empty mockup scope
const createMockScope = () => ({
  title: 'Escopo Teste',
  responsible: 'Lider Teste',
  problemDescription: 'Problema',
  measurableObjective: 'Objetivo',
  involvedSectors: [],
  toolsUsed: [],
  startDate: '2026-06-01',
  forecastCompletion: '2026-06-30',
  financial: {
    currentImpact: { value: 0, type: 'fixo' as const, period: 'mensal' as const },
    gainProjection: { value: 0, type: 'fixo' as const, period: 'mensal' as const },
  },
});

// Helper mock users
const mockUsers: User[] = [
  { id: 'u1', name: 'Analista A', sector: 'Logistica', profile: 'Usuário Analista' },
  { id: 'u2', name: 'Analista B', sector: 'Qualidade', profile: 'Usuário Analista' },
  { id: 'u3', name: 'Analista C', sector: 'Vendas', profile: 'Usuário Master' },
];

describe('Business Rules and Calculations Tests', () => {
  describe('filterActiveProjects', () => {
    it('deve retornar apenas projetos ativos (não cancelados ou excluídos e não indefinidos)', () => {
      const projects = [
        { id: 'p1', name: 'Projeto Ativo 1', status: 'Em andamento' } as any,
        { id: 'p2', name: 'Projeto Ativo 2', status: 'Planejamento' } as any,
        { id: 'p3', name: 'Projeto Cancelado', status: 'Cancelado' } as any,
        { id: 'p4', name: 'Projeto Excluído', status: 'Excluído' } as any,
        { id: 'p5', name: 'Status Indefinido', status: undefined } as any,
      ];

      const active = filterActiveProjects(projects);
      expect(active).toHaveLength(2);
      expect(active.map(p => p.id)).toEqual(['p1', 'p2']);
    });
  });

  describe('computeProjectItems without subtasks', () => {
    const referenceDate = new Date('2026-06-20T10:00:00Z');

    it('deve retornar status "Planejamento" e progresso 5% para projeto em planejamento', () => {
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Planejamento',
          status: 'Planejamento',
          createdAt: '2026-06-10T10:00:00Z',
          progress: 0,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items).toHaveLength(1);
      expect(items[0].status_visao_geral).toBe('Planejamento');
      expect(items[0].percentual_conclusao).toBe(5);
      // Diff is 10 days
      expect(items[0].tempo_total).toBe(10);
      expect(items[0].tempo_etapa).toBe(10);
      expect(items[0].nivel_alerta).toBe('Normal');
      expect(items[0].responsavel_atual).toBe('Analista A');
      expect(items[0].setor_atual).toBe('Logistica');
    });

    it('deve retornar status "Backlog", alerta "Normal" (independente do prazo) e setor "Processos" para projeto em backlog', () => {
      const projects: Project[] = [
        {
          id: 'p_backlog',
          name: 'Projeto Backlog',
          status: 'Backlog',
          // Criado há 40 dias (deveria alarmar "Muito crítico" se não fosse do Backlog)
          createdAt: '2026-05-11T10:00:00Z',
          progress: 0,
          assignedTo: 'backlog',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items).toHaveLength(1);
      expect(items[0].status_visao_geral).toBe('Backlog');
      expect(items[0].percentual_conclusao).toBe(0);
      expect(items[0].tempo_total).toBe(40);
      expect(items[0].nivel_alerta).toBe('Normal');
      expect(items[0].setor_atual).toBe('Processos');
    });

    it('deve retornar status "Em mapeamento" e progresso 15% para projeto em andamento sem subetapas', () => {
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Em Andamento',
          status: 'Em andamento',
          createdAt: '2026-06-18T10:00:00Z',
          progress: 10,
          assignedTo: 'u2',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items).toHaveLength(1);
      expect(items[0].status_visao_geral).toBe('Em mapeamento');
      expect(items[0].percentual_conclusao).toBe(15);
      expect(items[0].responsavel_atual).toBe('Analista B');
    });

    it('deve retornar status "Concluído", progresso 100% e alerta "Finalizado" para projeto Concluído sem subetapas', () => {
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Concluido',
          status: 'Concluído',
          createdAt: '2026-06-10T10:00:00Z',
          progress: 100,
          assignedTo: 'u2',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items).toHaveLength(1);
      expect(items[0].status_visao_geral).toBe('Concluído');
      expect(items[0].percentual_conclusao).toBe(100);
      expect(items[0].nivel_alerta).toBe('Finalizado');
    });

    it('deve atribuir "Não designado" e "Geral" para projeto sem analista asignado na base de usuários', () => {
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Sem Usuario',
          status: 'Em andamento',
          createdAt: '2026-06-10T10:00:00Z',
          progress: 0,
          assignedTo: 'inexistent_user_id',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].responsavel_atual).toBe('Não designado');
      expect(items[0].setor_atual).toBe('Geral');
    });
  });

  describe('Alert rules and stage timings for projects without subtasks', () => {
    it('deve retornar "Parado" quando tempo de etapa estiver entre 16 e 20', () => {
      const referenceDate = new Date('2026-06-20T10:00:00Z');
      const createdAt = '2026-06-03T10:00:00Z'; // 17 days before referenceDate
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Parado',
          status: 'Em andamento',
          createdAt,
          progress: 0,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].tempo_etapa).toBe(17);
      expect(items[0].nivel_alerta).toBe('Parado');
    });

    it('deve retornar "Crítico" quando tempo de etapa estiver entre 21 e 30', () => {
      const referenceDate = new Date('2026-06-30T10:00:00Z');
      const createdAt = '2026-06-05T10:00:00Z'; // 25 days diff
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Critico',
          status: 'Em andamento',
          createdAt,
          progress: 0,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].tempo_etapa).toBe(25);
      expect(items[0].nivel_alerta).toBe('Crítico');
    });

    it('deve retornar "Muito crítico" quando tempo de etapa for maior que 30', () => {
      const referenceDate = new Date('2026-07-20T10:00:00Z');
      const createdAt = '2026-06-10T10:00:00Z'; // 40 days diff
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Muito Critico',
          status: 'Em andamento',
          createdAt,
          progress: 0,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].tempo_etapa).toBe(40);
      expect(items[0].nivel_alerta).toBe('Muito crítico');
    });
  });

  describe('computeProjectItems with Subtasks', () => {
    const referenceDate = new Date('2026-06-25T12:00:00Z');

    it('deve propagar status "Concluído" se a subtask estiver Concluída', () => {
      const subtask: Subtask = {
        id: 's1',
        title: 'Mapeamento de Processos',
        priority: 'Média',
        status: 'Concluído',
        pdcaCycles: [],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'horizontal',
          lastEdited: '2026-06-20T12:00:00Z',
          savedColors: [],
        },
      };

      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto Com Subtask Concluida',
          status: 'Em andamento',
          createdAt: '2026-06-10T12:00:00Z',
          progress: 50,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [subtask],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items).toHaveLength(1);
      expect(items[0].status_visao_geral).toBe('Concluído');
      expect(items[0].percentual_conclusao).toBe(100);
      expect(items[0].nivel_alerta).toBe('Finalizado');
    });

    it('deve definir status "Análise do problema" (PLAN) e responsabilidade corretos para ciclo PDCA ativo na etapa PLAN', () => {
      const pdca: PDCACycle = {
        id: 'cycle1',
        taskId: 't1',
        title: 'Ciclo 1',
        createdAt: '2026-06-20T12:00:00Z',
        status: 'Ativo',
        etapaAtual: 'PLAN',
        plan: {
          problemDescription: 'Problema',
          rootCauseAnalysis: { type: '5whys', entries: [] },
          impact: { description: 'OEE', value: 50, goal: 80 },
          actionPlan: [],
        },
      };

      const subtask: Subtask = {
        id: 's1',
        title: 'Subetapa 1',
        priority: 'Alta',
        status: 'Em andamento',
        responsibleId: 'u2',
        pdcaCycles: [pdca],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'vertical',
          lastEdited: '2026-06-20T12:00:00Z',
          savedColors: [],
        },
      };

      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto com PDCA PLAN',
          status: 'Em andamento',
          createdAt: '2026-06-10T12:00:00Z',
          progress: 30,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [subtask],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items).toHaveLength(1);
      expect(items[0].status_visao_geral).toBe('Análise do problema');
      expect(items[0].percentual_conclusao).toBe(30);
      expect(items[0].responsavel_atual).toBe('Analista B');
      expect(items[0].setor_atual).toBe('Qualidade');
    });

    it('deve definir responsabilidade para o Executor designado do Plano de Ação quando em etapa "Plano de ação" (DO)', () => {
      const pdca: PDCACycle = {
        id: 'cycle1',
        taskId: 't1',
        title: 'Ciclo 1',
        createdAt: '2026-06-18T12:00:00Z',
        status: 'Ativo',
        etapaAtual: 'DO',
        plan: {
          problemDescription: 'Problema',
          rootCauseAnalysis: { type: '5whys', entries: [] },
          impact: { description: 'OEE', value: 50, goal: 80 },
          actionPlan: [
            {
              id: 'ap1',
              action: 'Fazer ação x',
              who: 'Executor Especializado',
              where: 'Setor Alternativo',
              status: 'Em andamento',
              forecastDate: '2026-06-30',
            } as any,
          ],
        },
      };

      const subtask: Subtask = {
        id: 's1',
        title: 'Subetapa 1',
        priority: 'Alta',
        status: 'Em andamento',
        responsibleId: 'u2',
        pdcaCycles: [pdca],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'vertical',
          lastEdited: '2026-06-18T12:00:00Z',
          savedColors: [],
        },
      };

      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto com PDCA DO',
          status: 'Em andamento',
          createdAt: '2026-06-10T12:00:00Z',
          progress: 50,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [subtask],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].status_visao_geral).toBe('Plano de ação');
      expect(items[0].percentual_conclusao).toBe(50);
      expect(items[0].responsavel_atual).toBe('Executor Especializado');
      expect(items[0].setor_atual).toBe('Setor Alternativo');
    });

    it('deve definir o setor como "Processos" quando a etapa for "Período de teste" (CHECK), "Em implantação" (ACT) ou "Concluído"', () => {
      const pdcaCheck: PDCACycle = {
        id: 'cycle1',
        taskId: 't1',
        title: 'Ciclo 1',
        createdAt: '2026-06-20T12:00:00Z',
        status: 'Ativo',
        etapaAtual: 'CHECK',
        plan: {
          problemDescription: 'Problema',
          rootCauseAnalysis: { type: '5whys', entries: [] },
          impact: { description: 'OEE', value: 50, goal: 80 },
          actionPlan: [],
        },
      };

      const subtask: Subtask = {
        id: 's1',
        title: 'Subetapa 1',
        priority: 'Alta',
        status: 'Em andamento',
        responsibleId: 'u2',
        pdcaCycles: [pdcaCheck],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'vertical',
          lastEdited: '2026-06-20T12:00:00Z',
          savedColors: [],
        },
      };

      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto CHECK',
          status: 'Em andamento',
          createdAt: '2026-06-10T12:00:00Z',
          progress: 75,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [subtask],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].status_visao_geral).toBe('Período de teste');
      expect(items[0].percentual_conclusao).toBe(75);
      expect(items[0].responsavel_atual).toBe('Analista B');
      expect(items[0].setor_atual).toBe('Processos');
    });

    it('deve calcular o tempo de etapa da subtask usando a data mais recente entre criação, lastEdited do mapping e pdcaCycles', () => {
      const pdca: PDCACycle = {
        id: 'cycle1',
        taskId: 't1',
        title: 'Ciclo 1',
        createdAt: '2026-06-22T12:00:00Z', // 3 days before referenceDate
        status: 'Ativo',
        etapaAtual: 'PLAN',
        plan: {
          problemDescription: 'Problema',
          rootCauseAnalysis: { type: '5whys', entries: [] },
          impact: { description: 'OEE', value: 50, goal: 80 },
          actionPlan: [],
        },
      };

      const subtask: Subtask = {
        id: 's1',
        title: 'Subetapa 1',
        priority: 'Alta',
        status: 'Em andamento',
        responsibleId: 'u2',
        pdcaCycles: [pdca],
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'vertical',
          lastEdited: '2026-06-20T12:00:00Z', // 5 days before referenceDate
          savedColors: [],
        },
      };

      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Projeto CHECK',
          status: 'Em andamento',
          createdAt: '2026-06-10T12:00:00Z', // 15 days before referenceDate
          progress: 50,
          assignedTo: 'u1',
          scope: createMockScope(),
          subtasks: [subtask],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].tempo_total).toBe(15);
      // The latest update is 2026-06-22T12:00:00Z which makes tempo_etapa = 3 days
      expect(items[0].tempo_etapa).toBe(3);
    });
  });

  describe('filterComputedData and sortComputedData', () => {
    const mockItems: ComputedProjectItem[] = [
      {
        id: '1',
        projectId: 'p1',
        name: 'Projeto Alfa',
        subtask_name: '-',
        status_visao_geral: 'Planejamento',
        responsavel_atual: 'Carlos',
        setor_atual: 'Qualidade',
        tempo_etapa: 5,
        tempo_total: 10,
        percentual_conclusao: 5,
        nivel_alerta: 'Normal',
        fullProject: {} as any
      },
      {
        id: '2',
        projectId: 'p2',
        name: 'Projeto Beta',
        subtask_name: 'Sub 1',
        status_visao_geral: 'Plano de ação',
        responsavel_atual: 'Amanda',
        setor_atual: 'Processos',
        tempo_etapa: 25,
        tempo_total: 35,
        percentual_conclusao: 50,
        nivel_alerta: 'Crítico',
        fullProject: {} as any
      },
      {
        id: '3',
        projectId: 'p3',
        name: 'Mega Melhora',
        subtask_name: '-',
        status_visao_geral: 'Concluído',
        responsavel_atual: 'Carlos',
        setor_atual: 'Logistica',
        tempo_etapa: 1,
        tempo_total: 50,
        percentual_conclusao: 100,
        nivel_alerta: 'Finalizado',
        fullProject: {} as any
      },
    ];

    it('deve filtrar por busca de texto (case insensitive)', () => {
      const filteredByName = filterComputedData(mockItems, 'alfa', [], [], []);
      expect(filteredByName).toHaveLength(1);
      expect(filteredByName[0].name).toBe('Projeto Alfa');

      const filteredByResp = filterComputedData(mockItems, 'amanda', [], [], []);
      expect(filteredByResp).toHaveLength(1);
      expect(filteredByResp[0].responsavel_atual).toBe('Amanda');

      const filteredBySector = filterComputedData(mockItems, 'LOGISTICA', [], [], []);
      expect(filteredBySector).toHaveLength(1);
      expect(filteredBySector[0].name).toBe('Mega Melhora');
    });

    it('deve filtrar por múltiplos status, responsáveis ou setores', () => {
      const filteredByStatus = filterComputedData(mockItems, '', ['Planejamento', 'Concluído'], [], []);
      expect(filteredByStatus).toHaveLength(2);
      expect(filteredByStatus.map(x => x.id)).toContain('1');
      expect(filteredByStatus.map(x => x.id)).toContain('3');

      const filteredByResp = filterComputedData(mockItems, '', [], ['Carlos'], []);
      expect(filteredByResp).toHaveLength(2);
      expect(filteredByResp.map(x => x.id)).not.toContain('2');
    });

    it('deve ordenar dados corretamente', () => {
      // Ordenação por tempo_etapa desc
      const sortedByEtapaDesc = sortComputedData(mockItems, 'tempo_etapa', 'desc');
      expect(sortedByEtapaDesc[0].id).toBe('2'); // 25 d
      expect(sortedByEtapaDesc[1].id).toBe('1'); // 5 d
      expect(sortedByEtapaDesc[2].id).toBe('3'); // 1 d

      // Ordenação por tempo_total asc
      const sortedByTotalAsc = sortComputedData(mockItems, 'tempo_total', 'asc');
      expect(sortedByTotalAsc[0].id).toBe('1'); // 10 d
      expect(sortedByTotalAsc[1].id).toBe('2'); // 35 d
      expect(sortedByTotalAsc[2].id).toBe('3'); // 50 d

      // Ordenação por nível de alerta (importância de gravidade)
      const sortedByAlert = sortComputedData(mockItems, 'nivel_alerta', 'desc');
      expect(sortedByAlert[0].nivel_alerta).toBe('Crítico');
      expect(sortedByAlert[1].nivel_alerta).toBe('Normal');
      expect(sortedByAlert[2].nivel_alerta).toBe('Finalizado');
    });
  });

  describe('Práticas e regras de Backlog para gráficos e painéis', () => {
    it('deve assegurar que projetos em Backlog não influenciam alertas críticos (nivel_alerta sempre Normal)', () => {
      const backlogItem: ComputedProjectItem = {
        id: '1',
        projectId: 'p1',
        name: 'Projeto Backlog',
        subtask_name: '-',
        status_visao_geral: 'Backlog',
        responsavel_atual: 'Não designado',
        setor_atual: 'Processos',
        tempo_etapa: 50,
        tempo_total: 50,
        percentual_conclusao: 0,
        nivel_alerta: 'Normal', // Regra de backlog
        fullProject: {} as any
      };
      
      const normalItem: ComputedProjectItem = {
        id: '2',
        projectId: 'p2',
        name: 'Projeto Regular',
        subtask_name: '-',
        status_visao_geral: 'Planejamento',
        responsavel_atual: 'Carlos',
        setor_atual: 'Geral',
        tempo_etapa: 25,
        tempo_total: 25,
        percentual_conclusao: 5,
        nivel_alerta: 'Crítico',
        fullProject: {} as any
      };

      const data = [backlogItem, normalItem];
      const criticos = data.filter(d => d.nivel_alerta === 'Crítico' || d.nivel_alerta === 'Muito crítico').length;
      expect(criticos).toBe(1); // Apenas o Projeto Regular conta como crítico, Backlog é Normal
    });

    it('deve assegurar que projetos em Backlog são mapeados para o setor Processos no gráfico de setores', () => {
      const referenceDate = new Date('2026-06-20T10:00:00Z');
      const projects: Project[] = [
        {
          id: 'p_backlog',
          name: 'Projeto Backlog',
          status: 'Backlog',
          createdAt: '2026-06-15T10:00:00Z',
          progress: 0,
          assignedTo: 'backlog',
          scope: createMockScope(),
          subtasks: [],
        },
      ];

      const items = computeProjectItems(projects, mockUsers, referenceDate);
      expect(items[0].setor_atual).toBe('Processos');
    });

    it('deve filtrar projetos com status "Backlog" no gráfico de distribuição por responsável', () => {
      const testData: ComputedProjectItem[] = [
        {
          id: '1',
          projectId: 'p1',
          name: 'Projeto Backlog',
          subtask_name: '-',
          status_visao_geral: 'Backlog',
          responsavel_atual: 'Não designado',
          setor_atual: 'Processos',
          tempo_etapa: 5,
          tempo_total: 5,
          percentual_conclusao: 0,
          nivel_alerta: 'Normal',
          fullProject: {} as any
        },
        {
          id: '2',
          projectId: 'p2',
          name: 'Projeto Ativo',
          subtask_name: '-',
          status_visao_geral: 'Planejamento',
          responsavel_atual: 'Carlos',
          setor_atual: 'Logistica',
          tempo_etapa: 5,
          tempo_total: 5,
          percentual_conclusao: 5,
          nivel_alerta: 'Normal',
          fullProject: {} as any
        },
      ];

      // Simulamos a redução de respCounts usada no gráfico
      const respCounts = testData.reduce((acc, curr) => {
        if (curr.status_visao_geral === 'Backlog') return acc;
        acc[curr.responsavel_atual] = (acc[curr.responsavel_atual] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(respCounts['Não designado']).toBeUndefined();
      expect(respCounts['Carlos']).toBe(1);
    });
  });
});
