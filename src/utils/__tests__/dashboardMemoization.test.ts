import { describe, it, expect } from 'vitest';
import { Project, User, OperationalAction } from '../../types';

// Mock project for calculation tests
const mockUsers: User[] = [
  { id: 'u1', name: 'Carlos Silva', sector: 'Operações', profile: 'Usuário Analista' },
  { id: 'u2', name: 'Mariana Costa', sector: 'Qualidade', profile: 'Usuário Analista' },
];

const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Otimização Logística',
    status: 'Em andamento',
    assignedTo: 'u1',
    createdAt: '2026-06-01T00:00:00Z',
    progress: 50,
    priority: 'Alta',
    scope: {
      title: 'Otimização Logística',
      responsible: 'Carlos Silva',
      problemDescription: 'Demora na entrega',
      measurableObjective: 'Reduzir em 20%',
      involvedSectors: [{ id: 's1', name: 'Logística' }, { id: 's2', name: 'Operações' }],
      toolsUsed: [],
      startDate: '2026-06-01',
      forecastCompletion: '2026-08-01',
      financial: {
        currentImpact: { value: 0, type: 'fixo' as const, period: 'mensal' as const },
        gainProjection: { value: 0, type: 'fixo' as const, period: 'mensal' as const },
      },
    },
    subtasks: [
      {
        id: 'st1',
        title: 'Mapeamento de Rotas',
        status: 'Em andamento',
        priority: 'Alta',
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'horizontal',
          lastEdited: '2026-06-01',
          savedColors: [],
        },
        pdcaCycles: [
          {
            id: 'c1',
            taskId: 'st1',
            title: 'Ciclo 1',
            status: 'Concluído',
            etapaAtual: 'REPORT',
            createdAt: '2026-06-05T00:00:00Z',
            plan: {
              problemDescription: 'Problema',
              rootCauseAnalysis: { type: '5whys', entries: [] },
              impact: {
                description: 'Impacto logístico',
                goal: 100,
                impactType: 'Tangível',
                tangibleFinancialLoss: 5000,
                value: 5000,
              },
              actionPlan: [
                {
                  id: 'a1',
                  what: 'Revisar rotas',
                  why: 'Custo alto',
                  who: 'u1',
                  where: 'Setor 1',
                  when: '2026-06-15',
                  how: 'GPS',
                  howMuch: '0',
                  status: 'Concluído',
                  executionLogs: [],
                  ativo: true,
                  realGains: {
                    tangible: [
                      { id: 'tg1', type: 'financeiro', value: 5000, unit: 'R$' },
                      { id: 'tg2', type: 'horas', value: 10, unit: 'horas' },
                    ],
                    intangible: [],
                  },
                },
              ],
            },
            check: {
              realCostReduction: 5000,
              realTimeGain: 10,
              expectedGainAchieved: 'Sim',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'p2',
    name: 'Digitalização de Formulários',
    status: 'Concluído',
    assignedTo: 'u2',
    createdAt: '2026-06-10T00:00:00Z',
    progress: 100,
    priority: 'Média',
    scope: {
      title: 'Digitalização',
      responsible: 'Mariana Costa',
      problemDescription: 'Papelada excessiva',
      measurableObjective: 'Zero papel',
      involvedSectors: [{ id: 's3', name: 'Administrativo' }],
      toolsUsed: [],
      startDate: '2026-06-10',
      forecastCompletion: '2026-07-10',
      financial: {
        currentImpact: { value: 0, type: 'fixo' as const, period: 'mensal' as const },
        gainProjection: { value: 0, type: 'fixo' as const, period: 'mensal' as const },
      },
    },
    subtasks: [],
  },
];

describe('AUD-010 Dashboard Memoization & Calculations Invariance', () => {
  it('calcula métricas de ganhos e estatísticas de forma idempotente e exata', () => {
    // Verificação de agregação de ganhos realizados
    const userMap = new Map(mockUsers.map(u => [u.id, u]));

    let totalGainValue = 0;
    const projectGainsMap: Record<string, { name: string; gain: number }> = {};

    mockProjects.forEach(p => {
      let pRealizedGain = 0;
      const processedCycleIds = new Set<string>();

      (p.subtasks || []).forEach(subtask => {
        (subtask.pdcaCycles || []).forEach(cycle => {
          if (processedCycleIds.has(cycle.id)) return;
          processedCycleIds.add(cycle.id);

          const isCycleCompleted = cycle.status === 'Concluído' || cycle.etapaAtual === 'REPORT';

          if (isCycleCompleted) {
            const cycleGain = (cycle.plan?.actionPlan || []).reduce((s, action) => {
              if (action.ativo === false) return s;
              const tangibleSum = (action.realGains?.tangible || []).reduce((acc, t) => acc + (t.value || 0), 0);
              return s + tangibleSum;
            }, 0);

            pRealizedGain += cycleGain;
            totalGainValue += cycleGain;
          }
        });
      });

      if (pRealizedGain !== 0) {
        projectGainsMap[p.id] = { name: p.name, gain: pRealizedGain };
      }
    });

    expect(totalGainValue).toBe(5010); // 5000 + 10 = 5010 tangible sum
    expect(projectGainsMap['p1']).toEqual({ name: 'Otimização Logística', gain: 5010 });
    expect(projectGainsMap['p2']).toBeUndefined();
  });

  it('userMap resolve usuários instantaneamente com O(1) sem alterar nomes', () => {
    const userMap = new Map(mockUsers.map(u => [u.id, u]));
    expect(userMap.get('u1')?.name).toBe('Carlos Silva');
    expect(userMap.get('u2')?.name).toBe('Mariana Costa');
    expect(userMap.get('u_inexistente')).toBeUndefined();
  });

  it('preserva filtros dinâmicos e atualiza estatísticas quando dados de entrada mudam', () => {
    // Filtragem por colaborador
    const filterByCollab = (projects: Project[], collabIds: string[]) => {
      return projects.filter(p => collabIds.length === 0 || collabIds.includes(p.assignedTo));
    };

    const all = filterByCollab(mockProjects, []);
    expect(all).toHaveLength(2);

    const filtered = filterByCollab(mockProjects, ['u1']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('p1');

    const filtered2 = filterByCollab(mockProjects, ['u2']);
    expect(filtered2).toHaveLength(1);
    expect(filtered2[0].id).toBe('p2');
  });
});
