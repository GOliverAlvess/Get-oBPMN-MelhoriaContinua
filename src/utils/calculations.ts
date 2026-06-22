import { Project, User, Subtask } from '../types';

export interface ComputedProjectItem {
  id: string;
  projectId: string;
  subtaskId?: string;
  name: string;
  subtask_name: string;
  status_visao_geral:
    | 'Backlog'
    | 'Planejamento'
    | 'Em mapeamento'
    | 'Análise do problema'
    | 'Plano de ação'
    | 'Período de teste'
    | 'Em implantação'
    | 'Concluído';
  responsavel_atual: string;
  setor_atual: string;
  tempo_etapa: number;
  tempo_total: number;
  percentual_conclusao: number;
  nivel_alerta: 'Muito crítico' | 'Crítico' | 'Parado' | 'Normal' | 'Finalizado';
  fullProject: Project;
}

/**
 * Filter projects that are active (not canceled or excluded)
 */
export function filterActiveProjects(projects: Project[]): Project[] {
  return projects.filter(p => {
    if (!p) return false;
    const isCanceledOrExcluded =
      (p.status as string) === 'Cancelado' ||
      (p.status as string) === 'Excluído' ||
      p.status === undefined;
    return !isCanceledOrExcluded;
  });
}

/**
 * Compute detailed overview items for active projects.
 * Accepts an optional reference date `now` (defaults to current date) for perfect unit testing.
 */
export function computeProjectItems(
  projects: Project[],
  users: User[],
  now: Date = new Date()
): ComputedProjectItem[] {
  const activeProjects = filterActiveProjects(projects);
  const items: ComputedProjectItem[] = [];

  activeProjects.forEach(project => {
    const subtasks = project.subtasks || [];

    if (subtasks.length === 0) {
      const createdDate = project.createdAt ? new Date(project.createdAt) : now;

      // 1. status_visao_geral
      let status_visao_geral: ComputedProjectItem['status_visao_geral'] = 'Planejamento';
      if (project.status === 'Backlog') {
        status_visao_geral = 'Backlog';
      } else if (project.status === 'Concluído') {
        status_visao_geral = 'Concluído';
      } else if (project.status === 'Planejamento') {
        status_visao_geral = 'Planejamento';
      } else {
        status_visao_geral = 'Em mapeamento';
      }

      // 2. tempo_total
      const diffTotalMs = now.getTime() - createdDate.getTime();
      const tempo_total = Math.max(0, Math.floor(diffTotalMs / (1000 * 60 * 60 * 24)));

      // 3. tempo_etapa
      const tempo_etapa = tempo_total;

      // 4. responsavel / setor
      const cardAnalyst = users.find(u => u.id === project.assignedTo);
      const cardAnalystName = cardAnalyst ? cardAnalyst.name : 'Não designado';
      const cardAnalystSector = cardAnalyst && cardAnalyst.sector ? cardAnalyst.sector : 'Geral';

      const responsavel_atual = cardAnalystName;
      let setor_atual = cardAnalystSector;
      if (status_visao_geral === 'Backlog') {
        setor_atual = 'Processos';
      }

      // 5. % progress
      let percentual_conclusao = 5;
      if (status_visao_geral === 'Backlog') percentual_conclusao = 0;
      else if (status_visao_geral === 'Em mapeamento') percentual_conclusao = 15;
      else if (status_visao_geral === 'Concluído') percentual_conclusao = 100;

      // 6. nivel_alerta
      let nivel_alerta: ComputedProjectItem['nivel_alerta'] = 'Normal';
      if (status_visao_geral === 'Backlog') {
        nivel_alerta = 'Normal';
      } else if (status_visao_geral === 'Concluído') {
        nivel_alerta = 'Finalizado';
      } else if (tempo_etapa > 30) {
        nivel_alerta = 'Muito crítico';
      } else if (tempo_etapa > 20) {
        nivel_alerta = 'Crítico';
      } else if (tempo_etapa > 15) {
        nivel_alerta = 'Parado';
      }

      items.push({
        id: project.id,
        projectId: project.id,
        name: project.name,
        subtask_name: '-',
        status_visao_geral,
        responsavel_atual,
        setor_atual,
        tempo_etapa,
        tempo_total,
        percentual_conclusao,
        nivel_alerta,
        fullProject: project,
      });
    } else {
      subtasks.forEach(subtask => {
        const cycles = [...(subtask.pdcaCycles || [])];
        cycles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const hasPdca = cycles.length > 0;
        const latestCycle = cycles[0] || null;

        let status_visao_geral: ComputedProjectItem['status_visao_geral'] = 'Planejamento';

        const isReportGenerated = latestCycle && (latestCycle.etapaAtual === 'REPORT' || latestCycle.status === 'Concluído');
        const isCardConcluido = project.status === 'Concluído' || subtask.status === 'Concluído';

        if (project.status === 'Backlog') {
          status_visao_geral = 'Backlog';
        } else if (isCardConcluido || isReportGenerated) {
          status_visao_geral = 'Concluído';
        } else if (project.status === 'Planejamento') {
          status_visao_geral = 'Planejamento';
        } else if (project.status === 'Em andamento' || project.status === 'Em melhoria') {
          if (!hasPdca) {
            status_visao_geral = 'Em mapeamento';
          } else if (latestCycle) {
            const etapa = latestCycle.etapaAtual;
            if (etapa === 'PLAN') {
              status_visao_geral = 'Análise do problema';
            } else if (etapa === 'DO') {
              status_visao_geral = 'Plano de ação';
            } else if (etapa === 'CHECK') {
              status_visao_geral = 'Período de teste';
            } else if (etapa === 'ACT') {
              status_visao_geral = 'Em implantação';
            } else if (etapa === 'REPORT') {
              status_visao_geral = 'Concluído';
            } else {
              status_visao_geral = 'Análise do problema';
            }
          } else {
            status_visao_geral = 'Em mapeamento';
          }
        }

        const createdDate = project.createdAt ? new Date(project.createdAt) : now;

        // 3.1 Tempo total do projeto
        const diffTotalMs = now.getTime() - createdDate.getTime();
        const tempo_total = Math.max(0, Math.floor(diffTotalMs / (1000 * 60 * 60 * 24)));

        // 3.2 Tempo na etapa atual (subtask-specific)
        const dates = [createdDate];
        if (subtask.mapping?.lastEdited) {
          dates.push(new Date(subtask.mapping.lastEdited));
        }
        if (subtask.pdcaCycles) {
          subtask.pdcaCycles.forEach(c => {
            dates.push(new Date(c.createdAt));
            if (c.plan?.actionPlan) {
              c.plan.actionPlan.forEach(ap => {
                if (ap.startDate) dates.push(new Date(ap.startDate));
                if (ap.endDate) dates.push(new Date(ap.endDate));
                if (ap.executionLogs) {
                  ap.executionLogs.forEach(el => {
                    if (el.timestamp) dates.push(new Date(el.timestamp));
                  });
                }
              });
            }
          });
        }
        dates.sort((a, b) => b.getTime() - a.getTime());

        const lastUpdateDate = dates[0] || createdDate;
        const diffEtapaMs = now.getTime() - lastUpdateDate.getTime();
        const tempo_etapa = Math.max(0, Math.floor(diffEtapaMs / (1000 * 60 * 60 * 24)));

        // 4. responsavel / setor
        const cardAnalyst = users.find(u => u.id === project.assignedTo);
        const cardAnalystName = cardAnalyst ? cardAnalyst.name : 'Não designado';
        const cardAnalystSector = cardAnalyst && cardAnalyst.sector ? cardAnalyst.sector : 'Geral';

        const subtaskAnalyst = users.find(u => u.id === subtask.responsibleId);
        const subtaskAnalystName = subtaskAnalyst ? subtaskAnalyst.name : cardAnalystName;
        const subtaskAnalystSector = subtaskAnalyst && subtaskAnalyst.sector ? subtaskAnalyst.sector : cardAnalystSector;

        let actionPlanWho = 'Não definido';
        let actionPlanWhere = 'Não definido';
        if (latestCycle && latestCycle.plan?.actionPlan && latestCycle.plan.actionPlan.length > 0) {
          const activeAction = latestCycle.plan.actionPlan.find(ap => ap.status === 'Em andamento') || latestCycle.plan.actionPlan[0];
          if (activeAction) {
            actionPlanWho = activeAction.who || 'Não definido';
            actionPlanWhere = activeAction.where || activeAction.sector || 'Não definido';
          }
        }

        let responsavel_atual = cardAnalystName;
        let setor_atual = cardAnalystSector;

        if (status_visao_geral === 'Backlog') {
          responsavel_atual = 'Não designado';
          setor_atual = 'Processos';
        } else if (status_visao_geral === 'Planejamento' || status_visao_geral === 'Em mapeamento') {
          responsavel_atual = cardAnalystName;
          setor_atual = cardAnalystSector;
        } else if (status_visao_geral === 'Análise do problema') {
          responsavel_atual = subtaskAnalystName;
          setor_atual = subtaskAnalystSector;
        } else if (status_visao_geral === 'Plano de ação') {
          responsavel_atual = actionPlanWho;
          setor_atual = actionPlanWhere;
        } else if (['Período de teste', 'Em implantação', 'Concluído'].includes(status_visao_geral)) {
          responsavel_atual = subtaskAnalystName;
          setor_atual = 'Processos';
        }

        let percentual_conclusao = 5;
        switch (status_visao_geral) {
          case 'Backlog': percentual_conclusao = 0; break;
          case 'Planejamento': percentual_conclusao = 5; break;
          case 'Em mapeamento': percentual_conclusao = 15; break;
          case 'Análise do problema': percentual_conclusao = 30; break;
          case 'Plano de ação': percentual_conclusao = 50; break;
          case 'Período de teste': percentual_conclusao = 75; break;
          case 'Em implantação': percentual_conclusao = 90; break;
          case 'Concluído': percentual_conclusao = 100; break;
        }

        let nivel_alerta: ComputedProjectItem['nivel_alerta'] = 'Normal';
        if (status_visao_geral === 'Backlog') {
          nivel_alerta = 'Normal';
        } else if (status_visao_geral === 'Concluído') {
          nivel_alerta = 'Finalizado';
        } else if (tempo_etapa > 30) {
          nivel_alerta = 'Muito crítico';
        } else if (tempo_etapa > 20) {
          nivel_alerta = 'Crítico';
        } else if (tempo_etapa > 15) {
          nivel_alerta = 'Parado';
        }

        items.push({
          id: `${project.id}-${subtask.id}`,
          projectId: project.id,
          subtaskId: subtask.id,
          name: project.name,
          subtask_name: subtask.title,
          status_visao_geral,
          responsavel_atual,
          setor_atual,
          tempo_etapa,
          tempo_total,
          percentual_conclusao,
          nivel_alerta,
          fullProject: project,
        });
      });
    }
  });

  return items;
}

/**
 * Filter computed items based on search query, selected statuses, selected responsibles, and selected sectors.
 */
export function filterComputedData(
  items: ComputedProjectItem[],
  searchQuery: string,
  selectedStatuses: string[],
  selectedResponsibles: string[],
  selectedSectors: string[]
): ComputedProjectItem[] {
  return items.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.responsavel_atual.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.setor_atual.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(item.status_visao_geral);
    const matchResponsible = selectedResponsibles.length === 0 || selectedResponsibles.includes(item.responsavel_atual);
    const matchSector = selectedSectors.length === 0 || selectedSectors.includes(item.setor_atual);

    return matchSearch && matchStatus && matchResponsible && matchSector;
  });
}

/**
 * Sort computed items based on field and direction.
 */
export function sortComputedData(
  items: ComputedProjectItem[],
  sortField: 'tempo_etapa' | 'tempo_total' | 'nivel_alerta',
  sortDirection: 'asc' | 'desc'
): ComputedProjectItem[] {
  const data = [...items];
  data.sort((a, b) => {
    let valA: number = 0;
    let valB: number = 0;

    if (sortField === 'tempo_etapa') {
      valA = a.tempo_etapa;
      valB = b.tempo_etapa;
    } else if (sortField === 'tempo_total') {
      valA = a.tempo_total;
      valB = b.tempo_total;
    } else if (sortField === 'nivel_alerta') {
      const severityMap = { 'Muito crítico': 4, 'Crítico': 3, 'Parado': 2, 'Normal': 1, 'Finalizado': 0 };
      valA = severityMap[a.nivel_alerta];
      valB = severityMap[b.nivel_alerta];
    }

    if (valA !== valB) {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
    return a.name.localeCompare(b.name);
  });
  return data;
}

