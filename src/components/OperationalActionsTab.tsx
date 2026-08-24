import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronDown, 
  X, 
  Download,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  CalendarDays,
  MoreVertical,
  Save,
  Trash2,
  LayoutGrid,
  List,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { notifyActionChanges } from '../lib/notificationService';
import { Project, User, OperationalAction, ProjectPriority } from '../types';
import { cn, exportarCSVPadrao, cleanObject } from '../lib/utils';
import { db, setDoc, doc, deleteDoc, handleFirestoreError, OperationType, auth } from '../firebase';
import { calculateActionAlert } from '../utils/calculations';
import { logFeature, logMelhoria } from '../lib/changelogService';
import { logUserActivity } from '../lib/activityLogger';
import ActionOverviewSection from './ActionOverviewSection';

interface OperationalActionsTabProps {
  actions: OperationalAction[];
  projects: Project[];
  users: User[];
  targetActionId?: string;
  isDeadlineAlertFilter?: boolean;
  navigationSource?: 'notification_deadline' | 'notification_action' | 'menu' | string;
  key?: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: { id: string; label: string }[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  searchable?: boolean;
}

function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  searchable = false
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const norm = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return options.filter(o => 
      o.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(norm)
    );
  }, [options, searchTerm, searchable]);

  const toggleOption = (id: string) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter(v => v !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const selectAll = () => {
    onChange(options.map(o => o.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  const buttonText = useMemo(() => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const match = options.find(o => o.id === selectedValues[0]);
      return match ? match.label : placeholder;
    }
    return `${label} (${selectedValues.length})`;
  }, [selectedValues, options, placeholder, label]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-theme-background border border-theme-border text-theme-foreground rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium flex items-center justify-between gap-2 transition-all cursor-pointer",
          selectedValues.length > 0 && "border-indigo-500 text-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 font-bold"
        )}
      >
        <span className="truncate">{buttonText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Limpar seleção"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-theme-card border border-theme-border rounded-2xl shadow-xl z-[100] max-h-72 flex flex-col p-2 space-y-2 min-w-[220px]">
          {searchable && (
            <div className="relative px-1 pt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Buscar no filtro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-theme-background border border-theme-border text-theme-foreground rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex items-center justify-between px-2 text-[11px] font-bold text-slate-400 border-b border-theme-border pb-1.5">
            <button 
              type="button" 
              onClick={selectAll}
              className="hover:text-indigo-600 transition-colors"
            >
              Marcar todos
            </button>
            <button 
              type="button" 
              onClick={clearAll}
              className="hover:text-rose-600 transition-colors"
            >
              Limpar
            </button>
          </div>

          <div className="overflow-y-auto flex-1 space-y-0.5 custom-scrollbar pr-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(o => {
                const isSelected = selectedValues.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:bg-theme-background",
                      isSelected && "text-indigo-600 font-bold bg-indigo-50/50 dark:bg-indigo-950/30"
                    )}
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(o.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                );
              })
            ) : (
              <div className="px-2 py-3 text-center text-xs text-slate-400">
                Nenhuma opção encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFutureDateStr = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNormalizedAlertLabel = (action: { status: string; forecastDate: string; completionDate?: string }): string => {
  const alert = calculateActionAlert(action);
  if (alert === 'Dentro do prazo') return 'Sem alerta';
  return alert;
};

export default function OperationalActionsTab({ 
  actions, 
  projects, 
  users, 
  targetActionId,
  isDeadlineAlertFilter = false,
  navigationSource = 'menu'
}: OperationalActionsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionToDelete, setActionToDelete] = useState<OperationalAction | null>(null);
  const [showBlockedMessage, setShowBlockedMessage] = useState(false);
  
  // Multi-select filters (OR logic within filter, AND between filters)
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterResponsibles, setFilterResponsibles] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterDeadlineAlertOnly, setFilterDeadlineAlertOnly] = useState<boolean>(isDeadlineAlertFilter);

  // NOVO MODO DE VISUALIZAÇÃO: Visão Geral vs Lista de Ações
  const [viewMode, setViewMode] = useState<'overview' | 'list'>('overview');
  const [scopeMode, setScopeMode] = useState<'my_actions' | 'all_actions'>('my_actions');

  // NOVO FILTRO: Alerta de Prazo
  const [filterAlertStatuses, setFilterAlertStatuses] = useState<string[]>([]);

  // NOVO FILTRO: Previsão (Data de Previsão de Conclusão)
  const [forecastStartDate, setForecastStartDate] = useState<string>('');
  const [forecastEndDate, setForecastEndDate] = useState<string>('');
  const [forecastShortcut, setForecastShortcut] = useState<'all' | 'today' | 'next_7' | 'next_15' | 'next_30' | 'overdue' | 'custom'>('all');

  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [tempUpdates, setTempUpdates] = useState<Partial<OperationalAction>>({});
  const [actionToSave, setActionToSave] = useState<OperationalAction | null>(null);
  const [updatesToSave, setUpdatesToSave] = useState<Partial<OperationalAction>>({});
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});

  const prevNavRef = useRef<{ source: string; targetId?: string; isDeadline?: boolean }>({
    source: navigationSource,
    targetId: targetActionId,
    isDeadline: isDeadlineAlertFilter
  });

  const resetAllFilters = () => {
    setSearchTerm('');
    setFilterProjects([]);
    setFilterResponsibles([]);
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterDeadlineAlertOnly(false);
    setFilterAlertStatuses([]);
    setForecastStartDate('');
    setForecastEndDate('');
    setForecastShortcut('all');
  };

  const handleSelectForecastShortcut = (shortcut: 'all' | 'today' | 'next_7' | 'next_15' | 'next_30' | 'overdue') => {
    setForecastShortcut(shortcut);
    const today = getTodayStr();

    if (shortcut === 'all') {
      setForecastStartDate('');
      setForecastEndDate('');
    } else if (shortcut === 'today') {
      setForecastStartDate(today);
      setForecastEndDate(today);
    } else if (shortcut === 'next_7') {
      setForecastStartDate(today);
      setForecastEndDate(getFutureDateStr(7));
    } else if (shortcut === 'next_15') {
      setForecastStartDate(today);
      setForecastEndDate(getFutureDateStr(15));
    } else if (shortcut === 'next_30') {
      setForecastStartDate(today);
      setForecastEndDate(getFutureDateStr(30));
    } else if (shortcut === 'overdue') {
      setForecastStartDate('');
      setForecastEndDate('');
    }
  };

  useEffect(() => {
    const prev = prevNavRef.current;
    const navChanged =
      prev.source !== navigationSource ||
      prev.targetId !== targetActionId ||
      prev.isDeadline !== isDeadlineAlertFilter;

    if (navChanged) {
      prevNavRef.current = {
        source: navigationSource,
        targetId: targetActionId,
        isDeadline: isDeadlineAlertFilter
      };

      // Always clear search input when coming from navigation or notification
      setSearchTerm('');

      if (navigationSource === 'notification_deadline' || isDeadlineAlertFilter) {
        // Notification for deadline alert: reset project filter (global view) & show actions near deadline
        setFilterProjects([]);
        setFilterResponsibles([]);
        setFilterPriorities([]);
        setFilterStatuses([]);
        setFilterDeadlineAlertOnly(true);
        setFilterAlertStatuses([]);
        setForecastStartDate('');
        setForecastEndDate('');
        setForecastShortcut('all');
      } else if (navigationSource === 'notification_action') {
        // Notification for specific action: reset filters and scroll to target
        setFilterProjects([]);
        setFilterResponsibles([]);
        setFilterStatuses([]);
        setFilterPriorities([]);
        setFilterDeadlineAlertOnly(false);
        setFilterAlertStatuses([]);
        setForecastStartDate('');
        setForecastEndDate('');
        setForecastShortcut('all');
      } else {
        // Menu or clean entry: reset all filters completely
        setFilterProjects([]);
        setFilterResponsibles([]);
        setFilterStatuses([]);
        setFilterPriorities([]);
        setFilterDeadlineAlertOnly(false);
        setFilterAlertStatuses([]);
        setForecastStartDate('');
        setForecastEndDate('');
        setForecastShortcut('all');
      }
    }

    if (targetActionId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`action-row-${targetActionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [navigationSource, isDeadlineAlertFilter, targetActionId, actions]);

  const matchesArr = (arr: string[], val: string) => arr.length === 0 || arr.includes(val);

  const isAlertMatch = (action: OperationalAction) => {
    if (filterDeadlineAlertOnly) {
      if (action.status === 'Concluído') return false;
      const alert = calculateActionAlert(action);
      if (alert !== 'Próximo do vencimento' && alert !== 'Atrasado') return false;
    }

    if (filterAlertStatuses.length > 0) {
      const alertLabel = getNormalizedAlertLabel(action);
      const rawAlert = calculateActionAlert(action);
      const matched = filterAlertStatuses.includes(alertLabel) || filterAlertStatuses.includes(rawAlert);
      if (!matched) return false;
    }

    return true;
  };

  const isForecastMatch = (action: OperationalAction) => {
    const today = getTodayStr();

    if (forecastShortcut === 'overdue') {
      return action.status !== 'Concluído' && !!action.forecastDate && action.forecastDate < today;
    }

    if (forecastStartDate || forecastEndDate) {
      if (!action.forecastDate) return false;
      if (forecastStartDate && action.forecastDate < forecastStartDate) return false;
      if (forecastEndDate && action.forecastDate > forecastEndDate) return false;
    }

    return true;
  };

  // Dynamic filter options (Excel style - based on other filters)
  const availableProjects = useMemo(() => {
    const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    if (actions.length === 0) return sorted;
    const ids = new Set(
      actions.filter(a => {
        const matchesSearch = !searchTerm.trim() ||
          a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.subtaskTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesResponsible = matchesArr(filterResponsibles, a.responsibleId);
        const matchesStatus = matchesArr(filterStatuses, a.status);
        const matchesPriority = matchesArr(filterPriorities, a.priority);
        const matchesAlert = isAlertMatch(a);
        const matchesForecast = isForecastMatch(a);
        return matchesSearch && matchesResponsible && matchesStatus && matchesPriority && matchesAlert && matchesForecast;
      }).map(a => a.projectId)
    );
    filterProjects.forEach(id => ids.add(id));
    return sorted.filter(p => ids.has(p.id));
  }, [actions, searchTerm, filterProjects, filterResponsibles, filterStatuses, filterPriorities, filterDeadlineAlertOnly, filterAlertStatuses, forecastStartDate, forecastEndDate, forecastShortcut, projects]);

  const availableResponsibles = useMemo(() => {
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    if (actions.length === 0) return sorted;
    const ids = new Set(
      actions.filter(a => {
        const matchesSearch = !searchTerm.trim() ||
          a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.subtaskTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = matchesArr(filterProjects, a.projectId);
        const matchesStatus = matchesArr(filterStatuses, a.status);
        const matchesPriority = matchesArr(filterPriorities, a.priority);
        const matchesAlert = isAlertMatch(a);
        const matchesForecast = isForecastMatch(a);
        return matchesSearch && matchesProject && matchesStatus && matchesPriority && matchesAlert && matchesForecast;
      }).map(a => a.responsibleId)
    );
    filterResponsibles.forEach(id => ids.add(id));
    return sorted.filter(u => ids.has(u.id));
  }, [actions, searchTerm, filterProjects, filterResponsibles, filterStatuses, filterPriorities, filterDeadlineAlertOnly, filterAlertStatuses, forecastStartDate, forecastEndDate, forecastShortcut, users]);

  const availableStatuses = useMemo(() => {
    const allPossible = ['Pendente', 'Em andamento', 'Concluído', 'Pausado'];
    if (actions.length === 0) return allPossible;
    const statuses = new Set<string>(
      actions.filter(a => {
        const matchesSearch = !searchTerm.trim() ||
          a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.subtaskTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = matchesArr(filterProjects, a.projectId);
        const matchesResponsible = matchesArr(filterResponsibles, a.responsibleId);
        const matchesPriority = matchesArr(filterPriorities, a.priority);
        const matchesAlert = isAlertMatch(a);
        const matchesForecast = isForecastMatch(a);
        return matchesSearch && matchesProject && matchesResponsible && matchesPriority && matchesAlert && matchesForecast;
      }).map(a => a.status)
    );
    filterStatuses.forEach(s => statuses.add(s));
    return allPossible.filter(s => statuses.has(s));
  }, [actions, searchTerm, filterProjects, filterResponsibles, filterStatuses, filterPriorities, filterDeadlineAlertOnly, filterAlertStatuses, forecastStartDate, forecastEndDate, forecastShortcut]);

  const availablePriorities = useMemo(() => {
    const allPossible = ['Baixa', 'Média', 'Alta', 'Urgente'];
    if (actions.length === 0) return allPossible;
    const priorities = new Set<string>(
      actions.filter(a => {
        const matchesSearch = !searchTerm.trim() ||
          a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.subtaskTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = matchesArr(filterProjects, a.projectId);
        const matchesResponsible = matchesArr(filterResponsibles, a.responsibleId);
        const matchesStatus = matchesArr(filterStatuses, a.status);
        const matchesAlert = isAlertMatch(a);
        const matchesForecast = isForecastMatch(a);
        return matchesSearch && matchesProject && matchesResponsible && matchesStatus && matchesAlert && matchesForecast;
      }).map(a => a.priority)
    );
    filterPriorities.forEach(p => priorities.add(p));
    return allPossible.filter(p => priorities.has(p));
  }, [actions, searchTerm, filterProjects, filterResponsibles, filterStatuses, filterPriorities, filterDeadlineAlertOnly, filterAlertStatuses, forecastStartDate, forecastEndDate, forecastShortcut]);

  const availableAlertStatuses = useMemo(() => {
    const allPossible = [
      'Sem alerta',
      'Próximo do vencimento',
      'Atrasado',
      'Concluído no prazo',
      'Concluído fora do prazo'
    ];
    if (actions.length === 0) return allPossible;
    const found = new Set<string>();
    actions.forEach(a => {
      const matchesSearch = !searchTerm.trim() ||
        a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.subtaskTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = matchesArr(filterProjects, a.projectId);
      const matchesResponsible = matchesArr(filterResponsibles, a.responsibleId);
      const matchesStatus = matchesArr(filterStatuses, a.status);
      const matchesPriority = matchesArr(filterPriorities, a.priority);
      const matchesForecast = isForecastMatch(a);

      if (matchesSearch && matchesProject && matchesResponsible && matchesStatus && matchesPriority && matchesForecast) {
        found.add(getNormalizedAlertLabel(a));
      }
    });
    filterAlertStatuses.forEach(s => found.add(s));
    return allPossible.filter(s => found.has(s));
  }, [actions, searchTerm, filterProjects, filterResponsibles, filterStatuses, filterPriorities, forecastStartDate, forecastEndDate, forecastShortcut, filterAlertStatuses]);

  const filteredActions = useMemo(() => {
    return actions.filter(a => {
      const matchesSearch = !searchTerm.trim() ||
        a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.subtaskTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = matchesArr(filterProjects, a.projectId);
      const matchesResponsible = matchesArr(filterResponsibles, a.responsibleId);
      const matchesStatus = matchesArr(filterStatuses, a.status);
      const matchesPriority = matchesArr(filterPriorities, a.priority);
      const matchesAlert = isAlertMatch(a);
      const matchesForecast = isForecastMatch(a);
      
      return matchesSearch && matchesProject && matchesResponsible && matchesStatus && matchesPriority && matchesAlert && matchesForecast;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [actions, searchTerm, filterProjects, filterResponsibles, filterStatuses, filterPriorities, filterDeadlineAlertOnly, filterAlertStatuses, forecastStartDate, forecastEndDate, forecastShortcut]);

  // Usuário atualmente autenticado
  const currentLoggedInUser = useMemo(() => {
    if (!auth.currentUser) return null;
    return users.find(u => 
      (u.id && u.id.toLowerCase() === auth.currentUser?.uid.toLowerCase()) || 
      (u.email && auth.currentUser?.email && u.email.toLowerCase() === auth.currentUser.email.toLowerCase()) ||
      (u.name && auth.currentUser?.displayName && u.name.toLowerCase() === auth.currentUser.displayName.toLowerCase())
    ) || null;
  }, [users]);

  // Função auxiliar para verificar se o usuário logado possui vínculo com o projeto
  const isUserLinkedToProject = useCallback((project: Project, userObj: User | null, allOperationalActions: OperationalAction[]) => {
    if (!userObj && !auth.currentUser) return true;

    const currentUid = auth.currentUser?.uid?.trim().toLowerCase();
    const currentDbId = userObj?.id?.trim().toLowerCase();
    const currentName = (userObj?.name || auth.currentUser?.displayName || '').trim().toLowerCase();
    const currentEmail = (userObj?.email || auth.currentUser?.email || '').trim().toLowerCase();

    // 1. Atribuído diretamente ao projeto (assignedTo)
    if (project.assignedTo) {
      const assigned = project.assignedTo.trim().toLowerCase();
      if (currentUid && assigned === currentUid) return true;
      if (currentDbId && assigned === currentDbId) return true;
      if (currentEmail && assigned === currentEmail) return true;
      if (currentName && (assigned === currentName || assigned.includes(currentName) || currentName.includes(assigned))) return true;
    }

    // 2. Responsável pelo escopo do projeto (scope.responsible)
    if (project.scope?.responsible) {
      const resp = project.scope.responsible.trim().toLowerCase();
      if (currentName && (resp === currentName || resp.includes(currentName) || currentName.includes(resp))) return true;
      if (currentDbId && resp === currentDbId) return true;
      if (currentUid && resp === currentUid) return true;
      if (currentEmail && resp === currentEmail) return true;
    }

    // 3. Subtarefas e itens PDCA / 5W2H do projeto
    if (Array.isArray(project.subtasks)) {
      for (const sub of project.subtasks) {
        if (sub.responsibleId) {
          const subResp = sub.responsibleId.trim().toLowerCase();
          if (currentUid && subResp === currentUid) return true;
          if (currentDbId && subResp === currentDbId) return true;
          if (currentEmail && subResp === currentEmail) return true;
          if (currentName && (subResp === currentName || subResp.includes(currentName) || currentName.includes(subResp))) return true;
        }

        if (Array.isArray(sub.pdcaCycles)) {
          for (const cycle of sub.pdcaCycles) {
            if (Array.isArray(cycle.plan?.actionPlan)) {
              for (const item of cycle.plan.actionPlan) {
                if (item.who) {
                  const who = item.who.trim().toLowerCase();
                  if (currentName && (who === currentName || who.includes(currentName) || currentName.includes(who))) return true;
                  if (currentDbId && who === currentDbId) return true;
                  if (currentUid && who === currentUid) return true;
                }
              }
            }
          }
        }
      }
    }

    // 4. Qualquer ação operacional cadastrada neste projeto atribuída ao usuário
    if (Array.isArray(allOperationalActions)) {
      const hasAction = allOperationalActions.some(a => {
        if (a.projectId !== project.id) return false;
        const actRespId = (a.responsibleId || '').trim().toLowerCase();
        const actRespName = (a.responsibleName || '').trim().toLowerCase();
        if (currentUid && actRespId === currentUid) return true;
        if (currentDbId && actRespId === currentDbId) return true;
        if (currentName && actRespName && actRespName === currentName) return true;
        if (currentEmail && actRespName && actRespName === currentEmail) return true;
        return false;
      });
      if (hasAction) return true;
    }

    return false;
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== '' ||
      filterProjects.length > 0 ||
      filterResponsibles.length > 0 ||
      filterStatuses.length > 0 ||
      filterPriorities.length > 0 ||
      filterDeadlineAlertOnly ||
      filterAlertStatuses.length > 0 ||
      forecastStartDate !== '' ||
      forecastEndDate !== '' ||
      forecastShortcut !== 'all'
    );
  }, [
    searchTerm,
    filterProjects,
    filterResponsibles,
    filterStatuses,
    filterPriorities,
    filterDeadlineAlertOnly,
    filterAlertStatuses,
    forecastStartDate,
    forecastEndDate,
    forecastShortcut
  ]);

  // Ações com escopo (Minhas Ações -> Somente ações atribuídas ao usuário logado; Todas as Ações -> Todas as ações)
  const scopedFilteredActions = useMemo(() => {
    if (scopeMode === 'all_actions') {
      return filteredActions;
    }
    const currentUid = auth.currentUser?.uid?.trim().toLowerCase();
    const currentDbId = currentLoggedInUser?.id?.trim().toLowerCase();
    const currentName = (currentLoggedInUser?.name || auth.currentUser?.displayName || '').trim().toLowerCase();
    const currentEmail = (auth.currentUser?.email || '').trim().toLowerCase();

    return filteredActions.filter(a => {
      const actRespId = (a.responsibleId || '').trim().toLowerCase();
      const actRespName = (a.responsibleName || '').trim().toLowerCase();

      if (currentUid && actRespId === currentUid) return true;
      if (currentDbId && actRespId === currentDbId) return true;
      if (currentName && actRespName && actRespName === currentName) return true;
      if (currentEmail && actRespName && actRespName === currentEmail) return true;
      return false;
    });
  }, [filteredActions, scopeMode, currentLoggedInUser]);

  // Projetos com escopo (Minhas Ações -> Projetos vinculados ao usuário; Todas as Ações -> Todos os projetos)
  const scopedProjects = useMemo(() => {
    let baseProjects = projects;

    if (scopeMode === 'my_actions') {
      baseProjects = projects.filter(p => isUserLinkedToProject(p, currentLoggedInUser, actions));
    }

    // Se houver filtros ativos, mantemos apenas os projetos que possuem pelo menos 1 ação no resultado filtrado
    if (hasActiveFilters) {
      const activeProjectIds = new Set(scopedFilteredActions.map(a => a.projectId));
      return baseProjects.filter(p => activeProjectIds.has(p.id));
    }

    return baseProjects;
  }, [projects, scopeMode, currentLoggedInUser, actions, isUserLinkedToProject, hasActiveFilters, scopedFilteredActions]);

  const handleQuickComplete = (action: OperationalAction) => {
    const today = getTodayStr();
    setActionToSave(action);
    setUpdatesToSave({
      status: 'Concluído',
      completionDate: today
    });
  };

  const handleUpdateAction = async (id: string, updates: Partial<OperationalAction>) => {
    try {
      const actionRef = doc(db, 'operationalActions', id);
      const action = actions.find(a => a.id === id);
      if (action) {
        // Log follow-up history
        const originalFeedback = action.feedback || '';
        const newFeedback = (updates.feedback || '').trim();
        
        let updatedHistory = action.historicoTratativas ? [...action.historicoTratativas] : [];
        if (originalFeedback.trim() !== '' && newFeedback !== originalFeedback.trim()) {
          const loggedInUser = users.find(u => u.id === auth.currentUser?.uid);
          const currentUserName = loggedInUser?.name || auth.currentUser?.email || 'Usuário';
          
          updatedHistory.push({
            texto: originalFeedback,
            usuario: currentUserName,
            data: new Date().toISOString()
          });
        }
        
        const finalUpdates = {
          ...updates,
          ...(updatedHistory.length > 0 ? { historicoTratativas: updatedHistory } : {})
        };

        const finalAction = cleanObject({ ...action, ...finalUpdates });
        await setDoc(actionRef, finalAction);
        notifyActionChanges(action, finalAction, auth.currentUser?.uid);

        logUserActivity({
          userId: auth.currentUser?.uid || '',
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário',
          userEmail: auth.currentUser?.email || '',
          actionType: 'operational_action',
          actionName: 'Atualização de Ação Operacional',
          details: `Atualizou a ação operacional '${finalAction.action}'`,
          entityId: finalAction.id,
          entityName: finalAction.action
        });
        if (updatedHistory.length > (action.historicoTratativas?.length || 0)) {
          logFeature('Inclusão do histórico de interações nas ações', 'Ações', '💬');
        } else {
          logMelhoria('Atualização do status e detalhes da ação operacional', 'Ações', '⚡');
        }
        setEditingActionId(null);
        setTempUpdates({});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `operationalActions/${id}`);
    }
  };

  const handleConfirmSave = (id: string, updates: Partial<OperationalAction>) => {
    const action = actions.find(a => a.id === id);
    if (action) {
      setActionToSave(action);
      setUpdatesToSave(updates);
    }
  };

  const onConfirmSave = async () => {
    if (!actionToSave) return;
    await handleUpdateAction(actionToSave.id, updatesToSave);
    setActionToSave(null);
    setUpdatesToSave({});
  };

  const startEditing = (action: OperationalAction) => {
    if (action.status === 'Concluído') {
      alert('Ações concluídas não podem ser editadas.');
      return;
    }
    setEditingActionId(action.id);
    setTempUpdates({
      status: action.status,
      feedback: action.feedback || '',
      completionDate: action.completionDate || ''
    });
  };

  const handleConfirmDelete = async () => {
    if (!actionToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'operationalActions', actionToDelete.id));
      setActionToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `operationalActions/${actionToDelete.id}`);
    }
  };

  const handleDeleteClick = (action: OperationalAction) => {
    if (action.status === 'Concluído') {
      setShowBlockedMessage(true);
      setTimeout(() => setShowBlockedMessage(false), 3000);
      return;
    }
    setActionToDelete(action);
  };

  const exportToCSV = () => {
    const headers = ['Projeto', 'Subtarefa', 'Responsável', 'Ação', 'Prioridade', 'Status', 'Previsão', 'Conclusão', 'Retorno'];
    const rows = filteredActions.map(a => [
      a.projectName,
      a.subtaskTitle || 'Sem Subtarefa',
      a.responsibleName,
      a.action,
      a.priority,
      a.status,
      a.forecastDate,
      a.completionDate || '',
      a.feedback || ''
    ]);

    const fileName = `historico_acoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    exportarCSVPadrao(headers, rows, fileName);
  };

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-[50] bg-theme-background/95 backdrop-blur-sm -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 mb-4 border-b border-theme-border flex flex-col gap-6 shadow-sm transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Histórico de Ações</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Gestão de tratativas e ações operacionais do setor.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Modo: Visão Geral vs Lista */}
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                  viewMode === 'overview'
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                )}
              >
                <LayoutGrid size={15} />
                <span>Visão Geral</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                  viewMode === 'list'
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                )}
              >
                <List size={15} />
                <span>Lista de Ações</span>
              </button>
            </div>

            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer h-[38px]"
            >
              <Download size={16} />
              Exportar CSV
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 dark:shadow-none cursor-pointer h-[38px]"
            >
              <Plus size={16} />
              Nova Ação
            </button>
          </div>
        </div>

        {/* Filtros com Múltipla Seleção */}
        <div className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Filter size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Filtros de Busca (Múltipla Seleção)</span>
              </div>
              <button
                type="button"
                onClick={() => setFilterDeadlineAlertOnly(prev => !prev)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                  filterDeadlineAlertOnly
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                )}
              >
                <AlertCircle size={14} />
                <span>Próximas do Vencimento / Atrasadas</span>
              </button>
            </div>
            {(filterProjects.length > 0 || filterResponsibles.length > 0 || filterStatuses.length > 0 || filterPriorities.length > 0 || filterAlertStatuses.length > 0 || searchTerm || filterDeadlineAlertOnly || forecastStartDate || forecastEndDate || forecastShortcut !== 'all') && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X size={14} />
                Limpar Todos os Filtros
              </button>
            )}
          </div>

          {filterDeadlineAlertOnly && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-900 dark:text-amber-200 text-xs font-bold shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
                <span>
                  Filtro Ativo: Exibindo apenas ações com <strong>Alerta de Vencimento</strong> (Próximas do Vencimento ou Atrasadas) — Visualização Global (Todos os Projetos)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilterDeadlineAlertOnly(false)}
                className="text-xs bg-amber-200/60 hover:bg-amber-200 dark:bg-amber-800/60 dark:hover:bg-amber-800 px-3 py-1 rounded-xl transition-colors cursor-pointer text-amber-900 dark:text-amber-100 font-bold"
              >
                Remover Filtro
              </button>
            </div>
          )}

          {/* Grid de Filtros Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 min-w-0">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Buscar ação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-theme-background border border-theme-border text-theme-foreground rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-[38px]"
              />
            </div>
            
            <MultiSelectFilter 
              label="Projetos"
              placeholder="Todos os Projetos"
              options={availableProjects.map(p => ({ id: p.id, label: p.name }))}
              selectedValues={filterProjects}
              onChange={setFilterProjects}
              searchable={true}
            />

            <MultiSelectFilter 
              label="Responsáveis"
              placeholder="Todos os Responsáveis"
              options={availableResponsibles.map(u => ({ id: u.id, label: u.name }))}
              selectedValues={filterResponsibles}
              onChange={setFilterResponsibles}
              searchable={true}
            />

            <MultiSelectFilter 
              label="Status"
              placeholder="Todos os Status"
              options={availableStatuses.map(s => ({ id: s, label: s }))}
              selectedValues={filterStatuses}
              onChange={setFilterStatuses}
            />

            <MultiSelectFilter 
              label="Prioridades"
              placeholder="Todas as Prioridades"
              options={availablePriorities.map(p => ({ id: p, label: p }))}
              selectedValues={filterPriorities}
              onChange={setFilterPriorities}
            />

            <MultiSelectFilter 
              label="Alerta de Prazo"
              placeholder="Todos os Alertas"
              options={availableAlertStatuses.map(a => ({ id: a, label: a }))}
              selectedValues={filterAlertStatuses}
              onChange={setFilterAlertStatuses}
            />
          </div>

          {/* Sub-painel: Filtro por Previsão de Conclusão */}
          <div className="pt-3 border-t border-theme-border/60 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mr-1">
                <Calendar size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Previsão:</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleSelectForecastShortcut('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    forecastShortcut === 'all' && !forecastStartDate && !forecastEndDate
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectForecastShortcut('today')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    forecastShortcut === 'today'
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectForecastShortcut('next_7')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    forecastShortcut === 'next_7'
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  Próximos 7 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectForecastShortcut('next_15')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    forecastShortcut === 'next_15'
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  Próximos 15 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectForecastShortcut('next_30')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    forecastShortcut === 'next_30'
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  Próximos 30 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectForecastShortcut('overdue')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                    forecastShortcut === 'overdue'
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  )}
                >
                  <Clock size={12} />
                  <span>Atrasadas</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start xl:self-auto">
              <span className="text-xs font-bold text-slate-400 shrink-0">Intervalo:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={forecastStartDate}
                  onChange={(e) => {
                    setForecastStartDate(e.target.value);
                    setForecastShortcut('custom');
                  }}
                  className="px-2.5 py-1 bg-theme-background border border-theme-border text-theme-foreground rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                  title="Data de Previsão Inicial"
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  type="date"
                  value={forecastEndDate}
                  onChange={(e) => {
                    setForecastEndDate(e.target.value);
                    setForecastShortcut('custom');
                  }}
                  className="px-2.5 py-1 bg-theme-background border border-theme-border text-theme-foreground rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                  title="Data de Previsão Final"
                />
                {(forecastStartDate || forecastEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setForecastStartDate('');
                      setForecastEndDate('');
                      setForecastShortcut('all');
                    }}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    title="Limpar intervalo de datas"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Visão Geral vs Lista de Ações */}
      {viewMode === 'overview' ? (
        <ActionOverviewSection
          actions={scopedFilteredActions}
          projects={scopedProjects}
          scopeMode={scopeMode}
          hasActiveFilters={hasActiveFilters}
          onScopeModeChange={setScopeMode}
          editingActionId={editingActionId}
          tempUpdates={tempUpdates}
          onStartEditing={startEditing}
          onCancelEditing={() => {
            setEditingActionId(null);
            setTempUpdates({});
          }}
          onTempUpdateChange={(updates) => setTempUpdates(prev => ({ ...prev, ...updates }))}
          onSaveAction={(id, updates) => handleConfirmSave(id, updates)}
          onDeleteClick={handleDeleteClick}
          onQuickComplete={handleQuickComplete}
          onCreateActionClick={() => setIsModalOpen(true)}
          targetActionId={targetActionId}
        />
      ) : (
        /* Listagem em Tabela */
        <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden">
          {/* Header da Tabela com Seletor de Escopo Rápido */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-theme-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <List size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                Lista Tabular de Ações ({scopedFilteredActions.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <button
                type="button"
                onClick={() => setScopeMode('my_actions')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  scopeMode === 'my_actions'
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                )}
              >
                Minhas Ações
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('all_actions')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  scopeMode === 'all_actions'
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                )}
              >
                Todas as Ações
              </button>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-350px)] custom-scrollbar">
            <table className="w-full text-left border-separate border-spacing-0 min-w-[1600px]">
              <thead className="sticky top-0 z-[40]">
                <tr className="bg-indigo-600 dark:bg-indigo-900">
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[200px] z-[41] border-b border-white/10">Projeto</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[180px] z-[41] border-b border-white/10">Subtarefa</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[180px] z-[41] border-b border-white/10">Responsável</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[350px] z-[41] border-b border-white/10">Ação</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[120px] z-[41] border-b border-white/10">Prioridade</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[160px] z-[41] border-b border-white/10">Status</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[120px] z-[41] border-b border-white/10">Previsão</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[300px] z-[41] border-b border-white/10">Retorno da Tratativa</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[160px] z-[41] border-b border-white/10">Data de Conclusão</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[180px] z-[41] border-b border-white/10">Alerta de Prazo</th>
                  <th className="sticky top-0 bg-indigo-600 dark:bg-indigo-900 px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest w-32 text-right z-[41] border-b border-white/10">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {scopedFilteredActions.map((action) => {
                  const isEditing = editingActionId === action.id;
                  const currentStatus = isEditing ? (tempUpdates.status || action.status) : action.status;
                  const currentFeedback = isEditing ? (tempUpdates.feedback || action.feedback) : action.feedback;
                  const currentCompletionDate = isEditing ? (tempUpdates.completionDate || action.completionDate) : action.completionDate;

                  return (
                    <tr 
                      key={action.id} 
                      id={`action-row-${action.id}`}
                      className={cn(
                        "group transition-all duration-300",
                        isEditing ? "bg-indigo-500/5" : "hover:bg-theme-background/50",
                        targetActionId === action.id && "ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 font-bold shadow-md"
                      )}
                    >
                    <td className={cn(
                      "px-6 py-4 min-w-0 transition-all text-theme-foreground",
                      isEditing && "border-l-4 border-indigo-500"
                    )}>
                      <span className="font-bold text-[13px] break-words line-clamp-2" title={action.projectName}>{action.projectName}</span>
                    </td>
                    <td className="px-6 py-4 min-w-0">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider break-words line-clamp-2" title={action.subtaskTitle || 'Sem Subtarefa'}>
                        {action.subtaskTitle || 'Sem Subtarefa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px] font-black shrink-0">
                          {(action.responsibleName || 'U').charAt(0)}
                        </div>
                        <span className="text-[13px] font-bold text-slate-400 truncate">{action.responsibleName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="bg-theme-background p-3 rounded-xl border border-theme-border group-hover:bg-theme-card transition-colors">
                        <p className="text-[13px] text-theme-foreground leading-relaxed min-h-[40px]">{action.action}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider inline-block",
                        action.priority === 'Urgente' ? "bg-red-500/15 text-red-500 dark:bg-red-500/25 dark:text-red-400 font-extrabold border border-red-500/20" :
                        action.priority === 'Alta' ? "bg-rose-500/10 text-rose-500" :
                        action.priority === 'Média' ? "bg-indigo-500/10 text-indigo-400" :
                        "bg-theme-background border border-theme-border text-slate-400"
                      )}>
                        {action.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        disabled={!isEditing}
                        value={currentStatus}
                        onChange={(e) => setTempUpdates(prev => ({ ...prev, status: e.target.value as any }))}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none border border-transparent focus:border-indigo-400 disabled:cursor-not-allowed transition-all text-theme-foreground",
                          currentStatus === 'Concluído' ? "bg-emerald-500/10 text-emerald-500" :
                          currentStatus === 'Em andamento' ? "bg-amber-500/10 text-amber-500" :
                          currentStatus === 'Pausado' ? "bg-slate-500/15 text-slate-500 dark:text-slate-400" :
                          "bg-theme-background text-slate-400"
                        )}
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Em andamento">Em andamento</option>
                        <option value="Concluído">Concluído</option>
                        <option value="Pausado">Pausado</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 whitespace-nowrap">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-[11px] font-bold">
                          {action.forecastDate ? format(new Date(action.forecastDate), 'dd/MM/yyyy') : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <textarea 
                        disabled={!isEditing}
                        value={currentFeedback || ''}
                        onChange={(e) => setTempUpdates(prev => ({ ...prev, feedback: e.target.value }))}
                        placeholder="Descreva o retorno da tratativa..."
                        className="w-full bg-slate-50/50 p-3 rounded-xl text-[13px] text-slate-600 outline-none border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all resize-none min-h-[80px] leading-relaxed disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                      {action.historicoTratativas && action.historicoTratativas.length > 0 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedHistoryIds(prev => ({
                                ...prev,
                                [action.id]: !prev[action.id]
                              }));
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <History size={12} />
                            {expandedHistoryIds[action.id] ? 'Ocultar histórico' : `Ver histórico (${action.historicoTratativas.length})`}
                          </button>
                          {expandedHistoryIds[action.id] && (
                            <div className="mt-2 space-y-2 border-l-2 border-indigo-200 pl-3 py-1">
                              {action.historicoTratativas.map((item, hIdx) => (
                                <div key={hIdx} className="text-xs space-y-0.5">
                                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span className="font-bold text-slate-600">{item.usuario}</span>
                                    <span>{item.data ? format(new Date(item.data), 'dd/MM/yyyy HH:mm') : ''}</span>
                                  </div>
                                  <p className="text-slate-500 italic text-[11px]">{item.texto}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input 
                          type="date"
                          value={currentCompletionDate || ''}
                          onChange={(e) => setTempUpdates(prev => ({ ...prev, completionDate: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500">
                          {action.completionDate ? format(new Date(action.completionDate), 'dd/MM/yyyy') : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const alert = calculateActionAlert(action);
                        let badgeStyle = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
                        if (alert === 'Dentro do prazo') {
                          badgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                        } else if (alert === 'Próximo do vencimento') {
                          badgeStyle = "bg-amber-500/10 text-amber-600/90 dark:text-amber-400";
                        } else if (alert === 'Atrasado') {
                          badgeStyle = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
                        } else if (alert === 'Concluído no prazo') {
                          badgeStyle = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
                        } else if (alert === 'Concluído fora do prazo') {
                          badgeStyle = "bg-violet-500/10 text-violet-600 dark:text-violet-400";
                        }

                        return (
                          <span className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider inline-block whitespace-nowrap",
                            badgeStyle
                          )}>
                            {alert}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={() => handleConfirmSave(action.id, tempUpdates)}
                              className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm border border-emerald-100 cursor-pointer"
                              title="Salvar"
                            >
                              <Save size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingActionId(null);
                                setTempUpdates({});
                              }}
                              className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-100 cursor-pointer"
                              title="Cancelar"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => startEditing(action)}
                            disabled={action.status === 'Concluído'}
                            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-indigo-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:hover:border-transparent cursor-pointer"
                            title="Editar"
                          >
                            <MoreVertical size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteClick(action)}
                          className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-100 cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {scopedFilteredActions.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300">
                        <History size={32} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-600 dark:text-slate-300">Nenhuma ação encontrada</p>
                        <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros, alternar o escopo ou crie uma nova ação.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <CreateActionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={projects}
        users={users}
      />

      {/* Alerta de Ação Bloqueada */}
      <AnimatePresence>
        {showBlockedMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-[200] bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 font-bold border border-rose-500"
          >
            <AlertCircle size={20} />
            <span>Ações concluídas não podem ser excluídas.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {actionToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Confirmar Exclusão</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Tem certeza que deseja excluir esta ação? Esta operação não poderá ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setActionToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Não, voltar
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 cursor-pointer"
                >
                  Sim, excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Salvamento */}
      <AnimatePresence>
        {actionToSave && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionToSave(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Save size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Salvar Alterações</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Deseja realmente salvar as alterações feitas nesta ação?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setActionToSave(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={onConfirmSave}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchableProjectSelect({
  projects,
  value,
  onChange
}: {
  projects: Project[];
  value: string;
  onChange: (projectId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find(p => p.id === value);

  // Alphabetically sorted projects (A -> Z)
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => 
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [projects]);

  // Accent and case insensitive filter
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return sortedProjects;
    const normSearch = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return sortedProjects.filter(p => {
      const normName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normName.includes(normSearch);
    });
  }, [sortedProjects, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div 
        className={cn(
          "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus-within:ring-2 focus-within:ring-indigo-500 flex items-center gap-2 cursor-pointer transition-all",
          isOpen && "ring-2 ring-indigo-500 bg-white"
        )}
        onClick={() => setIsOpen(true)}
      >
        <Search size={16} className="text-slate-400 shrink-0" />
        <input 
          type="text"
          value={isOpen ? searchQuery : (selectedProject ? selectedProject.name : '')}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchQuery('');
          }}
          placeholder="Buscar ou selecionar projeto..."
          className="w-full bg-transparent outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setSearchQuery('');
            }}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            title="Limpar seleção"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={16} className={cn("text-slate-400 transition-transform shrink-0", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-[120] max-h-60 overflow-y-auto py-2 divide-y divide-slate-100">
          {filteredProjects.length > 0 ? (
            filteredProjects.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setSearchQuery('');
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between cursor-pointer",
                  p.id === value ? "bg-indigo-50/70 text-indigo-600 font-bold" : "text-slate-700"
                )}
              >
                <span className="truncate">{p.name}</span>
                {p.id === value && <CheckCircle2 size={16} className="text-indigo-600 shrink-0 ml-2" />}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 text-center font-medium">
              Nenhum projeto encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateActionModal({ isOpen, onClose, projects, users }: { isOpen: boolean, onClose: () => void, projects: Project[], users: User[] }) {
  const [projectId, setProjectId] = useState('');
  const [subtaskId, setSubtaskId] = useState('');
  const [action, setAction] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Média');
  const [forecastDate, setForecastDate] = useState(new Date().toISOString().split('T')[0]);

  const selectedProject = projects.find(p => p.id === projectId);
  const subtasks = selectedProject?.subtasks || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !action || !responsibleId) {
      alert('Por favor, preencha todos os campos obrigatórios (Projeto, Ação e Responsável).');
      return;
    }

    const selectedSubtask = subtasks.find(s => s.id === subtaskId);
    const selectedResponsible = users.find(u => u.id === responsibleId);

    const newAction: OperationalAction = {
      id: uuidv4(),
      projectId,
      projectName: selectedProject?.name || '',
      subtaskId: subtaskId || '',
      subtaskTitle: selectedSubtask ? selectedSubtask.title : 'Sem Subtarefa',
      action,
      responsibleId,
      responsibleName: selectedResponsible?.name || '',
      priority,
      status: 'Pendente',
      forecastDate,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'operationalActions', newAction.id), newAction);
      notifyActionChanges(null, newAction, auth.currentUser?.uid);

      logUserActivity({
        userId: auth.currentUser?.uid || '',
        userName: auth.currentUser?.displayName || 'Usuário',
        userEmail: auth.currentUser?.email || '',
        actionType: 'operational_action',
        actionName: 'Criação de Ação Operacional',
        details: `Criou a ação operacional '${newAction.action}'`,
        entityId: newAction.id,
        entityName: newAction.action
      });
      onClose();
      // Reset form
      setProjectId('');
      setSubtaskId('');
      setAction('');
      setResponsibleId('');
      setPriority('Média');
      setForecastDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `operationalActions/${newAction.id}`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Nova Ação Operacional</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Registro de Tratativa</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Projeto *</label>
                  <SearchableProjectSelect
                    projects={projects}
                    value={projectId}
                    onChange={(id) => {
                      setProjectId(id);
                      setSubtaskId('');
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                    Subtarefa <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <select 
                    disabled={!projectId}
                    value={subtaskId}
                    onChange={(e) => setSubtaskId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm disabled:opacity-50"
                  >
                    <option value="">Sem Subtarefa (Geral do Projeto)</option>
                    {subtasks.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Ação a ser realizada *</label>
                <textarea 
                  required
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="Descreva detalhadamente a ação..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Responsável *</label>
                  <select 
                    required
                    value={responsibleId}
                    onChange={(e) => setResponsibleId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                  >
                    <option value="">Selecionar Responsável</option>
                    {[...users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Prioridade *</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Previsão de Conclusão *</label>
                <input 
                  type="date"
                  required
                  value={forecastDate}
                  onChange={(e) => setForecastDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 cursor-pointer"
                >
                  Criar Ação
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
