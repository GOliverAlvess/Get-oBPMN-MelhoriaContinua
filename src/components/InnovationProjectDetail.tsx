import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Settings, 
  Target,
  Clock, 
  GitBranch, 
  Briefcase, 
  RefreshCw, 
  User as UserIcon,
  Layers,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  FileCode,
  Link as LinkIcon,
  Paperclip,
  Plus,
  Edit,
  Trash2,
  Save,
  MessageSquare,
  Info,
  ExternalLink,
  Github,
  Globe,
  Users,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { 
  Project, 
  User, 
  InnovationProject, 
  InnovationStatus, 
  InnovationComplexity,
  InnovationSolutionType,
  ActionPlanItem,
  InnovationArtifact,
  InnovationConfig,
  InnovationAction,
  InnovationActionType
} from '../types';
import { cn } from '../lib/utils';
import { auth } from '../firebase';

interface InnovationProjectDetailProps {
  project: InnovationProject;
  projects: Project[];
  users: User[];
  onBack: () => void;
  onUpdate: (updates: Partial<InnovationProject>) => Promise<void>;
  onNavigateToMapping?: (projectId: string, subtaskId: string) => void;
  innovationConfig: InnovationConfig;
}

export default function InnovationProjectDetail({ 
  project, 
  projects, 
  users, 
  onBack, 
  onUpdate,
  onNavigateToMapping,
  innovationConfig
}: InnovationProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'team' | 'production'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const currentUser = auth.currentUser;

  const statusLabels: Record<InnovationStatus, string> = {
    'backlog': 'Backlog',
    'análise': 'Análise',
    'planejamento': 'Em planejamento',
    'desenvolvimento': 'Em desenvolvimento',
    'teste': 'Em teste',
    'concluído': 'Concluído'
  };

  const statusColors: Record<InnovationStatus, string> = {
    'backlog': 'bg-slate-500',
    'análise': 'bg-amber-500',
    'planejamento': 'bg-blue-500',
    'desenvolvimento': 'bg-indigo-500',
    'teste': 'bg-purple-500',
    'concluído': 'bg-emerald-500'
  };

  // Get linked PDCA data
  const { pdcaAction, pdcaCycle, pdcaProject, pdcaSubtask } = useMemo(() => {
    const pdcaProject = projects.find(p => p.id === project.projectId);
    let pdcaCycle = null;
    let pdcaAction = null;
    let pdcaSubtask = null;

    if (pdcaProject) {
      for (const sub of pdcaProject.subtasks) {
        for (const cycle of sub.pdcaCycles) {
          if (cycle.id === project.pdcaId) {
            pdcaCycle = cycle;
            pdcaAction = cycle.plan.actionPlan.find(a => a.id === project.actionId);
            pdcaSubtask = sub;
            break;
          }
        }
        if (pdcaCycle) break;
      }
    }

    return { pdcaAction, pdcaCycle, pdcaProject, pdcaSubtask };
  }, [project, projects]);

  const handleSaveScope = async (scope: NonNullable<InnovationProject['technicalScope']>) => {
    setIsSaving(true);
    await onUpdate({ technicalScope: scope });
    setIsSaving(false);
  };

  const handleAddAction = async (action: Omit<InnovationAction, 'id' | 'status'>) => {
    const newAction: InnovationAction = {
      ...action,
      id: uuidv4(),
      status: 'Pendente'
    };
    await onUpdate({ developmentActions: [newAction, ...(project.developmentActions || [])] });
  };

  const handleUpdateAction = async (actionId: string, updates: Partial<InnovationAction>) => {
    const newActions = (project.developmentActions || []).map(a => 
      a.id === actionId ? { ...a, ...updates } : a
    );
    await onUpdate({ developmentActions: newActions });
  };

  const handleDeleteAction = async (actionId: string) => {
    const newActions = (project.developmentActions || []).filter(a => a.id !== actionId);
    await onUpdate({ developmentActions: newActions });
  };


  const complexityStyles: Record<string, string> = {
    'Baixa': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Média': 'bg-amber-100 text-amber-700 border-amber-200',
    'Alta': 'bg-rose-100 text-rose-700 border-rose-200',
    'Muito Alta': 'bg-purple-100 text-purple-700 border-purple-200'
  };

  return (
    <div className="flex flex-col gap-8 min-h-screen pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm group"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              <span>Gestão de Inovações</span>
              <ChevronRight size={10} />
              <span className="text-indigo-600">{project.projectName}</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{project.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn(
            "px-4 py-2 rounded-xl border font-bold text-sm",
            complexityStyles[project.complexity as string] || 'bg-slate-50 text-slate-500 border-slate-200'
          )}>
            Complexidade: {project.complexity || 'N/A'}
          </div>
          <div className={cn(
            "px-6 py-2 text-white rounded-xl shadow-lg font-black text-xs uppercase tracking-widest",
            statusColors[project.status] || 'bg-indigo-600 shadow-indigo-100'
          )}>
            {statusLabels[project.status] || project.status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-[1.5rem] border border-slate-100 shadow-sm self-start">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Info size={16} />} label="Resumo & Contexto" />
        <TabButton active={activeTab === 'technical'} onClick={() => setActiveTab('technical')} icon={<FileCode size={16} />} label="Escopo Técnico" />
        <TabButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<Layers size={16} />} label="Desenvolvimento" />
        <TabButton active={activeTab === 'production'} onClick={() => setActiveTab('production')} icon={<Paperclip size={16} />} label="Produção" />
      </div>

      {/* Content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <Section title="Classificação e Ganhos" icon={<Target size={20} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tipo de Inovação</label>
                        <select 
                          value={project.innovationType || ''}
                          onChange={(e) => onUpdate({ innovationType: e.target.value as any })}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          <option value="Incremental">Incremental</option>
                          <option value="Radical">Radical</option>
                          <option value="Disruptiva">Disruptiva</option>
                          <option value="Arquitetural">Arquitetural</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Área / Setor</label>
                        <input 
                          type="text"
                          value={project.sector || ''}
                          onChange={(e) => onUpdate({ sector: e.target.value })}
                          placeholder="Ex: Comercial, Operações..."
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Ganho Estimado (R$)</label>
                        <input 
                          type="number"
                          value={project.estimatedGain || ''}
                          onChange={(e) => onUpdate({ estimatedGain: Number(e.target.value) })}
                          placeholder="0,00"
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Ganho Real (R$)</label>
                        <input 
                          type="number"
                          value={project.realGain || ''}
                          onChange={(e) => onUpdate({ realGain: Number(e.target.value) })}
                          placeholder="0,00"
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Data de Conclusão</label>
                        <input 
                          type="date"
                          value={project.completionDate || ''}
                          onChange={(e) => onUpdate({ completionDate: e.target.value })}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        />
                      </div>
                    </div>
                  </Section>

                  <Section title="Resumo do projeto" icon={<Briefcase size={20} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ReadOnlyField label="Projeto Relacionado" value={pdcaProject?.name || project.projectName} icon={<Layers size={14} />} />
                      <ReadOnlyField label="Subtarefa" value={pdcaSubtask?.title || project.processName} icon={<RefreshCw size={14} />} />
                      <ReadOnlyField label="Responsável" value={project.responsibleName || 'Não atribuído'} icon={<UserIcon size={14} />} />
                    </div>

                    {project.description && (
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">Descrição do Projeto</label>
                        <div className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                          {project.description}
                        </div>
                      </div>
                    )}

                    {pdcaSubtask && (
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <button 
                          onClick={() => onNavigateToMapping?.(project.projectId, pdcaSubtask.id)}
                          className="flex items-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 group"
                        >
                          <GitBranch size={16} className="group-hover:rotate-12 transition-transform" />
                          <span>Ver Mapeamento do Processo (BPMN)</span>
                          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    )}
                  </Section>

                  <Section title="Contexto do Processo" icon={<FileText size={20} />}>
                    <div className="space-y-6">
                      <ReadOnlyLongField 
                        label="O que será feito ? (WHAT)" 
                        value={pdcaAction?.what || 'Informação não disponível no PDCA.'} 
                      />
                      <ReadOnlyLongField 
                        label="Porque será feito? (WHY)" 
                        value={pdcaAction?.why || 'Informação não disponível no PDCA.'} 
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ReadOnlyField label="Data de Criação" value={format(new Date(project.createdAt), "dd 'de' MMMM, yyyy", { locale: ptBR })} />
                      </div>
                    </div>
                  </Section>
                </div>

                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <CheckCircle2 className="text-emerald-600" size={18} />
                       Progresso da Inovação
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-500">Status Atual</span>
                        <span className={cn(
                          "px-3 py-1 text-white rounded-lg text-[10px] font-black uppercase tracking-wider",
                          statusColors[project.status]
                        )}>
                          {statusLabels[project.status]}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">Conclusão</span>
                          <span className="text-lg font-black text-indigo-600">{project.progress || 0}%</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${project.progress || 0}%` }}
                            className={cn(
                              "h-full rounded-full",
                              (project.progress || 0) === 100 ? "bg-emerald-500" : "bg-indigo-500"
                            )}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium italic mt-2 text-center">
                          Progresso calculado automaticamente com base no andamento técnico.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <Clock className="text-indigo-600" size={18} />
                       Status do PDCA
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-500">Etapa Atual</span>
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200">
                          {pdcaCycle?.etapaAtual || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-500">Progresso PDCA</span>
                        <span className="text-lg font-black text-slate-700">{pdcaCycle?.progress || 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Ação Rápida removed as requested */}
                </div>
              </div>
            )}

            {activeTab === 'technical' && (
              <TechnicalScopeSection 
                project={project} 
                onSave={handleSaveScope}
                isSaving={isSaving}
                innovationConfig={innovationConfig}
              />
            )}


            {activeTab === 'team' && (
              <DevelopmentSection 
                project={project} 
                onAddAction={handleAddAction}
                onUpdateAction={handleUpdateAction}
                onDeleteAction={handleDeleteAction}
                onUpdateResponsible={(id) => {
                  const user = users.find(u => u.id === id);
                  onUpdate({ responsibleId: id, responsibleName: user?.name });
                }}
                onUpdateParticipants={(ids) => onUpdate({ participantIds: ids })}
                users={users}
                currentUserId={currentUser?.uid || ''}
              />
            )}

            {activeTab === 'production' && (
              <ProductionSection 
                project={project}
                onUpdateProduction={(production) => onUpdate({ production })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, icon, children, className }: { title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6", className)}>
      <div className="flex items-center gap-3 text-slate-900">
        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-indigo-600">
          {icon}
        </div>
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">{label}</label>
      <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm flex items-center gap-3">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function ReadOnlyLongField({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">{label}</label>
      <div className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-sm leading-relaxed whitespace-pre-wrap min-h-[100px]">
        {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all",
        active 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
          : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- Technical Scope Section ---
function TechnicalScopeSection({ project, onSave, isSaving, innovationConfig }: { 
  project: InnovationProject, 
  onSave: (scope: any) => void, 
  isSaving: boolean,
  innovationConfig: InnovationConfig 
}) {
  const [scope, setScope] = useState(project.technicalScope || {
    whatWillBeDone: '',
    technologies: [] as string[],
    assumptions: '',
    restrictions: ''
  });

  const toggleTech = (tech: string) => {
    setScope(prev => {
      const technologies = prev.technologies || [];
      const newTechs = technologies.includes(tech)
        ? technologies.filter(t => t !== tech)
        : [...technologies, tech];
      return { ...prev, technologies: newTechs };
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-indigo-600">
              <FileCode size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Escopo Técnico</h3>
              <p className="text-xs text-slate-400">Definições técnicas e limites da inovação.</p>
            </div>
          </div>
          <button 
            onClick={() => onSave(scope)}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Salvar Escopo</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">O que será desenvolvido (Visão Técnica)</label>
              <textarea 
                value={scope.whatWillBeDone}
                onChange={(e) => setScope({...scope, whatWillBeDone: e.target.value})}
                placeholder="Descreva as especificidades técnicas da solução..."
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[160px] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 resize-none transition-all"
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tecnologias e linguagens utilizadas</label>
              <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[100px]">
                {(innovationConfig.technologies || []).length > 0 ? (
                  innovationConfig.technologies.map((tech) => (
                    <button
                      key={tech}
                      onClick={() => toggleTech(tech)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        (scope.technologies || []).includes(tech)
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                          : "bg-white text-slate-500 border-slate-100 hover:border-indigo-200"
                      )}
                    >
                      {tech}
                    </button>
                  ))
                ) : (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic py-4">Nenhuma tecnologia cadastrada nas Configurações.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Premissas Técnicas</label>
              <textarea 
                value={scope.assumptions}
                onChange={(e) => setScope({...scope, assumptions: e.target.value})}
                placeholder="Ex: Acesso à API do cliente, disponibilidade de servidor..."
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 resize-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Restrições Técnicas</label>
              <textarea 
                value={scope.restrictions}
                onChange={(e) => setScope({...scope, restrictions: e.target.value})}
                placeholder="Ex: Banco de dados Y, Infraestrutura local..."
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 resize-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- Development (formerly Team Space) Section ---
function DevelopmentSection({ 
  project, 
  onAddAction, 
  onUpdateAction,
  onDeleteAction,
  onUpdateResponsible,
  onUpdateParticipants,
  users,
  currentUserId
}: { 
  project: InnovationProject, 
  onAddAction: (action: any) => void, 
  onUpdateAction: (id: string, updates: any) => void,
  onDeleteAction: (id: string) => void,
  onUpdateResponsible: (id: string) => void,
  onUpdateParticipants: (ids: string[]) => void,
  users: User[],
  currentUserId: string
}) {
  const [showNewActionForm, setShowNewActionForm] = useState(false);
  const [newAction, setNewAction] = useState({ 
    type: 'Alinhamento' as InnovationActionType, 
    priority: 'Média' as InnovationAction['priority'],
    description: '', 
    responsibleId: '', 
    deadline: '' 
  });
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [response, setResponse] = useState({ 
    responseDescription: '', 
    status: 'Pendente' as InnovationAction['status'], 
    completionDate: format(new Date(), 'yyyy-MM-dd') 
  });

  const toggleParticipant = (userId: string) => {
    const currentParticipants = project.participantIds || [];
    const newParticipants = currentParticipants.includes(userId)
      ? currentParticipants.filter(id => id !== userId)
      : [...currentParticipants, userId];
    onUpdateParticipants(newParticipants);
  };

  const actionTypes: InnovationActionType[] = ['Alinhamento', 'Ajustes', 'Decisão', 'Testes', 'Implementação'];

  const [actionToDelete, setActionToDelete] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (actionToDelete) {
      await onDeleteAction(actionToDelete);
      setActionToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Time e Papeis */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-3 text-slate-900 border-b border-slate-50 pb-6">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Users size={20} />
          </div>
          <h3 className="text-lg font-bold tracking-tight">Time do Projeto</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <UserIcon size={12} className="text-indigo-500" />
              Responsável pelo Projeto
            </label>
            <select 
              value={project.responsibleId}
              onChange={(e) => onUpdateResponsible(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="">Selecione o responsável...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Plus size={12} className="text-indigo-500" />
              Participantes do Projeto
            </label>
            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[58px]">
              <div className="flex flex-wrap gap-2">
                {users.map(u => {
                  const isSelected = (project.participantIds || []).includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleParticipant(u.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                        isSelected 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                          : "bg-white text-slate-500 border-slate-200 hover:border-indigo-100"
                      )}
                    >
                      {u.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ações de Desenvolvimento */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center justify-between border-b border-slate-50 pb-6">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <h3 className="text-lg font-bold tracking-tight">Ações de Desenvolvimento</h3>
          </div>
          <button 
            onClick={() => setShowNewActionForm(!showNewActionForm)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            {showNewActionForm ? <ArrowLeft size={16} className="rotate-90" /> : <Plus size={16} />}
            <span>{showNewActionForm ? 'Cancelar' : 'Nova Ação'}</span>
          </button>
        </div>

        {showNewActionForm && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Ação</label>
                <div className="grid grid-cols-3 gap-2">
                  {actionTypes.map(type => (
                    <button 
                      key={type}
                      onClick={() => setNewAction({...newAction, type})}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all",
                        newAction.type === type ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:border-indigo-200"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridade</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Baixa', 'Média', 'Alta'] as const).map(p => (
                    <button 
                      key={p}
                      onClick={() => setNewAction({...newAction, priority: p})}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all",
                        newAction.priority === p ? "bg-amber-600 text-white border-amber-600 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:border-amber-100"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <textarea 
                  value={newAction.description}
                  onChange={(e) => setNewAction({...newAction, description: e.target.value})}
                  placeholder="O que deve ser feito?"
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm h-[100px] resize-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designar Responsável</label>
                <select 
                  value={newAction.responsibleId}
                  onChange={(e) => setNewAction({...newAction, responsibleId: e.target.value})}
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  <option value="">Selecione o responsável pela ação...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prazo para ação</label>
                <input 
                  type="date"
                  value={newAction.deadline}
                  onChange={(e) => setNewAction({...newAction, deadline: e.target.value})}
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button 
                onClick={() => {
                  if (newAction.description && newAction.responsibleId && newAction.deadline && newAction.priority) {
                    onAddAction(newAction);
                    setNewAction({ type: 'Alinhamento', priority: 'Média', description: '', responsibleId: '', deadline: '' });
                    setShowNewActionForm(false);
                  }
                }}
                className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl"
              >
                Salvar Ação
              </button>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          {(!project.developmentActions || project.developmentActions.length === 0) ? (
            <div className="p-20 bg-slate-50 rounded-[2.5rem] border border-slate-100 text-center text-slate-400 italic">
              Nenhuma ação registrada para este desenvolvimento.
            </div>
          ) : (
            <div className="overflow-x-auto pb-6 custom-scrollbar -mx-2 px-2">
              <table className="w-full border-separate border-spacing-y-4 min-w-[1240px]">
                <thead>
                  <tr className="bg-[#003489] text-white">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left first:rounded-l-xl w-[110px]">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left w-[110px]">Prioridade</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left">Descrição da ação</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left w-[220px]">Responsável</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left w-[120px]">Prazo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center w-[160px]">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left w-[280px]">Última Atualização</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center last:rounded-r-xl w-[120px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {project.developmentActions.map((action) => {
                    const responsible = users.find(u => u.id === action.responsibleId);
                    const isResponsible = action.responsibleId === currentUserId;
                    
                    const statusColors: Record<string, string> = {
                      'Pendente': 'bg-amber-100 text-amber-700 border-amber-200',
                      'Em andamento': 'bg-indigo-100 text-indigo-700 border-indigo-200',
                      'Concluído': 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    };

                    return (
                      <React.Fragment key={action.id}>
                        <tr className="bg-white border-y border-slate-50 transition-all hover:bg-indigo-50/10 group shadow-sm">
                          <td className="px-6 py-6 rounded-l-2xl border-l border-y border-slate-100 align-middle">
                             <div className="flex">
                               <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                                 {action.type}
                               </span>
                             </div>
                          </td>
                          <td className="px-6 py-6 border-y border-slate-100 align-middle">
                             <div className="flex">
                               <span className={cn(
                                 "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border whitespace-nowrap",
                                 action.priority === 'Alta' ? "bg-rose-100 text-rose-700 border-rose-200" :
                                 action.priority === 'Média' ? "bg-amber-100 text-amber-700 border-amber-200" :
                                 "bg-slate-100 text-slate-600 border-slate-200"
                               )}>
                                 {action.priority}
                               </span>
                             </div>
                          </td>
                          <td className="px-6 py-6 border-y border-slate-100 align-middle">
                            <p className="text-sm font-bold text-slate-700 line-clamp-2 leading-snug">{action.description}</p>
                          </td>
                          <td className="px-6 py-6 border-y border-slate-100 align-middle">
                            <div className="flex items-center gap-3 whitespace-nowrap">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[110%] font-black text-indigo-600 shadow-inner">
                                {responsible?.name?.[0] || '?'}
                              </div>
                              <span className="text-xs font-bold text-slate-600">{responsible?.name || 'Sistema'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6 border-y border-slate-100 align-middle">
                            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs whitespace-nowrap">
                              <Calendar size={14} className="text-slate-300" />
                              {action.deadline ? format(new Date(action.deadline), 'dd/MM/yyyy') : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-6 border-y border-slate-100 align-middle">
                             <div className="flex justify-center">
                               <span className={cn(
                                 "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border whitespace-nowrap shadow-sm min-w-[120px] text-center",
                                 statusColors[action.status] || 'bg-slate-100 text-slate-500 border-slate-200'
                               )}>
                                 {action.status}
                               </span>
                             </div>
                          </td>
                          <td className="px-6 py-6 border-y border-slate-100 align-middle">
                            <p className={cn(
                              "text-xs font-medium max-w-xs italic leading-relaxed",
                              action.responseDescription ? "text-slate-600" : "text-slate-400"
                            )}>
                              {action.responseDescription ? (
                                <span className="line-clamp-2">{action.responseDescription}</span>
                              ) : 'Aguardando atualização...'}
                            </p>
                          </td>
                          <td className="px-6 py-6 rounded-r-2xl border-r border-y border-slate-100 align-middle">
                             <div className="flex items-center justify-center gap-3">
                               {isResponsible && action.status !== 'Concluído' ? (
                                 <button 
                                   onClick={() => {
                                     setRespondingTo(respondingTo === action.id ? null : action.id);
                                     if (respondingTo !== action.id) {
                                       setResponse({
                                         responseDescription: action.responseDescription || '',
                                         status: action.status,
                                         completionDate: action.completionDate || format(new Date(), 'yyyy-MM-dd')
                                       });
                                     }
                                   }}
                                   title="Editar andamento"
                                   className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                                 >
                                   <Edit size={16} />
                                 </button>
                               ) : (
                                 <div className="w-9 h-9" /> // Placeholder to keep layout stable
                               )}
                               <button 
                                 onClick={() => setActionToDelete(action.id)}
                                 title="Excluir ação"
                                 className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                               >
                                 <Trash2 size={16} />
                               </button>
                             </div>
                          </td>
                        </tr>
                        {respondingTo === action.id && (
                          <tr>
                            <td colSpan={8} className="px-6 pb-6 pt-2">
                              <div className="bg-indigo-50/50 p-6 rounded-[1.5rem] border border-indigo-100 space-y-4">
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Execução da Ação</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição do que foi feito</label>
                                    <textarea 
                                      value={response.responseDescription}
                                      onChange={(e) => setResponse({...response, responseDescription: e.target.value})}
                                      placeholder="O que foi realizado nesta ação?"
                                      className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm h-[100px] resize-none"
                                    />
                                  </div>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status da Ação</label>
                                      <div className="flex gap-2">
                                        {['Pendente', 'Em andamento', 'Concluído'].map(s => (
                                          <button 
                                            key={s}
                                            onClick={() => setResponse({...response, status: s as any})}
                                            className={cn(
                                              "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all",
                                              response.status === s ? "bg-white text-indigo-600 border-indigo-200 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-100"
                                            )}
                                          >
                                            {s}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de conclusão</label>
                                      <input 
                                        type="date"
                                        value={response.completionDate}
                                        onChange={(e) => setResponse({...response, completionDate: e.target.value})}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-end">
                                  <button 
                                    onClick={() => {
                                      onUpdateAction(action.id, response);
                                      setRespondingTo(null);
                                    }}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
                                  >
                                    Salvar Resposta
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {actionToDelete && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Ação?</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Tem certeza que deseja excluir esta ação? Esta operação removerá permanentemente o item da lista de desenvolvimento.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setActionToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Production Section ---
function ProductionSection({ project, onUpdateProduction }: { project: InnovationProject, onUpdateProduction: (prod: any) => void }) {
  const [production, setProduction] = useState(project.production || {
    document: { name: '', url: '' },
    technicalDeliverable: { name: '', type: '', url: '' },
    externalLinks: {
      repositories: [],
      externalTools: []
    }
  });

  const [newRepo, setNewRepo] = useState({ name: '', url: '' });
  const [newTool, setNewTool] = useState({ name: '', url: '' });

  const handleSave = () => {
    onUpdateProduction(production);
  };

  const addRepo = () => {
    if (newRepo.name && newRepo.url) {
      const updated = {
        ...production,
        externalLinks: {
          ...production.externalLinks,
          repositories: [...(production.externalLinks?.repositories || []), { ...newRepo, id: uuidv4() }]
        }
      };
      setProduction(updated);
      setNewRepo({ name: '', url: '' });
    }
  };

  const removeRepo = (id: string) => {
    const updated = {
      ...production,
      externalLinks: {
        ...production.externalLinks,
        repositories: (production.externalLinks?.repositories || []).filter(r => r.id !== id)
      }
    };
    setProduction(updated);
  };

  const addTool = () => {
    if (newTool.name && newTool.url) {
      const updated = {
        ...production,
        externalLinks: {
          ...production.externalLinks,
          externalTools: [...(production.externalLinks?.externalTools || []), { ...newTool, id: uuidv4() }]
        }
      };
      setProduction(updated);
      setNewTool({ name: '', url: '' });
    }
  };

  const removeTool = (id: string) => {
    const updated = {
      ...production,
      externalLinks: {
        ...production.externalLinks,
        externalTools: (production.externalLinks?.externalTools || []).filter(t => t.id !== id)
      }
    };
    setProduction(updated);
  };

  return (
    <div className="space-y-8">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Paperclip size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">Registro de Produção</h3>
            <p className="text-xs text-slate-400">Gerencie documentos, entregas e links externos.</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Save size={14} />
          <span>Salvar Produção</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Documento Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-slate-900 border-b border-slate-50 pb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText size={18} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest">Documento</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do documento</label>
              <input 
                value={production.document?.name || ''}
                onChange={(e) => setProduction({...production, document: { ...(production.document || {url: ''}), name: e.target.value }})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                placeholder="Ex: Manual do Usuário"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link do documento</label>
              <input 
                value={production.document?.url || ''}
                onChange={(e) => setProduction({...production, document: { ...(production.document || {name: ''}), url: e.target.value }})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>
        </div>

        {/* Entrega Técnica Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-slate-900 border-b border-slate-50 pb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <FileCode size={18} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest">Entrega Técnica</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do entregável</label>
                <input 
                  value={production.technicalDeliverable?.name || ''}
                  onChange={(e) => setProduction({...production, technicalDeliverable: { ...(production.technicalDeliverable || {type: '', url: ''}), name: e.target.value }})}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                  placeholder="Ex: API de Integração"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo do entregável</label>
                <input 
                  value={production.technicalDeliverable?.type || ''}
                  onChange={(e) => setProduction({...production, technicalDeliverable: { ...(production.technicalDeliverable || {name: '', url: ''}), type: e.target.value }})}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                  placeholder="Ex: Script, Dashboard, API"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link do entregável</label>
              <input 
                value={production.technicalDeliverable?.url || ''}
                onChange={(e) => setProduction({...production, technicalDeliverable: { ...(production.technicalDeliverable || {name: '', type: ''}), url: e.target.value }})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                placeholder="https://github.com/..."
              />
            </div>
          </div>
        </div>

        {/* Links Externos Section */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center gap-3 text-slate-900 border-b border-slate-50 pb-4">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <LinkIcon size={18} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest">Links Externos</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Repositories */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Github size={14} className="text-slate-400" />
                  Repositórios
                </h4>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    value={newRepo.name}
                    onChange={(e) => setNewRepo({...newRepo, name: e.target.value})}
                    placeholder="Nome"
                    className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold"
                  />
                  <input 
                    value={newRepo.url}
                    onChange={(e) => setNewRepo({...newRepo, url: e.target.value})}
                    placeholder="URL"
                    className="flex-[2] p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold"
                  />
                  <button 
                    onClick={addRepo}
                    className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-2">
                  {(production.externalLinks?.repositories || []).map(repo => (
                    <div key={repo.id} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Github size={14} className="text-slate-300" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{repo.name}</p>
                          <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline truncate block">{repo.url}</a>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeRepo(repo.id)}
                        className="w-7 h-7 text-slate-400 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* External Tools */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Globe size={14} className="text-slate-400" />
                  Ferramentas Externas
                </h4>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    value={newTool.name}
                    onChange={(e) => setNewTool({...newTool, name: e.target.value})}
                    placeholder="Nome"
                    className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold"
                  />
                  <input 
                    value={newTool.url}
                    onChange={(e) => setNewTool({...newTool, url: e.target.value})}
                    placeholder="URL"
                    className="flex-[2] p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold"
                  />
                  <button 
                    onClick={addTool}
                    className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-2">
                  {(production.externalLinks?.externalTools || []).map(tool => (
                    <div key={tool.id} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Globe size={14} className="text-slate-300" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{tool.name}</p>
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline truncate block">{tool.url}</a>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeTool(tool.id)}
                        className="w-7 h-7 text-slate-400 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
