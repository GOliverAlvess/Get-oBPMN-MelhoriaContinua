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
  Calendar,
  Edit,
  FileText,
  ChevronRight,
  Save,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { 
  Project, 
  ProjectPriority,
  User, 
  InnovationProject, 
  InnovationStatus, 
  InnovationComplexity,
  InnovationSolutionType,
  InnovationLog,
  SavedColor,
  InnovationConfig,
  GlobalConfig
} from '../types';
import { cn, cleanObject } from '../lib/utils';
import { db, setDoc, doc, handleFirestoreError, OperationType, deleteDoc } from '../firebase';
import InnovationProjectDetail from './InnovationProjectDetail';
import MappingTab from './MappingTab';
import { calculateInnovationStatusAndProgress } from '../lib/innovationUtils';

interface InnovationViewProps {
  innovationProjects: InnovationProject[];
  projects: Project[];
  users: User[];
  onDeleteInnovationProject?: (id: string) => Promise<void>;
  onUpdateInnovationProject?: (id: string, updates: Partial<InnovationProject>) => Promise<void>;
  onNavigateToMapping?: (projectId: string, subtaskId: string) => void;
  bpmnSavedColors: SavedColor[];
  onSaveBpmnColor: (color: SavedColor) => void;
  onDeleteBpmnColor: (id: string) => void;
  innovationConfig: InnovationConfig;
  onUpdateInnovationConfig: (config: InnovationConfig) => void;
  onAddInnovationProject?: (data: any) => Promise<string>;
  globalConfig?: GlobalConfig;
}

const statusColumns: { id: InnovationStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'análise', label: 'Análise', color: 'bg-amber-400' },
  { id: 'planejamento', label: 'Em planejamento', color: 'bg-blue-400' },
  { id: 'desenvolvimento', label: 'Em desenvolvimento', color: 'bg-indigo-400' },
  { id: 'teste', label: 'Em teste', color: 'bg-purple-400' },
  { id: 'concluído', label: 'Concluído', color: 'bg-emerald-400' }
];

export default function InnovationView({ 
  innovationProjects, 
  projects, 
  users, 
  onDeleteInnovationProject,
  onUpdateInnovationProject,
  onNavigateToMapping,
  bpmnSavedColors,
  onSaveBpmnColor,
  onDeleteBpmnColor,
  innovationConfig,
  onUpdateInnovationConfig,
  onAddInnovationProject,
  globalConfig
}: InnovationViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<InnovationProject | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [viewingBpmn, setViewingBpmn] = useState<{ projectId: string, subtaskId: string } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<InnovationStatus[]>([]);
  const [visibleCollaborators, setVisibleCollaborators] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'status' | 'collaborator'>('status');
  const [projectToDelete, setProjectToDelete] = useState<InnovationProject | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<InnovationProject | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingStep, setMappingStep] = useState<'question' | 'waiting'>('question');

  const handleCreateProjectClick = () => {
    setIsMappingModalOpen(true);
    setMappingStep('question');
  };


  // Effect to automatically update progress for all projects
  useEffect(() => {
    const updateOutdatedProjects = async () => {
      for (const project of innovationProjects) {
        const { progress: autoProgress } = calculateInnovationStatusAndProgress(project);
        
        // Progress changed? (Status is now manual)
        const progressChanged = project.progress !== autoProgress;

        if (progressChanged) {
          try {
            const projectRef = doc(db, 'innovationProjects', project.id);
            await setDoc(projectRef, { 
              ...project, 
              progress: autoProgress,
              updatedAt: new Date().toISOString() 
            }, { merge: true });
          } catch (error) {
            console.error("Error auto-updating project progress:", project.id, error);
          }
        }
      }
    };

    if (innovationProjects.length > 0) {
      updateOutdatedProjects();
    }
  }, [innovationProjects]);

  // Keep selectedProject in sync with prop if it changes externally
  useEffect(() => {
    if (selectedProject) {
      const updated = innovationProjects.find(p => p.id === selectedProject.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedProject)) {
        setSelectedProject(updated);
      }
    }
  }, [innovationProjects, selectedProject]);

  const filteredProjects = useMemo(() => {
    return innovationProjects.filter(p => !p.deleted).filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.processName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = visibleStatuses.length === 0 || visibleStatuses.includes(p.status);
      const matchesCollaborator = visibleCollaborators.length === 0 || (p.responsibleId && visibleCollaborators.includes(p.responsibleId));
      return matchesSearch && matchesStatus && matchesCollaborator;
    });
  }, [innovationProjects, searchTerm, visibleStatuses, visibleCollaborators]);

  const columns = useMemo(() => {
    if (groupBy === 'status') {
      return visibleStatuses.length === 0 ? statusColumns : statusColumns.filter(c => visibleStatuses.includes(c.id));
    } else {
      // In collaborator view, only show users who have projects or those selected in filter
      const relevantUsers = visibleCollaborators.length === 0 
        ? users.filter(u => innovationProjects.some(p => p.responsibleId === u.id && !p.deleted))
        : users.filter(u => visibleCollaborators.includes(u.id));
      
      return relevantUsers.map(u => ({
        id: u.id as any, // casting to keep logic similar
        label: u.name,
        color: 'bg-indigo-400',
        user: u
      }));
    }
  }, [groupBy, visibleStatuses, visibleCollaborators, innovationProjects, users]);

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

  const handleUpdateInnovation = async (updates: Partial<InnovationProject>) => {
    if (!selectedProject) return;
    try {
      const previousStatus = selectedProject.status;
      
      // Automatic progress calculation (always helpful)
      // Status calculation is now more restricted
      const projectWithUpdates = { ...selectedProject, ...updates };
      const { status: autoStatus, progress: autoProgress } = calculateInnovationStatusAndProgress(projectWithUpdates);
      
      // If status is not explicitly provided, we keep the previous one
      // unless we want some basic automation (like moving from backlog to análise)
      // BUT the user wants manual control over status transitions now.
      const finalStatus = updates.status || selectedProject.status;
      const finalUpdates = { ...updates, status: finalStatus, progress: autoProgress };

      if (onUpdateInnovationProject) {
        await onUpdateInnovationProject(selectedProject.id, finalUpdates);
      } else {
        const projectRef = doc(db, 'innovationProjects', selectedProject.id);
        const fullUpdate = { ...selectedProject, ...finalUpdates, updatedAt: new Date().toISOString() };
        await setDoc(projectRef, fullUpdate);
      }
      
      if (finalUpdates.status && finalUpdates.status !== previousStatus) {
        const fullUpdate = { ...selectedProject, ...finalUpdates };
        await logStatusChange(fullUpdate, previousStatus, finalUpdates.status as InnovationStatus);
      }
      
      // The useEffect will handle syncing selectedProject from props
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `innovationProjects/${selectedProject.id}`);
    }
  };

  const handleUpdateStatus = async (projectId: string, newStatus: InnovationStatus) => {
    try {
      const project = innovationProjects.find(p => p.id === projectId);
      if (!project) return;
      
      const previousStatus = project.status;
      if (previousStatus === newStatus) return;

      const projectRef = doc(db, 'innovationProjects', projectId);
      await setDoc(projectRef, { 
        ...project, 
        status: newStatus,
        updatedAt: new Date().toISOString() 
      }, { merge: true });

      await logStatusChange({ ...project, status: newStatus }, previousStatus, newStatus);
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

  if (viewingBpmn) {
    const project = projects.find(p => p.id === viewingBpmn.projectId);
    const subtask = project?.subtasks.find(s => s.id === viewingBpmn.subtaskId);

    if (!project || !subtask) {
      setViewingBpmn(null);
      return null;
    }

    return (
      <div className="flex flex-col gap-6 min-h-full bg-theme-background transition-colors duration-300">
        <div className="flex items-center justify-between px-8 py-4 bg-theme-card border-b border-theme-border shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setViewingBpmn(null)}
              className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all"
            >
              <ArrowRight size={20} className="rotate-180" />
            </button>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-none">Mapeamento do Processo</h3>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-1">{project.scope.title} / {subtask.title}</p>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200">
            Modo Visualização (Read-Only)
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <MappingTab 
            project={project}
            subtask={subtask}
            onUpdateSubtask={() => {}} // Read-only
            savedColors={bpmnSavedColors}
            onSaveGlobalColor={onSaveBpmnColor}
            onDeleteGlobalColor={onDeleteBpmnColor}
            readOnly={true}
          />
        </div>
      </div>
    );
  }

  if (showDetail && selectedProject) {
    return (
      <InnovationProjectDetail 
        project={selectedProject}
        projects={projects}
        users={users}
        onBack={() => {
          setShowDetail(false);
          setSelectedProject(null);
        }}
        onUpdate={handleUpdateInnovation}
        onNavigateToMapping={(pid, sid) => setViewingBpmn({ projectId: pid, subtaskId: sid })}
        innovationConfig={innovationConfig}
        globalConfig={globalConfig}
      />
    );
  }

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
              className="bg-theme-card w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center border border-theme-border"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-theme-foreground mb-2">Excluir Projeto de Inovação?</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
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
        <div className="flex items-center gap-8">
          <div>
            <h2 className="text-3xl font-bold text-theme-foreground">Inovação</h2>
            <p className="text-slate-400 mt-1">
              Visualizando por {groupBy === 'status' ? 'status' : 'colaborador'}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleCreateProjectClick}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Plus size={20} />
            <span>Adicionar Projeto</span>
          </button>

          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar título, projeto ou processo..."
              className="w-full bg-theme-card border border-theme-border rounded-xl pl-11 pr-4 py-3 text-sm text-theme-foreground focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="flex bg-theme-card p-1 rounded-xl border border-theme-border shadow-sm">
            <button 
              onClick={() => setGroupBy('status')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                groupBy === 'status' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-100/10"
              )}
            >
              <Target size={16} />
              Status
            </button>
            <button 
              onClick={() => setGroupBy('collaborator')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                groupBy === 'collaborator' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-100/10"
              )}
            >
              <Users size={16} />
              Colaborador
            </button>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all border shadow-sm relative",
                isFilterOpen || (visibleStatuses.length + visibleCollaborators.length) > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <Filter size={18} />
              <span>Filtros</span>
              {(visibleStatuses.length + visibleCollaborators.length) > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-black">
                  {visibleStatuses.length + visibleCollaborators.length}
                </span>
              )}
              <ChevronDown size={16} className={cn("transition-transform", isFilterOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-5 space-y-6"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filtrar Status</h4>
                      <div className="flex gap-2">
                        <button onClick={() => setVisibleStatuses(statusColumns.map(c => c.id))} className="text-[9px] font-bold text-indigo-600 hover:underline">Todos</button>
                        <button onClick={() => setVisibleStatuses([])} className="text-[9px] font-bold text-slate-400 hover:underline">Nenhum</button>
                      </div>
                    </div>
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

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filtrar Colaboradores</h4>
                      <div className="flex gap-2">
                        <button onClick={() => setVisibleCollaborators(users.map(u => u.id))} className="text-[9px] font-bold text-indigo-600 hover:underline">Todos</button>
                        <button onClick={() => setVisibleCollaborators([])} className="text-[9px] font-bold text-slate-400 hover:underline">Nenhum</button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {users.map(u => (
                        <button 
                          key={u.id}
                          onClick={() => setVisibleCollaborators(prev => 
                            prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          )}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left",
                            visibleCollaborators.includes(u.id)
                              ? "bg-indigo-50 border-indigo-200"
                              : "bg-white border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold uppercase",
                            visibleCollaborators.includes(u.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                          )}>
                            {u.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className={cn(
                            "text-xs font-bold truncate",
                            visibleCollaborators.includes(u.id) ? "text-indigo-600" : "text-slate-500"
                          )}>{u.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <button 
                      onClick={() => {
                        setVisibleStatuses([]);
                        setVisibleCollaborators([]);
                      }} 
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      Limpar
                    </button>
                    <button onClick={() => setIsFilterOpen(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">Fechar</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4 min-h-[600px] custom-scrollbar">
        {columns.map(column => {
          const columnProjects = filteredProjects.filter(p => 
            groupBy === 'status' ? p.status === column.id : p.responsibleId === column.id
          );
          
          return (
            <div key={column.id} className="flex flex-col gap-4 min-w-[320px] flex-1">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  {groupBy === 'status' ? (
                    <div className={cn("w-3 h-3 rounded-full", column.color)} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[10px] uppercase">
                      {(column as any).user?.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                  )}
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
                    onClick={() => {
                      setSelectedProject(project);
                      setShowDetail(true);
                    }}
                    onDelete={() => setProjectToDelete(project)}
                    onEdit={() => setProjectToEdit(project)}
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
        project={selectedProject && !showDetail ? selectedProject : null} 
        onClose={() => setSelectedProject(null)} 
        users={users}
        projects={projects}
        onUpdateProject={handleUpdateInnovation}
      />

      <EditInnovationCardModal 
        project={projectToEdit}
        onClose={() => setProjectToEdit(null)}
        users={users}
        onUpdate={async (updates) => {
          if (projectToEdit) {
             // We need to use handlesUpdateInnovation-like logic but for projectToEdit
             try {
                const previousStatus = projectToEdit.status;
                const projectWithUpdates = { ...projectToEdit, ...updates };
                const { status: autoStatus, progress: autoProgress } = calculateInnovationStatusAndProgress(projectWithUpdates);
                
                const finalUpdates = { ...updates, status: autoStatus, progress: autoProgress };

                if (onUpdateInnovationProject) {
                  await onUpdateInnovationProject(projectToEdit.id, finalUpdates);
                } else {
                  const projectRef = doc(db, 'innovationProjects', projectToEdit.id);
                  const fullUpdate = { ...projectToEdit, ...finalUpdates, updatedAt: new Date().toISOString() };
                  await setDoc(projectRef, fullUpdate);
                }
                
                if (finalUpdates.status && finalUpdates.status !== previousStatus) {
                  const fullUpdate = { ...projectToEdit, ...finalUpdates };
                  await logStatusChange(fullUpdate, previousStatus, finalUpdates.status as InnovationStatus);
                }
                setProjectToEdit(null);
             } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `innovationProjects/${projectToEdit.id}`);
             }
          }
        }}
      />

      <CreateInnovationProjectModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        users={users}
        projects={projects}
        onCreate={async (data) => {
          if (onAddInnovationProject) {
            await onAddInnovationProject(data);
            setIsCreateModalOpen(false);
          }
        }}
      />

      {/* Process Mapping Question Modal */}
      <AnimatePresence>
        {isMappingModalOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-slate-100"
            >
              {mappingStep === 'question' ? (
                <>
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Users size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Mapeamento de Processos</h3>
                  <p className="text-slate-500 text-center mb-8 font-medium">
                    Será necessário o mapeamento do time de processos?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setMappingStep('waiting')}
                      className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      SIM
                    </button>
                    <button 
                      onClick={() => {
                        setIsMappingModalOpen(false);
                        setIsCreateModalOpen(true);
                      }}
                      className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      NÃO
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Clock size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Atenção</h3>
                  <p className="text-slate-500 text-center mb-8 font-medium leading-relaxed">
                    Aguardar o mapeamento do time de processos antes de criar um novo card
                  </p>
                  <button 
                    onClick={() => setIsMappingModalOpen(false)}
                    className="w-full px-6 py-4 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Entendido
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EditInnovationCardModal({ 
  project, 
  onClose, 
  users, 
  onUpdate 
}: { 
  project: InnovationProject | null, 
  onClose: () => void,
  users: User[],
  onUpdate: (updates: Partial<InnovationProject>) => Promise<void>
}) {
  const [responsibleId, setResponsibleId] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Média');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (project) {
      setResponsibleId(project.responsibleId || '');
      setPriority(project.priority || 'Média');
      setDeadline(project.deadline || '');
      setDescription(project.description || '');
      setShowSuccess(false);
    }
  }, [project]);

  if (!project) return null;

  const handleSave = async () => {
    if (!responsibleId) return;
    setIsSaving(true);
    try {
      const user = users.find(u => u.id === responsibleId);
      await onUpdate({
        responsibleId,
        responsibleName: user?.name,
        priority,
        deadline,
        description
      });
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-0 top-0 z-50 p-4 bg-emerald-500 text-white text-center font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              Card atualizado com sucesso!
            </motion.div>
          )}

          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <Edit size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Editar Card</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Ajuste rápido</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                <UserIcon size={14} className="text-indigo-500" />
                Responsável <span className="text-rose-500">*</span>
              </label>
              <select 
                value={responsibleId}
                onChange={(e) => setResponsibleId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="">Selecione um responsável...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-500" />
                Descrição do Projeto
              </label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium h-24 resize-none text-sm"
              />
              <div className="flex justify-end pr-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{description.length}/500</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                <Target size={14} className="text-indigo-500" />
                Prioridade
              </label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-500" />
                Prazo de Conclusão
              </label>
              <input 
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
             <button 
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-100 transition-all font-black"
            >
              Cancelar
            </button>
             <button 
              onClick={handleSave}
              disabled={isSaving || !responsibleId}
              className={cn(
                "flex-1 px-6 py-3 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg font-black flex items-center justify-center gap-2",
                isSaving || !responsibleId ? "bg-slate-300 shadow-none cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
              )}
            >
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function InnovationCard({ project, onClick, onDelete, onEdit }: { project: InnovationProject, onClick: () => void, onDelete: () => void | Promise<void>, onEdit: () => void, key?: any }) {
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

  const statusColors = {
    'backlog': 'bg-slate-100 text-slate-700 border-slate-200',
    'análise': 'bg-amber-100 text-amber-700 border-amber-200',
    'planejamento': 'bg-blue-100 text-blue-700 border-blue-200',
    'desenvolvimento': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'teste': 'bg-purple-100 text-purple-700 border-purple-200',
    'concluído': 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };

  const statusLabels = {
    'backlog': 'Backlog',
    'análise': 'Análise',
    'planejamento': 'Planejamento',
    'desenvolvimento': 'Desenvolvimento',
    'teste': 'Teste',
    'concluído': 'Concluído'
  };

  const priorityColors = {
    'Baixa': 'bg-slate-100 text-slate-600',
    'Média': 'bg-indigo-100 text-indigo-600',
    'Alta': 'bg-rose-100 text-rose-600'
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
            statusColors[project.status]
          )}>
            {statusLabels[project.status]}
          </span>
          <span className={cn(
            "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md",
            priorityColors[project.priority || 'Baixa']
          )}>
            {project.priority || 'Baixa'}
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
            className="text-slate-300 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-50 transition-colors"
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
                  onClick={() => {
                    onEdit();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Edit size={16} />
                  Editar card
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

      <h4 className="font-bold text-slate-800 leading-tight mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
        {project.title}
      </h4>

      {project.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-4">
          {project.description}
        </p>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Responsável:</span>
            <span className="font-bold text-slate-700 truncate">{project.responsibleName || 'Pendente'}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Projeto:</span>
            <span className="font-bold text-slate-700 truncate">{project.projectName}</span>
          </div>
          {/* Opcional: Processo se houver */}
          {project.processName && (
            <div className="flex items-center gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Processo:</span>
              <span className="font-bold text-slate-700 truncate">{project.processName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-indigo-500" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold text-slate-400">Criado em</span>
              <span>{format(new Date(project.createdAt), 'dd/MM/yyyy')}</span>
            </div>
          </div>
          {project.deadline && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <div className="flex flex-col">
                <span className="text-[8px] uppercase font-bold text-slate-400">Prazo</span>
                <span>{format(new Date(project.deadline + 'T12:00:00'), 'dd/MM/yyyy')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>{project.progress || 0}%</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
            <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold uppercase text-center">
              {(project.responsibleName || 'SR').split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-[9px] font-medium truncate max-w-[60px]">{project.responsibleName?.split(' ')[0] || 'Pendente'}</span>
          </div>
        </div>

        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${project.progress || 0}%` }}
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              (project.progress || 0) === 100 ? "bg-emerald-500" : (project.progress || 0) > 30 ? "bg-indigo-500" : "bg-amber-500"
            )}
          />
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Gestão de Inovações</p>
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Descrição do projeto</label>
                <textarea 
                  value={project.description || ''}
                  onChange={(e) => onUpdateProject({ description: e.target.value })}
                  maxLength={500}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium h-24 resize-none text-sm"
                />
                <div className="flex justify-end pr-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{(project.description || '').length}/500</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Status (Automático)</label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-400 font-bold text-sm cursor-not-allowed">
                    {statusColumns.find(c => c.id === project.status)?.label || project.status}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Progresso</label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-indigo-600 font-black text-sm cursor-not-allowed text-center">
                    {project.progress || 0}%
                  </div>
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

function CreateInnovationProjectModal({ 
  isOpen, 
  onClose, 
  users, 
  projects,
  onCreate 
}: { 
  isOpen: boolean, 
  onClose: () => void,
  users: User[],
  projects: Project[],
  onCreate: (data: any) => Promise<void>
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Média');
  const [deadline, setDeadline] = useState('');
  const [complexity, setComplexity] = useState<InnovationComplexity>('Média');
  const [solutionType, setSolutionType] = useState<InnovationSolutionType | ''>('Implantação de tecnologias');
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSubtaskId, setSelectedSubtaskId] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!title || !responsibleId) return;
    setIsSaving(true);
    try {
      const respUser = users.find(u => u.id === responsibleId);
      const proj = projects.find(p => p.id === selectedProjectId);
      const subtask = proj?.subtasks.find(s => s.id === selectedSubtaskId);

      await onCreate({
        title,
        description,
        responsibleId,
        responsibleName: respUser?.name || 'Sem resp.',
        priority,
        deadline,
        complexity,
        type: 'Implantação de tecnologias',
        status: 'backlog',
        progress: 0,
        projectId: selectedProjectId,
        projectName: proj?.name || '',
        pdcaId: '', 
        actionId: '',
        processName: subtask?.title || '',
      });
      setTitle('');
      setDescription('');
      setResponsibleId('');
      setPriority('Média');
      setDeadline('');
      setComplexity('Média');
      setSolutionType('Implantação de tecnologias');
      setSelectedProjectId('');
      setSelectedSubtaskId('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Novo Projeto de Inovação</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Criar manualmente</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Título do Projeto <span className="text-rose-500">*</span></label>
                <input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Novo sistema de triagem automática"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 text-[11px]">Descrição do projeto</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição dos objetivos e escopo da inovação..."
                  maxLength={500}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium h-32 resize-none"
                />
                <div className="flex justify-end">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    description.length > 450 ? "text-rose-500" : "text-slate-400"
                  )}>
                    {description.length} / 500
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Responsável <span className="text-rose-500">*</span></label>
                <select 
                  value={responsibleId}
                  onChange={(e) => setResponsibleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">Selecione o responsável...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Prioridade</label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Tipo de Solução</label>
                <div className="relative">
                  <input 
                    type="text"
                    value="Implantação de tecnologias"
                    readOnly
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 outline-none font-bold cursor-not-allowed"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <ShieldCheck size={18} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-1">Campo obrigatório e padronizado pelo sistema.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Complexidade estimada</label>
                <select 
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Muito Alta">Muito Alta</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Previsão de conclusão</label>
                <input 
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Vincular a Projeto (Opcional)</label>
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">Nenhum</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {selectedProjectId && (
                <div className="md:col-span-2 space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Vincular a Etapa/Processo (Opcional)</label>
                  <select 
                    value={selectedSubtaskId}
                    onChange={(e) => setSelectedSubtaskId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">Nenhum</option>
                    {projects.find(p => p.id === selectedProjectId)?.subtasks.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
             <button 
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
            >
              Cancelar
            </button>
             <button 
              onClick={handleCreate}
              disabled={isSaving || !title || !responsibleId}
              className={cn(
                "flex-[2] px-8 py-4 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2",
                isSaving || !title || !responsibleId ? "bg-slate-300 shadow-none cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
              )}
            >
              {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              Criar Projeto de Inovação
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

