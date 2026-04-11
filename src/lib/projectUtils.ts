import { Project, ProjectStatus } from '../types';

export const calculateProjectStatus = (project: Project): ProjectStatus => {
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
  const subtasks = project.subtasks || [];
  if (subtasks.length === 0) {
    let progress = 0;
    if (project.scope.problemDescription) progress += 5;
    if (project.scope.measurableObjective) progress += 5;
    return Math.min(progress, 100);
  }

  const completedSubtasks = subtasks.filter(subtask => {
    // A subtask is completed if its status is 'Concluído'
    // We also verify if all its internal PDCA cycles are resolved
    const problemTasks = Object.entries(subtask.mapping.customData || {})
      .filter(([_, data]) => data.isProblemStep);
    
    if (problemTasks.length === 0) {
      return subtask.status === 'Concluído';
    }

    const cyclesByTask = subtask.pdcaCycles.reduce((acc, cycle) => {
      if (!acc[cycle.taskId]) acc[cycle.taskId] = [];
      acc[cycle.taskId].push(cycle);
      return acc;
    }, {} as Record<string, any[]>);

    const allProblemsResolved = problemTasks.every(([taskId, _]) => {
      const taskCycles = cyclesByTask[taskId] || [];
      return taskCycles.length > 0 && taskCycles.every(cycle => {
        const isConcluded = cycle.status === 'Concluído';
        const allActionsResolved = cycle.plan.actionPlan.length > 0 && 
                                  cycle.plan.actionPlan.every(action => action.finalProblemStatus === 'Resolvido');
        return isConcluded && allActionsResolved;
      });
    });

    return allProblemsResolved && subtask.status === 'Concluído';
  }).length;

  return Math.min(Math.round((completedSubtasks / subtasks.length) * 100), 100);
};
