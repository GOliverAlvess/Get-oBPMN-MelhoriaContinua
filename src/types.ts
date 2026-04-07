export type ProjectStatus = 'Planejamento' | 'Em Execução' | 'Suspenso' | 'Concluído';
export type ProjectPriority = 'Baixa' | 'Média' | 'Alta';

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
  | 'task' 
  | 'startEvent' 
  | 'endEvent' 
  | 'gateway' 
  | 'subprocess'
  | 'document' 
  | 'data-storage'
  | 'pool'
  | 'lane';

export interface SavedColor {
  id: string;
  name: string;
  backgroundColor: string;
  borderColor: string;
}

export interface BPMNTaskData {
  label: string;
  description?: string;
  responsibleRole: string;
  timeInMinutes: number;
  isProblemStep: boolean;
  backgroundColor: string;
  borderColor: string;
  shapeType: BPMNShapeType;
  width?: number;
  height?: number;
  onResize?: (width: number, height: number) => void;
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
  who: string;
  when: string;
  status: 'Pendente' | 'Em andamento' | 'Concluído';
  executionDate?: string;
  observations?: string;
}

export type PDCAStatus = 'Não iniciado' | 'Em planejamento' | 'Em execução' | 'Em validação' | 'Concluído';
export type PDCAPriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export interface PDCACycle {
  id: string;
  taskId: string; // Link to BPMN element
  title: string;
  createdAt: string;
  status: PDCAStatus;
  plan: {
    problemDescription: string;
    impact: string;
    priority: PDCAPriority;
    goal: string;
    fiveWhys: FiveWhys;
    actionPlan: ActionPlanItem[];
  };
  do: {
    observations: string;
  };
  check: {
    resultObtained: string;
    worked: 'Sim' | 'Não' | 'Parcial';
    evidence: string;
  };
  act: {
    finalAction: string;
    adjustments: string;
    finalStatus: 'Resolvido' | 'Em nova análise';
    standardization?: string;
  };
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  progress: number;
  status: ProjectStatus;
  priority?: ProjectPriority;
  assignedTo: string; // User ID
  scope: ProjectScope;
  mapping: {
    xml?: string;
    customData?: Record<string, Partial<BPMNTaskData>>;
    nodes: any[];
    edges: any[];
    orientation: 'horizontal' | 'vertical';
    lastEdited: string;
    savedColors: SavedColor[];
  };
  pdcaCycles: PDCACycle[];
}

export interface User {
  id: string;
  name: string;
  email?: string;
  sector?: string;
  avatar?: string;
}
