import { Project } from '../types';

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
