export type ProjectStatus = 'Planejamento' | 'Em andamento' | 'Em melhoria' | 'Concluído';
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
  presentationLink?: string;
  problemDescription: string;
  measurableObjective: string;
  involvedSectors: InvolvedSector[];
  toolsUsed: ToolUsed[];
  startDate: string;
  forecastCompletion: string;
  ods?: string;
  esgEnvironmental?: string;
  esgSocial?: string;
  esgGovernance?: string;
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
  priority?: 'Baixa' | 'Média' | 'Alta';
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

export interface RootCauseEntry {
  id: string;
  text: string;
}

export interface IshikawaCategory {
  id: string;
  name: 'Método' | 'Máquina' | 'Mão de obra' | 'Material' | 'Meio ambiente' | 'Medida';
  description: string;
  entries: RootCauseEntry[];
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  status: 'Pendente' | 'Em andamento' | 'Concluído';
  responsible: string;
  sector?: string;
  observation: string;
  type: 'update' | 'completion' | 'start';
}

export interface ActionPlanItem {
  id: string;
  // PLAN (5W2H)
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  sector?: string; // New field
  how: string;
  howMuch: string;
  
  // DO
  status: 'Pendente' | 'Em andamento' | 'Concluído';
  startDate?: string;
  endDate?: string;
  observations?: string;
  executionLogs: ExecutionLog[];
  
  // CHECK
  monitoringMode?: 'Dias' | 'Semanas' | 'Meses';
  monitoringPeriod?: number;
  monitoringTool?: string; // New field
  worked?: 'Sim' | 'Não' | 'Parcial';
  evidence?: string;
  gainImpact?: number; // New field
  
  // ACT
  finalProblemStatus?: 'Resolvido' | 'Não resolvido';
  finalAction?: 'Padronizar processo' | 'Fazer nova análise';
  standardizationModels?: ('POP' | 'ITO' | 'Painel de controle')[];
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
    rootCauseAnalysis: {
      type: '5whys' | 'list' | 'ishikawa';
      entries: RootCauseEntry[];
      ishikawa?: IshikawaCategory[];
      priorityCauses?: string[];
      identifiedRootCause?: string;
    };
    impact: {
      description: string;
      value: number;
      goal: number; // %
    };
    actionPlan: ActionPlanItem[];
  };
}

export interface Subtask {
  id: string;
  title: string;
  priority: ProjectPriority;
  status: 'Pendente' | 'Em andamento' | 'Concluído';
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

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  progress: number;
  status: ProjectStatus;
  priority?: ProjectPriority;
  assignedTo: string; // User ID
  scope: ProjectScope;
  subtasks: Subtask[];
}

export interface User {
  id: string;
  name: string;
  email?: string;
  sector?: string;
  avatar?: string;
}

export interface OperationalAction {
  id: string;
  projectId: string;
  projectName: string;
  subtaskId: string;
  subtaskTitle: string;
  action: string;
  responsibleId: string;
  responsibleName: string;
  priority: ProjectPriority;
  status: 'Pendente' | 'Em andamento' | 'Concluído';
  forecastDate: string;
  completionDate?: string;
  feedback?: string;
  createdAt: string;
}
