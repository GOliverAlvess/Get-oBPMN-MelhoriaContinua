import { Project, ProjectStatus } from '../types';

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

  const allCompleted = subtasks.every(s => s.status === 'Concluído');
  if (allCompleted) return 'Concluído';

  const anyInProgress = subtasks.some(s => s.status === 'Em andamento' || s.pdcaCycles.length > 0);
  if (anyInProgress) return 'Em melhoria';

  return 'Em andamento';
};

export const calculateProjectProgress = (project: Project) => {
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
    return scopeProgress;
  }

  const weightPerSubtask = 95 / subtasks.length;
  let totalSubtasksProgress = 0;

  subtasks.forEach(subtask => {
    let stagesCompleted = 0;
    const mapping = subtask.mapping;
    const pdca = subtask.pdcaCycles || [];

    // Estágio 1: Início do mapeamento
    if (mapping && (mapping.nodes?.length > 0 || mapping.xml)) {
      stagesCompleted++;
    }

    // Estágio 2: Mapeamento concluído
    // Definimos como concluído se o usuário marcou o status ou se o XML existe e tem nodes substanciais
    const isMappingFinished = subtask.status !== 'Pendente' && mapping?.xml;
    if (isMappingFinished) {
      stagesCompleted++;
    }

    // Verificamos se existem problemas identificados que exigem PDCA
    const problemSteps = Object.values(mapping?.customData || {}).filter(data => data?.isProblemStep);
    const requiresPDCA = problemSteps.length > 0;

    if (!requiresPDCA) {
      // Se não há problemas, os estágios de PDCA são concedidos automaticamente ao concluir o mapeamento
      if (isMappingFinished) {
        stagesCompleted += 4;
      }
    } else {
      // Estágio 3: PDCA - PLAN preenchido (Pelo menos um ciclo com plano de ação)
      const hasPlan = pdca.some(c => c.plan.actionPlan.length > 0);
      if (hasPlan) stagesCompleted++;

      // Estágio 4: PDCA - DO preenchido (Pelo menos uma ação iniciada ou concluída)
      const hasDo = pdca.some(c => c.plan.actionPlan.some(a => a.status === 'Concluído' || a.status === 'Em andamento'));
      if (hasDo) stagesCompleted++;

      // Estágio 5: PDCA - CHECK preenchido (Pelo menos uma ação com status de 'worked' / funcionou)
      const hasCheck = pdca.some(c => c.plan.actionPlan.some(a => a.worked && a.worked !== undefined));
      if (hasCheck) stagesCompleted++;

      // Estágio 6: PDCA - ACT concluído (Ciclo finalizado ou ação com status final)
      const hasAct = pdca.some(c => c.status === 'Concluído' || c.plan.actionPlan.some(a => a.finalProblemStatus));
      if (hasAct) stagesCompleted++;
    }

    totalSubtasksProgress += (stagesCompleted / 6) * weightPerSubtask;
  });

  return Math.min(Math.round(scopeProgress + totalSubtasksProgress), 100);
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
