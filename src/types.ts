export type ProjectStatus = 'Planejamento' | 'Em Execução' | 'Suspenso' | 'Concluído';

export interface InvolvedSector {
  id: string;
  name: string;
}

export interface ToolUsed {
  id: string;
  name: string;
}

export interface ProjectScope {
  title: string;
  responsible: string;
  problemDescription: string;
  measurableObjective: string;
  involvedSectors: InvolvedSector[];
  toolsUsed: ToolUsed[];
  startDate: string;
  forecastCompletion: string;
  financial: {
    currentImpact: {
      value: number;
      type: 'fixo' | 'continuo';
      period: 'mensal' | 'anual';
    };
    gainProjection: {
      value: number;
      type: 'fixo' | 'continuo';
      period: 'mensal' | 'anual';
    };
  };
}

export type BPMNShapeType = 
  | 'rectangle' 
  | 'rounded-rectangle' 
  | 'circle' 
  | 'diamond' 
  | 'hexagon' 
  | 'triangle' 
  | 'cylinder' 
  | 'cloud' 
  | 'document' 
  | 'data-storage';

export interface SavedColor {
  id: string;
  name: string;
  backgroundColor: string;
  borderColor: string;
}

export interface BPMNTaskData {
  label: string;
  responsibleRole: string;
  timeInMinutes: number;
  isProblemStep: boolean;
  backgroundColor: string;
  borderColor: string;
  shapeType: BPMNShapeType;
}

export interface ParetoItem {
  id: string;
  category: string;
  quantity: number;
}

export interface FiveWhys {
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
}

export interface ActionPlanItem {
  id: string;
  what: string;
  why: string;
  where: string;
  who: string;
  when: string;
  how: string;
  cost: number;
}

export interface PDCACycle {
  id: string;
  title: string;
  createdAt: string;
  plan: {
    problemIdentification: string;
    paretoData: {
      items: ParetoItem[];
      period: string;
      area: string;
    };
    objective: string;
    meta: string;
    fiveWhys: FiveWhys;
    actionPlan: ActionPlanItem[];
  };
  do: {
    training: string;
    execution: string;
    pilotTest: string;
    actionStatus: string;
  };
  check: {
    indicators: string;
    resultComparison: string;
    deviationEvaluation: string;
    goalMet: boolean;
  };
  act: {
    standardization: string;
    documentation: string;
    correctiveAction: string;
    lessonsLearned: string;
  };
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  progress: number;
  status: ProjectStatus;
  assignedTo: string; // User ID or Name
  scope: ProjectScope;
  mapping: {
    nodes: any[];
    edges: any[];
    orientation: 'horizontal' | 'vertical';
    lastEdited: string;
  };
  pdcaCycles: PDCACycle[];
  savedColors: SavedColor[];
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
}
