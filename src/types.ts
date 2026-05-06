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

export type ActionPlanType = 'Processual' | 'Operacional' | 'Inovação';

export interface ActionPlanItem {
  id: string;
  // PLAN (5W2H)
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  sector?: string; 
  how: string;
  howMuch: string;
  actionType?: ActionPlanType; // New field
  innovationProjectId?: string; // New field
  
  // DO
  status: 'Pendente' | 'Em andamento' | 'Concluído' | 'Cancelado';
  ativo?: boolean;
  startDate?: string;
  endDate?: string;
  observations?: string;
  executionLogs: ExecutionLog[];
  currentPhase?: 'DO' | 'CHECK' | 'ACT' | 'REPORT';
  
  // CHECK
  monitoringMode?: 'Dias' | 'Semanas' | 'Meses';
  monitoringPeriod?: number;
  monitoringTool?: string; // New field
  worked?: 'Sim' | 'Não' | 'Parcial';
  failureReason?: string; // Motivo da falha ou resultado parcial
  evidence?: string;
  gainImpact?: number; // New field
  
  // ACT
  finalProblemStatus?: 'Resolvido' | 'Não resolvido';
  finalAction?: 'Padronizar processo' | 'Fazer nova análise';
  standardizationModels?: ('POP' | 'ITO' | 'Painel de controle')[];
  innovationLogs?: InnovationLog[];
}

export interface InnovationLog {
  id: string;
  date: string;
  previousStatus?: InnovationStatus | '';
  newStatus?: InnovationStatus;
  action?: string;
  detalhes?: string;
  cardTitulo?: string;
  responsible: string;
  origin: 'inovacao';
}

export type PDCAStatus = 'Ativo' | 'Concluído';
export type PDCAPriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export interface PDCACycle {
  id: string;
  taskId: string; // Link to BPMN element
  title: string;
  createdAt: string;
  status: PDCAStatus;
  etapaAtual?: 'PLAN' | 'DO' | 'CHECK' | 'ACT' | 'REPORT';
  progress?: number;
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
  responsibleId?: string;
  startDate?: string;
  endDate?: string;
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
  progress?: number;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  fileId: string;
  fileUrl: string;
  uploadedAt: string;
  size?: number;
  mimeType?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  progress: number;
  status: ProjectStatus;
  priority?: ProjectPriority;
  assignedTo: string; // User ID
  scope: ProjectScope;
  subtasks: Subtask[];
  driveFolderId?: string;
}

export type UserProfile = 'Usuário Analista' | 'Usuário Master';

export interface User {
  id: string;
  name: string;
  email?: string;
  sector?: string;
  avatar?: string;
  profile?: UserProfile;
  module?: 'processos' | 'inovacao';
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

export interface ReportLog {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  reportType: 'PDCA' | 'Histórico de Ações' | 'Relatório Completo';
}

export type InnovationStatus = 'backlog' | 'análise' | 'planejamento' | 'desenvolvimento' | 'teste' | 'concluído';
export type InnovationComplexity = 'Baixa' | 'Média' | 'Alta' | 'Muito Alta';
export type InnovationSolutionType = 'RPA' | 'Sistema' | 'Integração' | 'BI';

export interface InnovationTeamLogEntry {
  id: string;
  date: string;
  type: 'Decisão' | 'Hipótese' | 'Teste' | 'Aprendizado' | 'Risco' | 'Ajuste';
  content: string;
  authorId: string;
}

export type InnovationActionType = 'Alinhamento' | 'Ajustes' | 'Decisão' | 'Testes' | 'Implementação';

export interface InnovationAction {
  id: string;
  type: InnovationActionType;
  priority: 'Baixa' | 'Média' | 'Alta';
  description: string;
  responsibleId: string;
  deadline: string;
  status: 'Pendente' | 'Em andamento' | 'Concluído';
  responseDescription?: string;
  completionDate?: string;
}

export interface InnovationArtifact {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
  addedAt: string;
}

export interface InnovationProject {
  id: string;
  projectId: string; 
  pdcaId: string;
  actionId: string;
  title: string;
  description?: string;
  type: InnovationSolutionType | '';
  status: InnovationStatus;
  complexity: InnovationComplexity | '';
  responsibleId: string;
  responsibleName?: string;
  participantIds?: string[];
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
  projectName: string;
  processName: string;
  subtaskTitle?: string;
  priority?: ProjectPriority;
  deadline?: string;
  
  // New fields for detail screen
  technicalScope?: {
    whatWillBeDone: string;
    technologies: string[];
    assumptions: string;
    restrictions: string;
  };
  developmentActions?: InnovationAction[];
  artifacts?: InnovationArtifact[];
  production?: {
    document?: { name: string; url: string };
    technicalDeliverable?: { name: string; type: string; url: string };
    externalLinks?: {
      repositories: { id: string; name: string; url: string }[];
      externalTools: { id: string; name: string; url: string }[];
    };
  };
  progress?: number;
}

export interface InnovationConfig {
  technologies: string[];
}
