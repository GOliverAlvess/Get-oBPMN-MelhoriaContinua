import { InnovationProject, InnovationStatus } from '../types';

export function calculateInnovationStatusAndProgress(project: InnovationProject): { status: InnovationStatus; progress: number } {
  const hasResponsible = !!project.responsibleId;
  const hasScope = !!(project.technicalScope?.whatWillBeDone && project.technicalScope.whatWillBeDone.trim().length > 0);
  const actions = project.developmentActions || [];
  const hasActions = actions.length > 0;
  const allActionsCompleted = hasActions && actions.every(a => a.status === 'Concluído');
  const hasTestAction = actions.some(a => a.type === 'Testes');
  const hasProduction = !!(
    project.production?.document?.name || 
    project.production?.technicalDeliverable?.name || 
    (project.production?.externalLinks?.repositories && project.production.externalLinks.repositories.length > 0) ||
    (project.production?.externalLinks?.externalTools && project.production.externalLinks.externalTools.length > 0)
  );

  // If already concluded, keep it concluded with 100% progress
  if (project.status === 'concluído') {
    return { status: 'concluído', progress: 100 };
  }

  let status: InnovationStatus = 'backlog';
  let progress = 0;

  // PRIORITY RULES for Status (concluído removed from automatic logic)
  if (hasProduction || allActionsCompleted) {
    status = 'teste'; // Use 'teste' as the final stage before manual completion
  } else if (hasActions && actions.some(a => a.status !== 'Concluído')) {
    status = 'desenvolvimento';
  } else if (hasScope && !hasActions) {
    status = 'planejamento';
  } else if (hasResponsible && !hasScope) {
    status = 'análise';
  } else if (!hasResponsible) {
    status = 'backlog';
  }

  // PROGRESS RULES
  if (!hasResponsible) {
    progress = 0;
  } else if (hasResponsible && !hasScope) {
    progress = 25;
  } else if (hasScope && !hasActions) {
    progress = 50;
  } else if (hasActions && !allActionsCompleted) {
    progress = 75;
  } else if (allActionsCompleted && !hasProduction) {
    progress = 85;
  } else if (allActionsCompleted && hasProduction) {
    progress = 95; // 95% is the max progress before manual completion
  }

  return { status, progress };
}
