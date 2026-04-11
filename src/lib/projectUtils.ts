import { Project, ProjectStatus } from '../types';

export const calculateProjectStatus = (project: Project): ProjectStatus => {
  const problemTasks = Object.values(project.mapping.customData || {}).filter(data => data.isProblemStep);
  const totalProblems = problemTasks.length;
  
  // 4. Concluído: Todos os problemas (tasks com “Etapa Problema”) tiverem: PDCA com status final = Resolvido
  if (totalProblems > 0) {
    const resolvedProblems = project.pdcaCycles.filter(cycle => {
      const isConcluded = cycle.status === 'Concluído';
      const allActionsResolved = cycle.plan.actionPlan.length > 0 && 
                                cycle.plan.actionPlan.every(action => action.finalProblemStatus === 'Resolvido');
      return isConcluded && allActionsResolved;
    }).length;

    if (resolvedProblems === totalProblems) {
      return 'Concluído';
    }
  }

  // 3. Em melhoria: Existe pelo menos 1 PDCA iniciado E ainda NÃO finalizado
  if (project.pdcaCycles.length > 0) {
    return 'Em melhoria';
  }

  // 2. Em andamento: Escopo preenchido OR Mapeamento iniciado
  const isScopeFilled = 
    project.scope.problemDescription.trim() !== '' && 
    project.scope.measurableObjective.trim() !== '' &&
    project.scope.responsible.trim() !== '';
  
  const isMappingStarted = project.mapping.nodes && project.mapping.nodes.length > 0;

  if (isScopeFilled || isMappingStarted) {
    return 'Em andamento';
  }

  // 1. Planejamento (Default)
  return 'Planejamento';
};

export const calculateProjectProgress = (project: Project) => {
  const problemTasks = Object.values(project.mapping.customData || {}).filter(data => data.isProblemStep);
  const totalProblems = problemTasks.length;
  
  if (totalProblems === 0) {
    // Fallback: Check if mapping is done or scope is filled
    let progress = 0;
    if (project.scope.problemDescription) progress += 10;
    if (project.mapping.nodes && project.mapping.nodes.length > 0) progress += 20;
    return Math.min(progress, 100);
  }

  const resolvedProblems = project.pdcaCycles.filter(cycle => {
    const isConcluded = cycle.status === 'Concluído';
    const allActionsResolved = cycle.plan.actionPlan.length > 0 && 
                              cycle.plan.actionPlan.every(action => action.finalProblemStatus === 'Resolvido');
    return isConcluded && allActionsResolved;
  }).length;

  return Math.round((resolvedProblems / totalProblems) * 100);
};
