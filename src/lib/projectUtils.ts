import { Project, ProjectStatus } from '../types';

export const isCardFullyComplete = (project: Project): boolean => {
  const subtasks = project.subtasks || [];
  if (subtasks.length === 0) {
    return project.status === 'Concluído';
  }
  return subtasks.every(subtask => {
    return subtask.status === 'Concluído' && isSubtaskPDCAComplete(subtask);
  });
};

export const calculateProjectStatus = (project: Project): ProjectStatus => {
  if (project.status === 'Backlog' || project.assignedTo === 'backlog') {
    return 'Backlog';
  }
  const subtasks = project.subtasks || [];
  if (subtasks.length === 0) {
    const isScopeFilled = 
      project.scope.problemDescription.trim() !== '' && 
      project.scope.measurableObjective.trim() !== '' &&
      project.scope.responsible.trim() !== '';
    return isScopeFilled ? 'Em andamento' : 'Planejamento';
  }

  if (isCardFullyComplete(project)) return 'Concluído';

  const anyInProgress = subtasks.some(s => s.status === 'Em andamento' || s.pdcaCycles.length > 0);
  if (anyInProgress) return 'Em melhoria';

  return 'Em andamento';
};

export const isSubtaskPDCAComplete = (subtask: any): boolean => {
  const pdca = subtask.pdcaCycles || [];
  const mapping = subtask.mapping;
  const problemSteps = Object.values(mapping?.customData || {}).filter((data: any) => data?.isProblemStep);
  const requiresPDCA = problemSteps.length > 0;

  if (!requiresPDCA) {
    return true; // Sem problemas identificados, não exige PDCA obrigatoriamente
  }

  if (pdca.length === 0) {
    return false; // Exige PDCA mas não possui ciclos
  }

  const hasPlan = pdca.some((c: any) => c.plan && c.plan.actionPlan && c.plan.actionPlan.length > 0);
  const hasDo = pdca.some((c: any) => c.plan && c.plan.actionPlan && c.plan.actionPlan.some((a: any) => a.status === 'Concluído' || a.status === 'Em andamento'));
  const hasCheck = pdca.some((c: any) => c.plan && c.plan.actionPlan && c.plan.actionPlan.some((a: any) => a.worked !== undefined && a.worked !== null));
  const hasAct = pdca.some((c: any) => c.status === 'Concluído' || c.etapaAtual === 'REPORT' || (c.plan && c.plan.actionPlan && c.plan.actionPlan.some((a: any) => a.finalProblemStatus)));

  return !!(hasPlan && hasDo && hasCheck && hasAct);
};

export const calculateProjectProgress = (project: Project): number => {
  // 1. Validação explícita de conclusão total (Forçar 100% se tudo estiver completo)
  if (isCardFullyComplete(project)) {
    console.log('[calculateProjectProgress] Card totalmente concluído! Retornando 100%');
    return 100;
  }

  // 1. ESCOPO (5%)
  // Só considera completo se os campos principais estiverem preenchidos
  const scope = project.scope;
  const isScopeComplete = 
    scope.title?.trim() !== '' &&
    scope.responsible?.trim() !== '' &&
    scope.problemDescription?.trim() !== '' &&
    scope.measurableObjective?.trim() !== '' &&
    scope.startDate?.trim() !== '' &&
    scope.forecastCompletion?.trim() !== '' &&
    (scope.involvedSectors?.length || 0) > 0 &&
    (scope.toolsUsed?.length || 0) > 0;

  const scopeProgress = isScopeComplete ? 5 : 0;

  // 2. SUBTAREFAS (95%)
  const subtasks = project.subtasks || [];
  if (subtasks.length === 0) {
    if (project.status === 'Concluído') return 100;
    if (project.status === 'Backlog') return 0;
    if (project.status === 'Planejamento') return 5;
    return isScopeComplete ? 15 : 5;
  }

  const total = subtasks.length;
  let progressSum = 0;
  let hasAnyIncomplete = false;

  subtasks.forEach(subtask => {
    const isPDCAComplete = isSubtaskPDCAComplete(subtask);
    const isSubtaskDone = subtask.status === 'Concluído';

    if (isSubtaskDone && isPDCAComplete) {
      progressSum += 1.0;
    } else {
      hasAnyIncomplete = true;
      if (subtask.status === 'Em andamento' || (isSubtaskDone && !isPDCAComplete)) {
        progressSum += 0.5; // Progresso parcial
      } else {
        progressSum += 0; // Não iniciada
      }
    }
  });

  // Log de debug temporário solicitado pelo usuário
  console.log('[calculateProjectProgress] Debug:', {
    projectId: project.id,
    projectName: project.name,
    total,
    progressSum,
    result: (progressSum / total) * 100,
    hasAnyIncomplete
  });

  // Cálculo de progresso parcial evitando arredondamentos prematuros
  const subtasksProgressRatio = progressSum / total;
  let totalProgress = Math.round(scopeProgress + (subtasksProgressRatio * 95));

  // Regra obrigatória: Se houver QUALQUER subtarefa incompleta ou PDCA incompleto, o card não pode ser 100%
  if (hasAnyIncomplete && totalProgress >= 100) {
    totalProgress = 99;
  }

  return Math.min(Math.max(totalProgress, 0), 100);
};

export const getCardProgress = (project: Project): number => {
  return calculateProjectProgress(project);
};

export const hasPendingSubtasksOrPDCA = (project: Project): boolean => {
  const subtasks = project.subtasks || [];
  if (subtasks.length === 0) return false;

  return subtasks.some(subtask => {
    const isPDCAComplete = isSubtaskPDCAComplete(subtask);
    const isSubtaskDone = subtask.status === 'Concluído';
    return !isSubtaskDone || !isPDCAComplete;
  });
};

export const calculateSubtaskStatus = (subtask: any): any => {
  const mapping = subtask.mapping;
  const pdca = subtask.pdcaCycles || [];
  
  const hasMappingInteraction = mapping && (
    (mapping.nodes && mapping.nodes.length > 0) || 
    mapping.xml || 
    (mapping.customData && Object.keys(mapping.customData).length > 0)
  );
  
  const allPDCACompleted = pdca.length > 0 && pdca.every((cycle: any) => cycle.status === 'Concluído');

  if (allPDCACompleted) return 'Concluído';
  if (hasMappingInteraction) return 'Em andamento';
  return 'Pendente';
};
