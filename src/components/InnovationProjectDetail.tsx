import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Settings, 
  Clock, 
  GitBranch, 
  Briefcase, 
  RefreshCw, 
  User as UserIcon,
  Layers,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Link as LinkIcon,
  Paperclip,
  Plus,
  Trash2,
  Save,
  MessageSquare,
  History,
  Info,
  ExternalLink,
  ChevronRight
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
  InnovationPipelineStage,
  InnovationTeamLogEntry,
  InnovationArtifact
} from '../types';
import { cn } from '../lib/utils';

interface InnovationProjectDetailProps {
  project: InnovationProject;
  projects: Project[];
  users: User[];
  onBack: () => void;
  onUpdate: (updates: Partial<InnovationProject>) => Promise<void>;
}

export default function InnovationProjectDetail({ 
  project, 
  projects, 
  users, 
  onBack, 
  onUpdate 
}: InnovationProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'pipeline' | 'team' | 'artifacts' | 'history'>('overview');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleAddLog = async (entry: Omit<InnovationTeamLogEntry, 'id' | 'date'>) => {
    const newEntry: InnovationTeamLogEntry = {
      ...entry,
      id: uuidv4(),
      date: new Date().toISOString()
    };
    await onUpdate({ teamLog: [newEntry, ...(project.teamLog || [])] });
  };

  const handleUpdatePipeline = async (stageId: string, updates: Partial<InnovationPipelineStage>) => {
    const newPipeline = (project.pipeline || []).map(s => 
      s.id === stageId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    );
    await onUpdate({ pipeline: newPipeline });
  };

  const handleAddArtifact = async (artifact: Omit<InnovationArtifact, 'id' | 'addedAt'>) => {
    const newArtifact: InnovationArtifact = {
      ...artifact,
      id: uuidv4(),
      addedAt: new Date().toISOString()
    };
    await onUpdate({ artifacts: [...(project.artifacts || []), newArtifact] });
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
          <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 font-bold text-sm">
            {project.status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-[1.5rem] border border-slate-100 shadow-sm self-start">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Info size={16} />} label="Resumo & Contexto" />
        <TabButton active={activeTab === 'technical'} onClick={() => setActiveTab('technical')} icon={<FileCode size={16} />} label="Escopo Técnico" />
        <TabButton active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} icon={<GitBranch size={16} />} label="Pipeline" />
        <TabButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<MessageSquare size={16} />} label="Time de Inovação" />
        <TabButton active={activeTab === 'artifacts'} onClick={() => setActiveTab('artifacts')} icon={<Paperclip size={16} />} label="Artefatos" />
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={16} />} label="Histórico" />
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
                  <Section title="Resumo Executivo" icon={<Briefcase size={20} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ReadOnlyField label="Projeto Relacionado" value={project.projectName} icon={<Layers size={14} />} />
                      <ReadOnlyField label="Etapa / Processo" value={project.processName} icon={<RefreshCw size={14} />} />
                      <ReadOnlyField label="Responsável" value={project.responsibleName || 'Não atribuído'} icon={<UserIcon size={14} />} />
                      <ReadOnlyField label="Tipo de Solução" value={project.type || 'Não definido'} icon={<Settings size={14} />} />
                    </div>
                  </Section>

                  <Section title="Contexto do Processo" icon={<FileText size={20} />}>
                    <div className="space-y-6">
                      <ReadOnlyLongField 
                        label="Problema / Oportunidade (WHAT)" 
                        value={pdcaAction?.what || 'Informação não disponível no PDCA.'} 
                      />
                      <ReadOnlyLongField 
                        label="Justificativa (WHY)" 
                        value={pdcaAction?.why || 'Informação não disponível no PDCA.'} 
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ReadOnlyField label="Objetivo do Ciclo" value={pdcaCycle?.title || 'N/A'} />
                        <ReadOnlyField label="Data de Criação" value={format(new Date(project.createdAt), "dd 'de' MMMM, yyyy", { locale: ptBR })} />
                      </div>
                    </div>
                  </Section>
                </div>

                <div className="space-y-8">
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

                  <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-200 text-white">
                    <h3 className="text-sm font-black uppercase tracking-widest mb-4">Ação Rápida</h3>
                    <p className="text-white/80 text-sm mb-6 leading-relaxed">
                      Esta inovação está vinculada a uma ação de {project.type || 'tecnologia'} do PDCA. Todas as mudanças de status aqui são refletidas no log do processo.
                    </p>
                    <button className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                      Ver no PDCA
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'technical' && (
              <TechnicalScopeSection 
                project={project} 
                onSave={handleSaveScope}
                isSaving={isSaving}
              />
            )}

            {activeTab === 'pipeline' && (
              <PipelineSection 
                project={project} 
                users={users}
                onUpdateStage={handleUpdatePipeline}
              />
            )}

            {activeTab === 'team' && (
              <TeamSpaceSection 
                project={project} 
                onAddLog={handleAddLog}
                users={users}
              />
            )}

            {activeTab === 'artifacts' && (
              <ArtifactsSection 
                project={project}
                onAddArtifact={handleAddArtifact}
                pdcaSubtask={pdcaSubtask}
              />
            )}

            {activeTab === 'history' && (
              <HistorySection project={project} users={users} projects={projects} />
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
function TechnicalScopeSection({ project, onSave, isSaving }: { project: InnovationProject, onSave: (scope: any) => void, isSaving: boolean }) {
  const [scope, setScope] = useState(project.technicalScope || {
    whatWillBeDone: '',
    whatWillNotBeDone: '',
    assumptions: '',
    restrictions: ''
  });

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
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">O que será desenvolvido (Visão Técnica)</label>
            <textarea 
              value={scope.whatWillBeDone}
              onChange={(e) => setScope({...scope, whatWillBeDone: e.target.value})}
              placeholder="Descreva as especificidades técnicas da solução..."
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[160px] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 resize-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">O que NÃO será feito</label>
            <textarea 
              value={scope.whatWillNotBeDone}
              onChange={(e) => setScope({...scope, whatWillNotBeDone: e.target.value})}
              placeholder="Limite o escopo para evitar desperdício..."
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[160px] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 resize-none transition-all"
            />
          </div>
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
              placeholder="Ex: Linguagem de programação X, banco de dados Y..."
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 resize-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Pipeline Section ---
function PipelineSection({ project, users, onUpdateStage }: { project: InnovationProject, users: User[], onUpdateStage: (id: string, updates: any) => void }) {
  const defaultStages: InnovationPipelineStage['name'][] = ['Entendimento', 'Análise', 'Solução', 'Desenvolvimento', 'Entrega'];
  
  const stages = useMemo(() => {
    const existing = project.pipeline || [];
    return defaultStages.map(name => {
      const match = existing.find(s => s.name === name);
      return match || {
        id: uuidv4(),
        name,
        status: 'Pendente' as const,
        responsibleId: '',
        observations: '',
        updatedAt: new Date().toISOString()
      };
    });
  }, [project.pipeline]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {stages.map((stage, idx) => (
        <div key={stage.id} className="relative">
          {idx < stages.length - 1 && (
            <div className="hidden md:block absolute top-[60px] -right-4 z-0 text-slate-200">
              <ChevronRight size={32} />
            </div>
          )}
          <div className={cn(
            "relative z-10 bg-white p-6 rounded-[2rem] border transition-all h-full flex flex-col gap-4",
            stage.status === 'Concluído' ? "border-emerald-200 bg-emerald-50/20" : 
            stage.status === 'Em andamento' ? "border-indigo-200 shadow-lg shadow-indigo-50" : "border-slate-100 text-slate-400"
          )}>
            <div className="flex flex-col items-center text-center gap-3 mb-2">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg",
                stage.status === 'Concluído' ? "bg-emerald-600 text-white" : 
                stage.status === 'Em andamento' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
              )}>
                {idx + 1}
              </div>
              <h4 className="font-black uppercase tracking-widest text-[10px]">{stage.name}</h4>
            </div>

            <select 
              value={stage.status}
              onChange={(e) => onUpdateStage(stage.id, { status: e.target.value })}
              className={cn(
                "w-full p-2 text-[10px] font-black uppercase tracking-wider rounded-lg outline-none border text-center",
                stage.status === 'Concluído' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                stage.status === 'Em andamento' ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-slate-100 text-slate-400 border-slate-200"
              )}
            >
              <option value="Pendente">Pendente</option>
              <option value="Em andamento">Em Andamento</option>
              <option value="Concluído">Concluído</option>
            </select>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">Responsável</label>
                <select 
                  value={stage.responsibleId}
                  onChange={(e) => onUpdateStage(stage.id, { responsibleId: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-100 p-2 rounded-xl text-[10px] font-bold text-slate-600 outline-none"
                >
                  <option value="">Selecione...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">Notas</label>
                <textarea 
                  value={stage.observations}
                  onChange={(e) => onUpdateStage(stage.id, { observations: e.target.value })}
                  onBlur={() => onUpdateStage(stage.id, {})}
                  className="w-full bg-slate-50/50 border border-slate-100 p-2 rounded-xl text-[10px] font-medium text-slate-600 outline-none resize-none h-24"
                  placeholder="Obs..."
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Team Space Section ---
function TeamSpaceSection({ project, onAddLog, users }: { project: InnovationProject, onAddLog: (entry: any) => void, users: User[] }) {
  const [newLog, setNewLog] = useState({ type: 'Decisão' as const, content: '', authorId: '' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Plus className="text-indigo-600" size={20} />
            Novo Registro
          </h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Registro</label>
              <div className="grid grid-cols-2 gap-2">
                {['Decisão', 'Hipótese', 'Teste', 'Aprendizado', 'Risco', 'Ajuste'].map(type => (
                  <button 
                    key={type}
                    onClick={() => setNewLog({...newLog, type: type as any})}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all",
                      newLog.type === type ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-400 border-slate-100 hover:border-indigo-200"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Autor</label>
              <select 
                value={newLog.authorId}
                onChange={(e) => setNewLog({...newLog, authorId: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600"
              >
                <option value="">Selecione...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conteúdo</label>
              <textarea 
                value={newLog.content}
                onChange={(e) => setNewLog({...newLog, content: e.target.value})}
                placeholder="Descreva a decisão, aprendizado ou risco..."
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 resize-none text-sm"
              />
            </div>
            <button 
              onClick={() => {
                if (newLog.content && newLog.authorId) {
                  onAddLog(newLog);
                  setNewLog({ ...newLog, content: '' });
                }
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
            >
              Adicionar Registro
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
        {(!project.teamLog || project.teamLog.length === 0) ? (
          <div className="bg-white p-20 rounded-[2.5rem] border border-slate-100 text-center text-slate-400 italic">
            Nenhum registro no log evolutivo. Comece adicionando uma decisão ou hipótese.
          </div>
        ) : (
          project.teamLog.map((log) => {
            const author = users.find(u => u.id === log.authorId);
            const typeStyles: Record<string, string> = {
              'Decisão': 'bg-blue-100 text-blue-700',
              'Hipótese': 'bg-purple-100 text-purple-700',
              'Teste': 'bg-amber-100 text-amber-700',
              'Aprendizado': 'bg-emerald-100 text-emerald-700',
              'Risco': 'bg-rose-100 text-rose-700',
              'Ajuste': 'bg-slate-100 text-slate-700'
            };

            return (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                key={log.id} 
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider", typeStyles[log.type])}>
                      {log.type}
                    </span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      {format(new Date(log.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                      {author?.name?.[0] || '?'}
                    </div>
                    <span className="text-xs font-bold text-slate-500">{author?.name || 'Sistema'}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  {log.content}
                </p>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- Artifacts Section ---
function ArtifactsSection({ project, onAddArtifact, pdcaSubtask }: { project: InnovationProject, onAddArtifact: (art: any) => void, pdcaSubtask: any }) {
  const [newArt, setNewArt] = useState({ name: '', url: '', type: 'link' as const });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold tracking-tight">Anexar Artefato</h3>
          <div className="space-y-4">
             <div className="flex p-1 bg-slate-100 rounded-xl">
               <button 
                 onClick={() => setNewArt({...newArt, type: 'link'})}
                 className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", newArt.type === 'link' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}
               >
                 Link
               </button>
               <button 
                 onClick={() => setNewArt({...newArt, type: 'file'})}
                 className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", newArt.type === 'file' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}
               >
                 Arquivo
               </button>
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Artefato</label>
               <input 
                 value={newArt.name}
                 onChange={(e) => setNewArt({...newArt, name: e.target.value})}
                 className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{newArt.type === 'link' ? 'URL do Link' : 'ID do Arquivo/Link'}</label>
               <input 
                 value={newArt.url}
                 onChange={(e) => setNewArt({...newArt, url: e.target.value})}
                 className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
               />
             </div>
             <button 
               onClick={() => {
                 if (newArt.name && newArt.url) {
                   onAddArtifact(newArt);
                   setNewArt({ name: '', url: '', type: 'link' });
                 }
               }}
               className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
             >
               Adicionar Artefato
             </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
        {pdcaSubtask?.mapping?.nodes && pdcaSubtask.mapping.nodes.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-[2rem] shadow-lg shadow-indigo-100 flex items-center justify-between text-white group">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <RefreshCw size={24} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold truncate">BPMN do Processo</h4>
                <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">
                  Integrado via Gestão de Processos
                </p>
              </div>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
               <CheckCircle2 size={18} />
            </div>
          </div>
        )}

        {(!project.artifacts || project.artifacts.length === 0) && (!pdcaSubtask?.mapping?.nodes || pdcaSubtask.mapping.nodes.length === 0) ? (
          <div className="col-span-full bg-white p-20 rounded-[2.5rem] border border-slate-100 text-center text-slate-400 italic">
            Nenhum artefato anexado.
          </div>
        ) : (
          project.artifacts.map((art) => (
            <div key={art.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  {art.type === 'link' ? <LinkIcon size={20} /> : <FileText size={20} />}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-800 truncate">{art.name}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {format(new Date(art.addedAt), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>
              <a 
                href={art.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shrink-0"
              >
                <ExternalLink size={18} />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- History Section ---
function HistorySection({ project, users, projects }: { project: InnovationProject, users: User[], projects: Project[] }) {
  // Aggregate logs from PDCA that match this innovation card
  const innovationLogs = useMemo(() => {
    const pdcaProject = projects.find(p => p.id === project.projectId);
    let logs: any[] = [];

    if (pdcaProject) {
      pdcaProject.subtasks.forEach(sub => {
        sub.pdcaCycles.forEach(cycle => {
          cycle.plan.actionPlan.forEach(action => {
            if (action.innovationProjectId === project.id && action.innovationLogs) {
              logs = [...logs, ...action.innovationLogs];
            }
          });
        });
      });
    }

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [project, projects]);

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <h3 className="text-lg font-bold tracking-tight mb-8">Histórico da Inovação</h3>
      
      <div className="space-y-0 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
        {innovationLogs.length === 0 ? (
          <div className="p-20 text-center text-slate-400 italic">
            Nenhuma movimentação registrada no histórico.
          </div>
        ) : (
          innovationLogs.map((log, idx) => (
            <div key={log.id} className="relative pl-12 pb-10 last:pb-0">
               <div className={cn(
                 "absolute left-0 top-0 w-10 h-10 rounded-2xl flex items-center justify-center z-10 border-4 border-white shadow-sm transition-all",
                 idx === 0 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
               )}>
                 <Clock size={16} />
               </div>
               
               <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                   <div className="flex items-center gap-3">
                     <span className="text-xs font-black text-slate-900 uppercase tracking-widest">
                       {log.newStatus ? `Alteração de Status` : `Log de Registro`}
                     </span>
                     <span className="text-[10px] font-bold text-slate-400">
                        {format(new Date(log.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                     </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500 uppercase">
                       {log.responsible?.[0] || 'S'}
                     </div>
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{log.responsible}</span>
                   </div>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-3 mt-1">
                    {log.previousStatus && (
                      <>
                        <span className="px-3 py-1 bg-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          {log.previousStatus}
                        </span>
                        <ArrowLeft size={12} className="rotate-180 text-slate-300" />
                      </>
                    )}
                    {log.newStatus && (
                      <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {log.newStatus}
                      </span>
                    )}
                    {!log.newStatus && <p className="text-sm text-slate-600">{log.action || log.detalhes || 'Ação registrada'}</p>}
                 </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
