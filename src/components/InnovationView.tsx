import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronDown, 
  X, 
  Clock,
  AlertCircle,
  GitBranch,
  Target,
  Users,
  Briefcase,
  ArrowRight,
  RefreshCw,
  FolderOpen,
  User as UserIcon,
  Layers,
  MoreVertical,
  Trash2,
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
  InnovationLog
} from '../types';
import { cn, cleanObject } from '../lib/utils';
import { db, setDoc, doc, handleFirestoreError, OperationType, deleteDoc } from '../firebase';

interface InnovationViewProps {
  innovationProjects: InnovationProject[];
  projects: Project[];
  users: User[];
  onDeleteInnovationProject?: (id: string) => Promise<void>;
}

const statusColumns: { id: InnovationStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'análise', label: 'Análise', color: 'bg-amber-400' },
  { id: 'desenvolvimento', label: 'Desenvolvimento', color: 'bg-blue-400' },
  { id: 'teste', label: 'Teste', color: 'bg-indigo-400' },
  { id: 'entregue', label: 'Entregue', color: 'bg-emerald-400' }
];

export default function InnovationView({ innovationProjects, projects, users, onDeleteInnovationProject }: InnovationViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<InnovationProject | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<InnovationStatus[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<InnovationProject | null>(null);

  const filteredProjects = useMemo(() => {
    return innovationProjects.filter(p => !p.deleted).filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.processName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = visibleStatuses.length === 0 || visibleStatuses.includes(p.status);
      return matchesSearch && matchesStatus;
    });
  }, [innovationProjects, searchTerm, visibleStatuses]);

  const logStatusChange = async (innovationProject: InnovationProject, previousStatus: InnovationStatus | '', newStatus: InnovationStatus) => {
    if (newStatus === previousStatus) return;
    
    if (innovationProject.projectId && innovationProject.pdcaId && innovationProject.actionId) {
      const projectDoc = projects.find(p => p.id === innovationProject.projectId);
      if (projectDoc) {
        const updatedSubtasks = projectDoc.subtasks.map(sub => {
          const updatedCycles = sub.pdcaCycles.map(cycle => {
            if (cycle.id === innovationProject.pdcaId) {
              const updatedActions = cycle.plan.actionPlan.map(action => {
                if (action.id === innovationProject.actionId) {
                  const newLog: InnovationLog = {
                    id: uuidv4(),
                    date: new Date().toISOString(),
                    previousStatus,
                    newStatus,
                    responsible: users.find(u => u.id === innovationProject.responsibleId)?.name || innovationProject.responsibleName || 'Sistema',
                    origin: 'inovacao'
                  };
                  return {
                    ...action,
                    innovationLogs: [...(action.innovationLogs || []), newLog]
                  };
                }
                return action;
              });
              return { ...cycle, plan: { ...cycle.plan, actionPlan: updatedActions } };
            }
            return cycle;
          });
          return { ...sub, pdcaCycles: updatedCycles };
        });
        
        try {
          await setDoc(doc(db, 'projects', projectDoc.id), {
            ...projectDoc,
            subtasks: updatedSubtasks
          });
        } catch (error) {
          console.error("Error updating PDCA log:", error);
        }
      }
    }
  };

  const handleUpdateStatus = async (projectId: string, newStatus: InnovationStatus) => {
    try {
      const innovationProject = innovationProjects.find(p => p.id === projectId);
      if (!innovationProject) return;

      const previousStatus = innovationProject.status;
      
      const projectRef = doc(db, 'innovationProjects', projectId);
      const updatedProject = { 
        ...innovationProject, 
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      await setDoc(projectRef, updatedProject);

      // Log the change in PDCA
      await logStatusChange(updatedProject, previousStatus, newStatus);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `innovationProjects/${projectId}`);
    }
  };

  const handleDeleteInnovation = async (id: string) => {
    if (onDeleteInnovationProject) {
      await onDeleteInnovationProject(id);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Projeto de Inovação?</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Tem certeza que deseja excluir este card de inovação? Esta ação não poderá ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteInnovation(projectToDelete.id)}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Projetos</h2>
          <p className="text-slate-500 mt-1">Gerenciamento técnico de soluções tecnológicas.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar título, projeto ou processo..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all border shadow-sm relative",
                isFilterOpen || visibleStatuses.length > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <Filter size={18} />
              <span>Filtros</span>
              {visibleStatuses.length > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-black">
                  {visibleStatuses.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-5 space-y-4"
                >
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filtrar Status</h4>
                    <div className="flex flex-wrap gap-2">
                      {statusColumns.map(col => (
                        <button 
                          key={col.id}
                          onClick={() => setVisibleStatuses(prev => 
                            prev.includes(col.id) ? prev.filter(s => s !== col.id) : [...prev, col.id]
                          )}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                            visibleStatuses.includes(col.id) 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <button onClick={() => setVisibleStatuses([])} className="text-[10px] font-bold text-indigo-600 hover:underline">Limpar</button>
                    <button onClick={() => setIsFilterOpen(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">Fechar</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4 min-h-[600px] custom-scrollbar">
        {statusColumns.map(column => {
          const columnProjects = filteredProjects.filter(p => p.status === column.id);
          
          return (
            <div key={column.id} className="flex flex-col gap-4 min-w-[320px] flex-1">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full", column.color)} />
                  <h3 className="font-bold text-slate-700">{column.label}</h3>
                  <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                    {columnProjects.length}
                  </span>
                </div>
              </div>

              <div className="bg-slate-100/50 p-3 rounded-2xl flex-1 space-y-4 border border-slate-200/50">
                {columnProjects.map(project => (
                  <InnovationCard 
                    key={project.id} 
                    project={project} 
                    onClick={() => setSelectedProject(project)}
                    onDelete={() => setProjectToDelete(project)}
                  />
                ))}
                
                {columnProjects.length === 0 && (
                  <div className="py-10 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
                    <Layers size={24} className="mb-2 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Vazio</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <InnovationDetailModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        users={users}
        projects={projects}
        onUpdateProject={async (updates) => {
          if (selectedProject) {
            try {
              const previousStatus = selectedProject.status;
              const projectRef = doc(db, 'innovationProjects', selectedProject.id);
              const fullUpdate = { ...selectedProject, ...updates, updatedAt: new Date().toISOString() };
              await setDoc(projectRef, fullUpdate);
              
              if (updates.status && updates.status !== previousStatus) {
                await logStatusChange(fullUpdate, previousStatus, updates.status as InnovationStatus);
              }
              
              setSelectedProject(fullUpdate);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `innovationProjects/${selectedProject.id}`);
            }
          }
        }}
      />
    </div>
  );
}

function InnovationCard({ project, onClick, onDelete }: { project: InnovationProject, onClick: () => void, onDelete: () => void | Promise<void>, key?: any }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const complexityStyles: Record<string, string> = {
    'Baixa': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Média': 'bg-amber-100 text-amber-700 border-amber-200',
    'Alta': 'bg-rose-100 text-rose-700 border-rose-200',
    'Muito Alta': 'bg-purple-100 text-purple-700 border-purple-200'
  };

  return (
    <motion.div 
      whileHover={{ y: -4, shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
      className="bg-white p-5 rounded-xl border border-slate-200 cursor-pointer transition-all relative group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-wrap gap-2">
          <span className={cn(
            "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border",
            complexityStyles[project.complexity as string] || 'bg-slate-100 text-slate-600 border-slate-200'
          )}>
            {project.complexity || 'N/A'}
          </span>
          {project.type && (
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border bg-indigo-50 text-indigo-600 border-indigo-100">
              {project.type}
            </span>
          )}
        </div>
        
        <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 group-hover:text-slate-600 transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
              >
                <button 
                  onClick={() => {
                    onClick();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <FolderOpen size={16} />
                  Abrir Detalhes
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (project.status === 'backlog') {
                      onDelete();
                      setIsMenuOpen(false);
                    }
                  }}
                  disabled={project.status !== 'backlog'}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-t border-slate-50",
                    project.status === 'backlog' 
                      ? "text-rose-600 hover:bg-rose-50" 
                      : "text-slate-300 cursor-not-allowed"
                  )}
                  title={project.status !== 'backlog' ? "Somente cards em Backlog podem ser excluídos" : ""}
                >
                  <div className="flex items-center gap-3">
                    <Trash2 size={16} />
                    Excluir Projeto
                  </div>
                  {project.status !== 'backlog' && <AlertCircle size={14} className="text-slate-300" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <h4 className="font-bold text-slate-800 leading-tight mb-4 line-clamp-2">
        {project.title}
      </h4>

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Briefcase size={12} className="shrink-0" />
          <span className="text-[10px] font-bold truncate tracking-wide">{project.projectName}</span>
        </div>
        {project.processName && (
          <div className="flex items-center gap-2 text-slate-400">
            <RefreshCw size={12} className="shrink-0" />
            <span className="text-[10px] font-bold truncate tracking-wide">{project.processName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[8px] uppercase">
            {(project.responsibleName || 'SR').split(' ').map(n => n[0]).join('')}
          </div>
          <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">
            {project.responsibleName || 'Pendente'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Calendar size={12} />
          <span className="text-[10px] font-bold">{format(new Date(project.updatedAt), 'dd/MM', { locale: ptBR })}</span>
        </div>
      </div>
    </motion.div>
  );
}

function InnovationDetailModal({ 
  project, 
  onClose, 
  users, 
  projects, 
  onUpdateProject 
}: { 
  project: InnovationProject | null, 
  onClose: () => void,
  users: User[],
  projects: Project[],
  onUpdateProject: (updates: Partial<InnovationProject>) => Promise<void>
}) {
  if (!project) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
                <GitBranch size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Detalhes da Inovação</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Gestão de Pipeline</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Título da Inovação</label>
                <input 
                  value={project.title}
                  onChange={(e) => onUpdateProject({ title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Status</label>
                  <select 
                    value={project.status}
                    onChange={(e) => onUpdateProject({ status: e.target.value as InnovationStatus })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {statusColumns.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Tipo de Solução</label>
                  <select 
                    value={project.type || ''}
                    onChange={(e) => onUpdateProject({ type: e.target.value as InnovationSolutionType })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">Selecione...</option>
                    <option value="RPA">RPA</option>
                    <option value="Sistema">Sistema / Web App</option>
                    <option value="Integração">Integração (API)</option>
                    <option value="BI">Business Intelligence (BI)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Complexidade</label>
                  <select 
                    value={project.complexity || ''}
                    onChange={(e) => onUpdateProject({ complexity: e.target.value as InnovationComplexity })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Muito Alta">Muito Alta</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Responsável</label>
                  <select 
                    value={project.responsibleId || ''}
                    onChange={(e) => {
                      const user = users.find(u => u.id === e.target.value);
                      onUpdateProject({ 
                        responsibleId: e.target.value,
                        responsibleName: user?.name || 'Sem resp.'
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">Selecione...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Projeto Relacionado</p>
                  <p className="font-bold text-slate-700">{project.projectName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">Etapa/Processo</p>
                  <p className="font-bold text-slate-700 text-right">{project.processName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
             <button 
              onClick={onClose}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
