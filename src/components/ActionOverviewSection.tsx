import React, { useState, useMemo } from 'react';
import { 
  AlertCircle, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Folder, 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown, 
  Layers, 
  User, 
  Plus, 
  Sparkles,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, OperationalAction } from '../types';
import { cn } from '../lib/utils';
import { calculateActionAlert } from '../utils/calculations';
import ActionOverviewCard from './ActionOverviewCard';

export type ProjectOperationalStatus = 'delayed' | 'attention' | 'on_time' | 'no_open';

export interface ProjectGroupData {
  project: Project;
  actions: OperationalAction[];
  status: ProjectOperationalStatus;
  totalCount: number;
  openCount: number;
  delayedCount: number;
  todayCount: number;
  attentionCount: number;
  completedCount: number;
}

interface ActionOverviewSectionProps {
  actions: OperationalAction[];
  projects: Project[];
  scopeMode: 'my_actions' | 'all_actions';
  hasActiveFilters?: boolean;
  onScopeModeChange: (mode: 'my_actions' | 'all_actions') => void;
  editingActionId: string | null;
  tempUpdates: Partial<OperationalAction>;
  onStartEditing: (action: OperationalAction) => void;
  onCancelEditing: () => void;
  onTempUpdateChange: (updates: Partial<OperationalAction>) => void;
  onSaveAction: (id: string, updates: Partial<OperationalAction>) => void;
  onDeleteClick: (action: OperationalAction) => void;
  onQuickComplete: (action: OperationalAction) => void;
  onCreateActionClick: () => void;
  targetActionId?: string;
}

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ActionOverviewSection({
  actions,
  projects,
  scopeMode,
  hasActiveFilters = false,
  onScopeModeChange,
  editingActionId,
  tempUpdates,
  onStartEditing,
  onCancelEditing,
  onTempUpdateChange,
  onSaveAction,
  onDeleteClick,
  onQuickComplete,
  onCreateActionClick,
  targetActionId
}: ActionOverviewSectionProps) {
  const todayStr = getTodayDateStr();
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | ProjectOperationalStatus>('all');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  // Calculations for dynamic top summary
  const summary = useMemo(() => {
    const total = actions.length;
    const openActions = actions.filter(a => a.status !== 'Concluído');
    const delayed = openActions.filter(a => calculateActionAlert(a) === 'Atrasado').length;
    const today = openActions.filter(a => a.forecastDate === todayStr).length;
    const attention = openActions.filter(a => calculateActionAlert(a) === 'Próximo do vencimento' && a.forecastDate !== todayStr).length;
    const inProgress = openActions.filter(a => a.status === 'Em andamento').length;
    const pending = openActions.filter(a => a.status === 'Pendente').length;
    const completed = actions.filter(a => a.status === 'Concluído').length;

    const openProjectsSet = new Set(openActions.map(a => a.projectId));

    return {
      total,
      openCount: openActions.length,
      openProjectsCount: openProjectsSet.size,
      delayed,
      today,
      attention,
      inProgress,
      pending,
      completed
    };
  }, [actions, todayStr]);

  // Group actions by project and calculate operational status
  const projectGroups = useMemo<ProjectGroupData[]>(() => {
    const map = new Map<string, OperationalAction[]>();
    
    // Group actions
    actions.forEach(action => {
      const existing = map.get(action.projectId) || [];
      existing.push(action);
      map.set(action.projectId, existing);
    });

    // Determine which projects to include in the overview:
    // When hasActiveFilters is TRUE: ONLY projects that have at least 1 action matching active filters are displayed
    // When hasActiveFilters is FALSE:
    // - all_actions: all permitted projects
    // - my_actions: all projects linked to the user
    const eligibleProjects = projects.filter(p => {
      if (hasActiveFilters) {
        const projectActions = map.get(p.id) || [];
        return projectActions.length > 0;
      }
      return true;
    });

    // Create group data for eligible projects
    const groups: ProjectGroupData[] = eligibleProjects.map(p => {
      const projectActions = map.get(p.id) || [];
      const openActions = projectActions.filter(a => a.status !== 'Concluído');
      const delayedCount = openActions.filter(a => calculateActionAlert(a) === 'Atrasado').length;
      const todayCount = openActions.filter(a => a.forecastDate === todayStr).length;
      const attentionCount = openActions.filter(a => calculateActionAlert(a) === 'Próximo do vencimento' && a.forecastDate !== todayStr).length;
      const completedCount = projectActions.filter(a => a.status === 'Concluído').length;

      let status: ProjectOperationalStatus = 'no_open';
      if (delayedCount > 0) {
        status = 'delayed';
      } else if (todayCount > 0 || attentionCount > 0) {
        status = 'attention';
      } else if (openActions.length > 0) {
        status = 'on_time';
      } else {
        status = 'no_open';
      }

      return {
        project: p,
        actions: projectActions,
        status,
        totalCount: projectActions.length,
        openCount: openActions.length,
        delayedCount,
        todayCount,
        attentionCount,
        completedCount
      };
    });

    // Sort: Delayed first -> Attention -> On time -> No open actions
    const statusPriority: Record<ProjectOperationalStatus, number> = {
      delayed: 1,
      attention: 2,
      on_time: 3,
      no_open: 4
    };

    return groups.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return a.project.name.localeCompare(b.project.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [actions, projects, todayStr, hasActiveFilters]);

  // Expand project that contains the targetActionId automatically
  React.useEffect(() => {
    if (targetActionId) {
      const targetAction = actions.find(a => a.id === targetActionId);
      if (targetAction) {
        setExpandedProjectIds(prev => ({
          ...prev,
          [targetAction.projectId]: true
        }));
      }
    }
  }, [targetActionId, actions]);

  // Filter project groups by tab
  const filteredProjectGroups = useMemo(() => {
    if (projectStatusFilter === 'all') {
      return projectGroups;
    }
    return projectGroups.filter(g => g.status === projectStatusFilter);
  }, [projectGroups, projectStatusFilter]);

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjectIds(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const areAllExpanded = useMemo(() => {
    if (filteredProjectGroups.length === 0) return false;
    return filteredProjectGroups.every(g => expandedProjectIds[g.project.id]);
  }, [filteredProjectGroups, expandedProjectIds]);

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      // Collapse all
      setExpandedProjectIds({});
    } else {
      // Expand all in current view
      const all: Record<string, boolean> = {};
      filteredProjectGroups.forEach(g => {
        all[g.project.id] = true;
      });
      setExpandedProjectIds(all);
    }
  };

  // Status counts for project tabs
  const projectStatusCounts = useMemo(() => {
    return {
      all: projectGroups.length,
      delayed: projectGroups.filter(g => g.status === 'delayed').length,
      attention: projectGroups.filter(g => g.status === 'attention').length,
      on_time: projectGroups.filter(g => g.status === 'on_time').length,
      no_open: projectGroups.filter(g => g.status === 'no_open').length
    };
  }, [projectGroups]);

  return (
    <div className="space-y-6">
      {/* Dynamic Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Atrasadas */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all duration-200 shadow-xs",
          summary.delayed > 0 
            ? "bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/20" 
            : "bg-theme-card border-theme-border"
        )}>
          <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
            <span className="uppercase tracking-wider">Atrasadas</span>
            <AlertCircle size={16} className={summary.delayed > 0 ? "animate-pulse" : ""} />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{summary.delayed}</p>
          <span className="text-[10px] text-slate-400 font-medium">Fora do prazo</span>
        </div>

        {/* Vencem Hoje */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all duration-200 shadow-xs",
          summary.today > 0 
            ? "bg-amber-500/15 border-amber-500/30 dark:bg-amber-950/20" 
            : "bg-theme-card border-theme-border"
        )}>
          <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
            <span className="uppercase tracking-wider">Vencem Hoje</span>
            <Clock size={16} />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{summary.today}</p>
          <span className="text-[10px] text-slate-400 font-medium">Prazo até hoje</span>
        </div>

        {/* Próximas do Vencimento */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all duration-200 shadow-xs",
          summary.attention > 0 
            ? "bg-amber-500/10 border-amber-500/25 dark:bg-amber-950/15" 
            : "bg-theme-card border-theme-border"
        )}>
          <div className="flex items-center justify-between text-xs font-bold text-amber-600/90 dark:text-amber-400 mb-1">
            <span className="uppercase tracking-wider">Próx. Vencimento</span>
            <Calendar size={16} />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{summary.attention}</p>
          <span className="text-[10px] text-slate-400 font-medium">Em até 2 dias</span>
        </div>

        {/* Em Andamento */}
        <div className="p-4 rounded-2xl bg-theme-card border border-theme-border shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
            <span className="uppercase tracking-wider">Em Andamento</span>
            <Clock size={16} />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{summary.inProgress}</p>
          <span className="text-[10px] text-slate-400 font-medium">Em execução</span>
        </div>

        {/* Pendentes */}
        <div className="p-4 rounded-2xl bg-theme-card border border-theme-border shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
            <span className="uppercase tracking-wider">Pendentes</span>
            <Layers size={16} />
          </div>
          <p className="text-2xl font-black text-slate-700 dark:text-slate-300">{summary.pending}</p>
          <span className="text-[10px] text-slate-400 font-medium">Aguardando início</span>
        </div>

        {/* Concluídas */}
        <div className="p-4 rounded-2xl bg-theme-card border border-theme-border shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="uppercase tracking-wider">Concluídas</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{summary.completed}</p>
          <span className="text-[10px] text-slate-400 font-medium">Finalizadas</span>
        </div>
      </div>

      {/* Contextual Subtitle & Scope Switcher Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {scopeMode === 'my_actions' ? 'Organizador de Minhas Ações' : 'Visão Geral de Todas as Ações'}
            </h3>
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
            {scopeMode === 'my_actions' ? (
              <>
                Você possui <span className="text-indigo-600 dark:text-indigo-400 font-black">{summary.openCount} {summary.openCount === 1 ? 'ação aberta' : 'ações abertas'}</span> em <span className="text-indigo-600 dark:text-indigo-400 font-black">{summary.openProjectsCount} {summary.openProjectsCount === 1 ? 'projeto' : 'projetos'}</span>.
              </>
            ) : (
              <>
                Existem <span className="text-indigo-600 dark:text-indigo-400 font-black">{summary.openCount} {summary.openCount === 1 ? 'ação aberta' : 'ações abertas'}</span> em <span className="text-indigo-600 dark:text-indigo-400 font-black">{summary.openProjectsCount} {summary.openProjectsCount === 1 ? 'projeto' : 'projetos'}</span> no total.
              </>
            )}
          </p>
        </div>

        {/* Scope Switcher Pill Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onScopeModeChange('my_actions')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
              scopeMode === 'my_actions'
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-indigo-600"
            )}
          >
            Minhas Ações
          </button>
          <button
            type="button"
            onClick={() => onScopeModeChange('all_actions')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
              scopeMode === 'all_actions'
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-indigo-600"
            )}
          >
            Todas as Ações
          </button>
        </div>
      </div>

      {/* Project Filter Tabs & Expand All Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setProjectStatusFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
              projectStatusFilter === 'all'
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-theme-card text-slate-600 dark:text-slate-400 border-theme-border hover:bg-theme-background"
            )}
          >
            Todos os Projetos ({projectStatusCounts.all})
          </button>

          <button
            type="button"
            onClick={() => setProjectStatusFilter('delayed')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
              projectStatusFilter === 'delayed'
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : "bg-theme-card text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50/50"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Atrasados ({projectStatusCounts.delayed})</span>
          </button>

          <button
            type="button"
            onClick={() => setProjectStatusFilter('attention')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
              projectStatusFilter === 'attention'
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-theme-card text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 hover:bg-amber-50/50"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Atenção ({projectStatusCounts.attention})</span>
          </button>

          <button
            type="button"
            onClick={() => setProjectStatusFilter('on_time')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
              projectStatusFilter === 'on_time'
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-theme-card text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50/50"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Em Dia ({projectStatusCounts.on_time})</span>
          </button>

          <button
            type="button"
            onClick={() => setProjectStatusFilter('no_open')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
              projectStatusFilter === 'no_open'
                ? "bg-slate-700 text-white border-slate-700 shadow-xs"
                : "bg-theme-card text-slate-500 border-theme-border hover:bg-theme-background"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Sem Ações Abertas ({projectStatusCounts.no_open})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={toggleExpandAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card border border-theme-border text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-theme-background transition-all shadow-xs cursor-pointer"
        >
          <ChevronsUpDown size={14} />
          <span>{areAllExpanded ? 'Recolher Todos' : 'Expandir Todos'}</span>
        </button>
      </div>

      {/* List of Grouped Project Cards */}
      <div className="space-y-4">
        {filteredProjectGroups.map((group) => {
          const isExpanded = !!expandedProjectIds[group.project.id];

          // Project status visual definitions
          let statusBadgeText = "Sem Ações Abertas";
          let statusBadgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
          let statusDot = "bg-slate-400";

          if (group.status === 'delayed') {
            statusBadgeText = "ATRASADO";
            statusBadgeClass = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
            statusDot = "bg-rose-500 animate-pulse";
          } else if (group.status === 'attention') {
            statusBadgeText = "ATENÇÃO";
            statusBadgeClass = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
            statusDot = "bg-amber-500";
          } else if (group.status === 'on_time') {
            statusBadgeText = "EM DIA";
            statusBadgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
            statusDot = "bg-emerald-500";
          }

          return (
            <div
              key={group.project.id}
              className={cn(
                "bg-theme-card rounded-3xl border transition-all duration-300 overflow-hidden shadow-xs",
                group.status === 'delayed' && "border-rose-300/80 dark:border-rose-900/60 ring-1 ring-rose-500/10",
                group.status === 'attention' && "border-amber-300/80 dark:border-amber-900/60",
                group.status === 'on_time' && "border-emerald-300/60 dark:border-emerald-900/40",
                group.status === 'no_open' && "border-theme-border opacity-90"
              )}
            >
              {/* Project Card Header (Clickable to expand/collapse) */}
              <div
                onClick={() => toggleProjectExpand(group.project.id)}
                className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-theme-background/50 transition-colors select-none"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm",
                    group.status === 'delayed' ? "bg-rose-600 shadow-rose-200/50" :
                    group.status === 'attention' ? "bg-amber-600 shadow-amber-200/50" :
                    group.status === 'on_time' ? "bg-emerald-600 shadow-emerald-200/50" :
                    "bg-slate-400"
                  )}>
                    <Folder size={20} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="text-base font-black text-slate-900 dark:text-white truncate" title={group.project.name}>
                        {group.project.name}
                      </h4>
                      
                      {/* Project Operational Status Badge */}
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                        statusBadgeClass
                      )}>
                        <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot)} />
                        <span>{statusBadgeText}</span>
                      </span>
                    </div>

                    {group.project.scope?.responsible && (
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        Líder: <span className="text-slate-600 dark:text-slate-300 font-bold">{group.project.scope.responsible}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Project Summary Counter Chips & Chevron */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {/* Total de ações */}
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">
                    {group.totalCount} {group.totalCount === 1 ? 'Ação' : 'Ações'}
                  </span>

                  {group.delayedCount > 0 && (
                    <span className="px-3 py-1 bg-rose-500 text-white rounded-xl text-xs font-black shadow-xs">
                      {group.delayedCount} Atrasada{group.delayedCount > 1 ? 's' : ''}
                    </span>
                  )}

                  {group.todayCount > 0 && (
                    <span className="px-3 py-1 bg-amber-500 text-white rounded-xl text-xs font-black shadow-xs">
                      {group.todayCount} Vence{group.todayCount > 1 ? 'm' : ''} Hoje
                    </span>
                  )}

                  {group.attentionCount > 0 && (
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold">
                      {group.attentionCount} Próxima{group.attentionCount > 1 ? 's' : ''}
                    </span>
                  )}

                  {group.completedCount > 0 && (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/20">
                      {group.completedCount} Concluída{group.completedCount > 1 ? 's' : ''}
                    </span>
                  )}

                  <div className="p-2 rounded-xl bg-theme-background text-slate-400 hover:text-slate-600 transition-colors ml-1">
                    <ChevronDown size={18} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                  </div>
                </div>
              </div>

              {/* Project Card Content: Actions Grid */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-theme-border/60 bg-theme-background/30 p-5 sm:p-6"
                  >
                    {group.actions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {group.actions.map(action => (
                          <ActionOverviewCard
                            key={action.id}
                            action={action}
                            isEditing={editingActionId === action.id}
                            tempUpdates={tempUpdates}
                            onStartEditing={onStartEditing}
                            onCancelEditing={onCancelEditing}
                            onTempUpdateChange={onTempUpdateChange}
                            onSaveAction={onSaveAction}
                            onDeleteClick={onDeleteClick}
                            onQuickComplete={onQuickComplete}
                            isTarget={targetActionId === action.id}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-theme-card rounded-2xl border border-dashed border-theme-border p-6">
                        <p className="text-xs font-bold text-slate-500">
                          {scopeMode === 'my_actions'
                            ? 'Nenhuma ação atribuída a você neste projeto no momento.'
                            : 'Nenhuma ação cadastrada neste projeto no escopo selecionado.'}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filteredProjectGroups.length === 0 && (
          <div className="py-16 text-center bg-theme-card rounded-3xl border border-theme-border p-8 space-y-4">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {hasActiveFilters
                  ? 'Nenhuma ação ou projeto encontrado'
                  : scopeMode === 'my_actions' 
                    ? 'Você não possui ações abertas no momento!' 
                    : 'Nenhum projeto encontrado'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'Nenhum projeto ou ação corresponde aos filtros selecionados. Tente ajustar os filtros ou limpá-los.'
                  : scopeMode === 'my_actions'
                    ? 'Todas as suas atividades estão em dia ou não há ações atribuídas a você no momento.'
                    : 'Tente ajustar os filtros selecionados ou crie uma nova ação.'}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              {scopeMode === 'my_actions' && (
                <button
                  type="button"
                  onClick={() => onScopeModeChange('all_actions')}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Ver Todas as Ações
                </button>
              )}
              <button
                type="button"
                onClick={onCreateActionClick}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={16} />
                Nova Ação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
