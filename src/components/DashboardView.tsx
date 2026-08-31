import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  LabelList,
  Label,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  ArrowUpRight,
  Activity,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Target,
  Briefcase,
  Search,
  Sparkles,
  Zap,
  Award,
  Calendar,
  Layers,
  ArrowDownRight,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Project, 
  User, 
  ProjectStatus,
  OperationalAction
} from '../types';
import { cn } from '../lib/utils';
import { calculateProjectProgress, getCardProgress } from '../lib/projectUtils';
import { 
  getPDCAFinancialResult, 
  getProjectFinancialSummary, 
  calculateAccumulatedFinancialResult, 
  getMonthlyFinancialEvolution, 
  getAllFinancialCycles 
} from '../utils/pdcaFinancialUtils';
import ActionsDashboardView from './ActionsDashboardView';
import FilterDropdown from './FilterDropdown';
import DetailedOverviewTab from './DetailedOverviewTab';
import ContextHelp from './ContextHelp';

interface DashboardViewProps {
  projects: Project[];
  users: User[];
  actions: OperationalAction[];
  onProjectClick: (id: string) => void;
  key?: string;
}

type PeriodFilterType = 'this_month' | 'this_year' | 'last_12_months' | 'all' | 'custom';

export default function DashboardView({ projects, users, actions, onProjectClick }: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'actions' | 'overview'>('projects');
  const [projectSubTab, setProjectSubTab] = useState<'geral' | 'ganhos'>('geral');
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showAllSectors, setShowAllSectors] = useState(false);

  // Filtro Temporal de Ganhos
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('this_year');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  const collaboratorOptions = useMemo(() => {
    return users.map(u => ({ id: u.id, label: u.name }));
  }, [users]);

  const statusOptions = useMemo(() => {
    return ['Planejamento', 'Em andamento', 'Em melhoria', 'Concluído'].map(s => ({ id: s, label: s }));
  }, []);

  const projectOptions = useMemo(() => {
    return projects.map(p => ({ id: p.id, label: p.name }));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchCollab = selectedCollaborators.length === 0 || selectedCollaborators.includes(p.assignedTo);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(p.status);
      const matchProject = selectedProjectIds.length === 0 || selectedProjectIds.includes(p.id);
      return matchCollab && matchStatus && matchProject;
    });
  }, [projects, selectedCollaborators, selectedStatuses, selectedProjectIds]);

  // Intervalo de Datas para o Filtro de Período (Resultado Realizado até a Data Atual)
  const dateRange = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    if (periodFilter === 'this_month') {
      const start = new Date(currentYear, now.getMonth(), 1);
      const end = now;
      return { 
        startDate: start, 
        endDate: end, 
        filterType: 'this_month',
        label: format(start, 'MMMM/yyyy', { locale: ptBR }) 
      };
    }

    if (periodFilter === 'this_year') {
      const start = new Date(currentYear, 0, 1);
      const end = now;
      return { 
        startDate: start, 
        endDate: end, 
        filterType: 'this_year',
        label: `Ano de ${currentYear}` 
      };
    }

    if (periodFilter === 'last_12_months') {
      // Janela móvel de 12 meses terminando no mês atual (ex: Set/25 a Ago/26)
      const start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
      const end = now;
      return { 
        startDate: start, 
        endDate: end, 
        filterType: 'last_12_months',
        label: 'Últimos 12 Meses' 
      };
    }

    if (periodFilter === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate + 'T00:00:00');
      const rawEnd = new Date(customEndDate + 'T23:59:59');
      // Limitado a hoje para resultado realizado
      const end = rawEnd > now ? now : rawEnd;
      return { 
        startDate: start, 
        endDate: end, 
        filterType: 'custom',
        label: `${format(start, 'dd/MM/yyyy')} a ${format(rawEnd, 'dd/MM/yyyy')}` 
      };
    }

    // 'all': Todo o histórico financeiro realizado até hoje (horizonte artificial 2035 removido)
    return { 
      startDate: new Date(2020, 0, 1), 
      endDate: now, 
      filterType: 'all',
      label: 'Todos os Períodos' 
    };
  }, [periodFilter, customStartDate, customEndDate]);

  // Cálculo Executivo de Ganhos e Resultados Financeiros no Período
  const gainsStats = useMemo(() => {
    let periodGains = 0;
    let periodLosses = 0;
    let totalRealizedHours = 0;
    const projectsWithFinancialData = new Set<string>();

    const allCycles = getAllFinancialCycles(filteredProjects, userMap);

    // Linhas para a Tabela Executiva
    const tableRows: Array<{
      projectId: string;
      projectTitle: string;
      projectStatus: string;
      assignedToName: string;
      cycleId: string;
      cycleName: string;
      subtaskTitle: string;
      financialResult: number;
      classification: 'GANHO' | 'PERDA' | 'SEM_VARIACAO' | 'NAO_APLICAVEL';
      financialType: string;
      financialPeriodicity: string;
      financialStartDate?: string;
      accumulatedInPeriod: number;
    }> = [];

    // Consolidação por Projeto para o Gráfico de Resultados
    const projectFinancialMap = new Map<string, {
      projectId: string;
      projectName: string;
      assignedToName: string;
      status: string;
      gains: number;
      losses: number;
      netBalance: number;
      accumulatedBalance: number;
    }>();

    filteredProjects.forEach(p => {
      const user = userMap.get(p.assignedTo);
      projectFinancialMap.set(p.id, {
        projectId: p.id,
        projectName: p.name,
        assignedToName: user?.name || 'Não atribuído',
        status: p.status,
        gains: 0,
        losses: 0,
        netBalance: 0,
        accumulatedBalance: 0,
      });

      // Contagem de horas de ações legadas/atuais
      (p.subtasks || []).forEach(st => {
        (st.pdcaCycles || []).forEach(c => {
          if (c.check?.realTimeGain) {
            totalRealizedHours += c.check.realTimeGain;
          }
          (c.plan?.actionPlan || []).forEach(a => {
            if (a.ativo !== false && a.realGains?.tangible) {
              a.realGains.tangible.forEach(t => {
                if (t.unit && (t.unit.toLowerCase().includes('hora') || t.unit.toLowerCase() === 'h')) {
                  totalRealizedHours += (t.value || 0);
                }
              });
            }
          });
        });
      });
    });

    allCycles.forEach(c => {
      const fin = c.financialResult;
      if (!fin.hasFinancialData && fin.financialResult === 0) return;

      projectsWithFinancialData.add(c.projectId);

      const accumVal = calculateAccumulatedFinancialResult(fin, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      if (accumVal > 0) {
        periodGains += accumVal;
      } else if (accumVal < 0) {
        periodLosses += Math.abs(accumVal);
      }

      // Atualiza mapa de projetos
      const projItem = projectFinancialMap.get(c.projectId);
      if (projItem) {
        if (accumVal > 0) projItem.gains += accumVal;
        else if (accumVal < 0) projItem.losses += Math.abs(accumVal);
        projItem.accumulatedBalance += accumVal;
        projItem.netBalance += fin.financialResult;
      }

      let periodicityStr = fin.financialType === 'Único' ? 'Único' : fin.financialPeriodicity;
      if (fin.financialPeriodicity === 'Outro' && fin.financialPeriodicityOther) {
        periodicityStr = `Outro (${fin.financialPeriodicityOther})`;
      }

      tableRows.push({
        projectId: c.projectId,
        projectTitle: c.projectTitle,
        projectStatus: c.projectStatus,
        assignedToName: c.assignedToName,
        cycleId: c.cycleId,
        cycleName: c.cycleName,
        subtaskTitle: c.subtaskTitle,
        financialResult: fin.financialResult,
        classification: fin.resultClassification,
        financialType: fin.financialType,
        financialPeriodicity: periodicityStr,
        financialStartDate: fin.financialStartDate,
        accumulatedInPeriod: accumVal,
      });
    });

    const periodNetBalance = periodGains - periodLosses;

    // Gráfico de Resultados Financeiros por Projeto (ordenado por saldo líquido acumulado)
    const projectFinancialRanking = Array.from(projectFinancialMap.values())
      .filter(p => p.accumulatedBalance !== 0 || p.netBalance !== 0 || projectsWithFinancialData.has(p.projectId))
      .sort((a, b) => b.accumulatedBalance - a.accumulatedBalance);

    // Evolução Mensal no Período Selecionado (somente realizado até hoje)
    const monthlyEvolution = getMonthlyFinancialEvolution(filteredProjects, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      filterType: dateRange.filterType,
    });

    return {
      periodGains,
      periodLosses,
      periodNetBalance,
      financialProjectsCount: projectsWithFinancialData.size,
      totalRealizedHours,
      tableRows,
      projectFinancialRanking,
      monthlyEvolution,
    };
  }, [filteredProjects, userMap, dateRange]);

  // Estatísticas da Visão Geral (Geral de Projetos)
  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const completed = filteredProjects.filter(p => p.status === 'Concluído').length;
    const inImprovement = filteredProjects.filter(p => p.status === 'Em melhoria').length;
    const inProgress = filteredProjects.filter(p => p.status === 'Em andamento').length;
    const planning = filteredProjects.filter(p => p.status === 'Planejamento').length;
    const backlog = filteredProjects.filter(p => p.status === 'Backlog').length;

    // Process Status Data for Pie Chart
    const processStatusData = [
      { name: 'Backlog', value: backlog, color: '#64748b' },
      { name: 'Planejamento', value: planning, color: '#EABE41' },
      { name: 'Em andamento', value: inProgress, color: '#3b82f6' },
      { name: 'Em melhoria', value: inImprovement, color: '#818cf8' },
      { name: 'Concluídos', value: completed, color: '#10b981' },
    ].filter(d => d.value > 0);

    // Collaborators Ranking
    const collaboratorCounts = filteredProjects.reduce((acc, p) => {
      acc[p.assignedTo] = (acc[p.assignedTo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const collaboratorRanking = users
      .filter(u => filteredProjects.some(p => p.assignedTo === u.id))
      .map(u => ({
        name: u.name,
        count: collaboratorCounts[u.id] || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Saldo Geral Consolidado (Fonte única de verdade via getProjectFinancialSummary)
    let totalGainValue = 0;
    const projectGainsMap: Record<string, { name: string; gain: number }> = {};

    filteredProjects.forEach(p => {
      const summary = getProjectFinancialSummary(p);
      if (summary.hasFinancialImpact || summary.netBalance !== 0) {
        projectGainsMap[p.id] = { name: p.name, gain: summary.netBalance };
        totalGainValue += summary.netBalance;
      }
    });

    const projectGains = Object.values(projectGainsMap)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 10);

    // Project Progress
    const projectProgressList = filteredProjects.map(p => ({
      id: p.id,
      name: p.name,
      priority: p.priority || 'Baixa',
      progress: getCardProgress(p)
    })).sort((a, b) => {
      const priorityOrder = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
      const valA = priorityOrder[a.priority] ?? 3;
      const valB = priorityOrder[b.priority] ?? 3;
      
      if (valA !== valB) return valA - valB;
      return b.progress - a.progress;
    });

    const avgProgress = total > 0 
      ? Math.round(projectProgressList.reduce((sum, p) => sum + p.progress, 0) / total) 
      : 0;

    // Recent Activity
    const activities: { type: string, title: string, date: string, projectName: string }[] = [];
    filteredProjects.forEach(p => {
      (p.subtasks || []).forEach(subtask => {
        subtask.pdcaCycles.forEach(c => {
          activities.push({
            type: c.status === 'Concluído' ? 'PDCA Concluído' : 'PDCA Iniciado',
            title: `${subtask.title}: ${c.title}`,
            date: c.createdAt,
            projectName: p.name
          });
        });
      });
    });
    const recentActivities = activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

    // Involved Sectors Analysis
    const sectorCounts = filteredProjects.reduce((acc, p) => {
      const sectors = p.scope.involvedSectors || [];
      const names = sectors.map(s => s.name?.trim()).filter(Boolean) as string[];
      const uniqueSectorNames = Array.from(new Set(names));
      
      uniqueSectorNames.forEach((name: string) => {
        acc[name] = (acc[name] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const sectorDistribution = Object.entries(sectorCounts)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      completed,
      planning,
      inImprovement,
      inProgress,
      processStatusData,
      collaboratorRanking,
      projectGains,
      totalGainValue,
      projectProgressList,
      avgProgress,
      recentActivities,
      sectorDistribution
    };
  }, [filteredProjects, users]);

  const displayedSectors = useMemo(() => {
    if (showAllSectors) return stats.sectorDistribution;
    return stats.sectorDistribution.slice(0, 10);
  }, [showAllSectors, stats.sectorDistribution]);

  const gainsXDomain = useMemo(() => {
    if (!stats.projectGains || stats.projectGains.length === 0) return [0, 100];
    const vals = stats.projectGains.map(g => g.gain);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    let min = minVal < 0 ? minVal * 1.35 : 0;
    let max = maxVal > 0 ? maxVal * 1.25 : (minVal < 0 ? 0 : 100);

    if (min === 0 && max === 0) {
      min = -100;
      max = 100;
    }
    return [min, max];
  }, [stats.projectGains]);

  const projectRankingDomain = useMemo(() => {
    if (!gainsStats.projectFinancialRanking || gainsStats.projectFinancialRanking.length === 0) return [0, 100];
    const vals = gainsStats.projectFinancialRanking.map(g => g.accumulatedBalance);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    let min = minVal < 0 ? minVal * 1.25 : 0;
    let max = maxVal > 0 ? maxVal * 1.25 : (minVal < 0 ? 0 : 100);

    if (min === 0 && max === 0) {
      min = -100;
      max = 100;
    }
    return [min, max];
  }, [gainsStats.projectFinancialRanking]);

  const renderGainBarLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value === undefined || value === null) return null;
    const isNegative = value < 0;
    const formatted = formatCurrency(value);
    const textX = isNegative ? x - 8 : x + width + 8;
    const anchor = isNegative ? 'end' : 'start';

    return (
      <text
        x={textX}
        y={y + height / 2}
        fill={isNegative ? '#f43f5e' : '#10b981'}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={800}
      >
        {formatted}
      </text>
    );
  };

  const renderYAxisGainTick = (props: any) => {
    const { x, y, payload } = props;
    const label = payload.value || '';
    const truncated = label.length > 14 ? `${label.slice(0, 14)}...` : label;

    return (
      <text
        x={x - 6}
        y={y}
        fill="#94a3b8"
        textAnchor="end"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
      >
        {truncated}
      </text>
    );
  };

  const toggleFilter = <T,>(current: T[], item: T, setter: (val: T[]) => void) => {
    if (current.includes(item)) {
      setter(current.filter(i => i !== item));
    } else {
      setter([...current, item]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Top Header com Abas Principais */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900">
              Painel de Inteligência
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-theme-foreground tracking-tight mt-1 flex items-center gap-3">
            Dashboard Estratégico
            <ContextHelp contentKey="dashboard" size="sm" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Métricas executivas, controle operacional e acompanhamento de ganhos financeiros.
          </p>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center gap-2 bg-theme-card p-1.5 rounded-2xl border border-theme-border shadow-xs self-start md:self-auto">
          <button
            onClick={() => setActiveTab('projects')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'projects'
                ? "bg-[#003489] text-white shadow-md"
                : "text-slate-400 hover:text-theme-foreground"
            )}
          >
            <Briefcase size={16} />
            Projetos
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'actions'
                ? "bg-[#003489] text-white shadow-md"
                : "text-slate-400 hover:text-theme-foreground"
            )}
          >
            <Activity size={16} />
            Ações
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'overview'
                ? "bg-[#003489] text-white shadow-md"
                : "text-slate-400 hover:text-theme-foreground"
            )}
          >
            <Sparkles size={16} />
            Visão Geral
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'projects' ? (
          <motion.div 
            key="projects-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Sub-Abas de Projetos */}
            <div className="flex items-center justify-between gap-4 border-b border-theme-border pb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setProjectSubTab('geral')}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
                    projectSubTab === 'geral'
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-theme-card border border-theme-border text-slate-400 hover:text-theme-foreground"
                  )}
                >
                  <Activity size={16} />
                  Visão Geral
                </button>
                <button
                  onClick={() => setProjectSubTab('ganhos')}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
                    projectSubTab === 'ganhos'
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-theme-card border border-theme-border text-slate-400 hover:text-theme-foreground"
                  )}
                >
                  <TrendingUp size={16} />
                  Ganhos & Impacto Financeiro
                </button>
              </div>

              {/* Seletor de Período (Visível apenas na aba de Ganhos) */}
              {projectSubTab === 'ganhos' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-theme-card border border-theme-border p-1 rounded-xl shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('this_month')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        periodFilter === 'this_month' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-theme-foreground"
                      )}
                    >
                      Este Mês
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('this_year')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        periodFilter === 'this_year' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-theme-foreground"
                      )}
                    >
                      Este Ano
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('last_12_months')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        periodFilter === 'last_12_months' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-theme-foreground"
                      )}
                    >
                      Últimos 12M
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('all')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        periodFilter === 'all' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-theme-foreground"
                      )}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodFilter('custom')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        periodFilter === 'custom' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-theme-foreground"
                      )}
                    >
                      Personalizado
                    </button>
                  </div>

                  {periodFilter === 'custom' && (
                    <div className="flex items-center gap-2 bg-theme-card border border-theme-border p-1.5 rounded-xl text-xs">
                      <input 
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="bg-transparent text-slate-700 dark:text-slate-200 text-xs px-2 py-1 rounded border border-theme-border"
                      />
                      <span className="text-slate-400">até</span>
                      <input 
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="bg-transparent text-slate-700 dark:text-slate-200 text-xs px-2 py-1 rounded border border-theme-border"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filtros Dropdown */}
            <div className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-4">
                <Filter size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Filtros Estratégicos</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FilterDropdown
                  label="Colaboradores"
                  placeholder="Selecionar colaboradores"
                  options={collaboratorOptions}
                  selected={selectedCollaborators}
                  onToggle={(id) => toggleFilter(selectedCollaborators, id, setSelectedCollaborators)}
                  onClear={() => setSelectedCollaborators([])}
                  icon={<Users size={16} />}
                />
                <FilterDropdown
                  label="Status"
                  placeholder="Selecionar status"
                  options={statusOptions}
                  selected={selectedStatuses}
                  onToggle={(id) => toggleFilter(selectedStatuses, id as ProjectStatus, setSelectedStatuses)}
                  onClear={() => setSelectedStatuses([])}
                  icon={<Target size={16} />}
                />
                <FilterDropdown
                  label="Projetos"
                  placeholder="Selecionar projetos"
                  options={projectOptions}
                  selected={selectedProjectIds}
                  onToggle={(id) => toggleFilter(selectedProjectIds, id, setSelectedProjectIds)}
                  onClear={() => setSelectedProjectIds([])}
                  icon={<Briefcase size={16} />}
                  showSearch
                />
              </div>
            </div>

            {projectSubTab === 'ganhos' ? (
              /* Visão Executiva de Ganhos e Resultados Financeiros */
              <div className="space-y-8">
                {/* 1. CARDS PRINCIPAIS EXECUTIVOS COM AJUDA CONTEXTUAL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                  <StatCard 
                    title="Ganhos no Período" 
                    value={gainsStats.periodGains} 
                    isCurrency
                    icon={<DollarSign size={18} />} 
                    color="bg-emerald-600" 
                    helpContentKey="ganhosNoPeriodo"
                    subtext={<span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Resultados Positivos</span>}
                  />
                  <StatCard 
                    title="Perdas no Período" 
                    value={gainsStats.periodLosses === 0 ? 0 : -gainsStats.periodLosses} 
                    isCurrency
                    icon={<ArrowDownRight size={18} />} 
                    color="bg-rose-600" 
                    helpContentKey="perdasNoPeriodo"
                    subtext={<span className="text-[10px] text-rose-500 font-bold">Aumentos / Variações Negativas</span>}
                  />
                  <StatCard 
                    title="Saldo Financeiro" 
                    value={gainsStats.periodNetBalance} 
                    isCurrency
                    icon={<TrendingUp size={18} />} 
                    color={gainsStats.periodNetBalance < 0 ? "bg-rose-600" : "bg-emerald-600"} 
                    helpContentKey="saldoFinanceiro"
                    subtext={<span className="text-[10px] text-slate-400 font-bold">Ganhos - Perdas ({dateRange.label})</span>}
                  />
                  <StatCard 
                    title="Projetos c/ Resultado" 
                    value={gainsStats.financialProjectsCount} 
                    icon={<Layers size={18} />} 
                    color="bg-indigo-600" 
                    helpContentKey="projetosComResultadoFinanceiro"
                    subtext={<span className="text-[10px] text-slate-400 font-bold">Projetos com PDCA Financeiro</span>}
                  />
                  <StatCard 
                    title="Horas Economizadas" 
                    value={`${gainsStats.totalRealizedHours}h`} 
                    icon={<Clock size={18} />} 
                    color="bg-amber-500" 
                    subtext={<span className="text-[10px] text-slate-400 font-bold">Eficiência Operacional</span>}
                  />
                </div>

                {/* 2. GRÁFICOS: RESULTADO POR PROJETO E EVOLUÇÃO FINANCEIRA */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full">
                  {/* Gráfico 1: Resultado Financeiro por Projeto */}
                  <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border border-theme-border shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base md:text-lg font-black text-theme-foreground uppercase tracking-tight flex items-center gap-2">
                          <TrendingUp size={20} className="text-emerald-500" />
                          Resultado Financeiro por Projeto
                          <ContextHelp contentKey="resultadoPorProjeto" size="xs" />
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Saldo líquido de melhorias por projeto ({dateRange.label}).
                        </p>
                      </div>
                    </div>

                    <div className="h-[280px] w-full">
                      {gainsStats.projectFinancialRanking.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={gainsStats.projectFinancialRanking.slice(0, 8)}
                            layout="vertical"
                            margin={{ left: 10, right: 80, top: 10, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" hide domain={projectRankingDomain} />
                            <YAxis 
                              dataKey="projectName" 
                              type="category" 
                              width={120} 
                              tick={renderYAxisGainTick}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                borderRadius: '12px', 
                                border: '1px solid #334155', 
                                color: '#ffffff',
                                padding: '8px 12px'
                              }}
                              labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                              formatter={(value: number) => [formatCurrency(value), 'Saldo no Período']}
                            />
                            <ReferenceLine x={0} stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" />
                            <Bar dataKey="accumulatedBalance" radius={[0, 8, 8, 0]} barSize={20}>
                              {gainsStats.projectFinancialRanking.slice(0, 8).map((entry, index) => (
                                <Cell 
                                  key={`cell-proj-${index}`} 
                                  fill={entry.accumulatedBalance < 0 ? '#f43f5e' : '#10b981'} 
                                />
                              ))}
                              <LabelList 
                                dataKey="accumulatedBalance" 
                                content={renderGainBarLabel}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                          Nenhum projeto com resultado financeiro no período.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gráfico 2: Evolução Financeira */}
                  <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border border-theme-border shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base md:text-lg font-black text-theme-foreground uppercase tracking-tight flex items-center gap-2">
                          <Activity size={20} className="text-indigo-500" />
                          Evolução Financeira
                          <ContextHelp contentKey="evolucaoFinanceira" size="xs" />
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Trajetória mensal de ganhos, perdas e saldo acumulado ({dateRange.label}).
                        </p>
                      </div>
                    </div>

                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={gainsStats.monthlyEvolution}
                          margin={{ left: 0, right: 10, top: 10, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis 
                            dataKey="month" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            tickFormatter={(val) => formatCompactValue(val, true)}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1e293b', 
                              borderRadius: '12px', 
                              border: '1px solid #334155', 
                              color: '#ffffff',
                              padding: '8px 12px'
                            }}
                            labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                            formatter={(value: number, name: string) => {
                              const labelMap: Record<string, string> = {
                                gains: 'Ganhos',
                                losses: 'Perdas',
                                netBalance: 'Saldo do Mês',
                                accumulatedBalance: 'Saldo Acumulado'
                              };
                              return [formatCurrency(value), labelMap[name] || name];
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '8px' }}
                            formatter={(value) => {
                              if (value === 'gains') return 'Ganhos';
                              if (value === 'losses') return 'Perdas';
                              if (value === 'accumulatedBalance') return 'Acumulado';
                              return value;
                            }}
                          />
                          <Bar dataKey="gains" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="losses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* 3. TABELA EXECUTIVA DE RESULTADOS FINANCEIROS */}
                <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border border-theme-border shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-500" />
                        Tabela Executiva de Resultados Financeiros
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Demonstrativo detalhado de cada PDCA com impacto financeiro reconhecido ({dateRange.label}).
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-400 bg-theme-background px-3 py-1.5 rounded-xl border border-theme-border self-start sm:self-auto">
                      {gainsStats.tableRows.length} Ciclos Mensurados
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-theme-border text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="py-4 px-4"># / Projeto & PDCA</th>
                          <th className="py-4 px-4">Responsável</th>
                          <th className="py-4 px-4 text-center">Resultado</th>
                          <th className="py-4 px-4 text-center">Tipo</th>
                          <th className="py-4 px-4 text-center">Periodicidade</th>
                          <th className="py-4 px-4 text-center">Início</th>
                          <th className="py-4 px-4 text-right">Acumulado no Período</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border text-xs font-medium">
                        {gainsStats.tableRows.map((row, idx) => {
                          const isGain = row.classification === 'GANHO' || row.financialResult > 0;
                          const isLoss = row.classification === 'PERDA' || row.financialResult < 0;
                          const isZero = row.classification === 'SEM_VARIACAO' || row.financialResult === 0;

                          return (
                            <tr 
                              key={`${row.projectId}_${row.cycleId}_${idx}`} 
                              onClick={() => onProjectClick(row.projectId)}
                              className="hover:bg-slate-50/5 dark:hover:bg-slate-800/20 transition-all cursor-pointer group"
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-lg bg-theme-background border border-theme-border flex items-center justify-center font-black text-[10px] text-slate-400">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <p className="font-bold text-theme-foreground group-hover:text-indigo-500 transition-colors">
                                      {row.projectTitle}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {row.subtaskTitle} • <span className="font-semibold text-slate-300">{row.cycleName}</span>
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 font-semibold text-slate-400">
                                {row.assignedToName}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className={cn(
                                    "font-black text-xs",
                                    isGain ? "text-emerald-600 dark:text-emerald-400" : isLoss ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                                  )}>
                                    {isGain ? '+' : ''}{formatCurrency(row.financialResult)}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-0.5",
                                    isGain ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : isLoss ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-slate-500/10 text-slate-400"
                                  )}>
                                    {isGain ? 'GANHO' : isLoss ? 'PERDA' : 'SEM VARIAÇÃO'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center font-bold text-slate-300">
                                {row.financialType}
                              </td>
                              <td className="py-4 px-4 text-center text-slate-400">
                                {row.financialPeriodicity}
                              </td>
                              <td className="py-4 px-4 text-center font-medium text-slate-400">
                                {row.financialStartDate ? (
                                  format(new Date(row.financialStartDate + 'T00:00:00'), 'dd/MM/yyyy')
                                ) : (
                                  <span className="italic text-[10px] text-slate-500">Não informada</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right font-black">
                                <span className={cn(
                                  "text-xs",
                                  row.accumulatedInPeriod > 0 ? "text-emerald-600 dark:text-emerald-400" : row.accumulatedInPeriod < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                                )}>
                                  {row.accumulatedInPeriod > 0 ? '+' : ''}{formatCurrency(row.accumulatedInPeriod)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {gainsStats.tableRows.length === 0 && (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                              Nenhum ciclo PDCA com dados financeiros encontrado com os filtros selecionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Visão Geral dos Projetos */
              <>
                {/* 1. Visão Geral e Indicadores Principais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                  <StatCard 
                    title="Ganho Geral" 
                    value={stats.totalGainValue} 
                    isCurrency
                    icon={<DollarSign size={18} />} 
                    color={stats.totalGainValue < 0 ? "bg-rose-600" : "bg-emerald-600"}
                    helpContentKey="saldoFinanceiro"
                    subtext={<span className="text-[10px] text-slate-400 font-bold">Saldo de Melhorias (R$)</span>}
                  />
                  <StatCard 
                    title="Total Projetos" 
                    value={stats.total} 
                    icon={<Briefcase size={18} />} 
                    color="bg-[#003489]" 
                  />
                  <StatCard 
                    title="Concluídos" 
                    value={stats.completed} 
                    icon={<CheckCircle2 size={18} />} 
                    color="bg-emerald-500" 
                  />
                  <StatCard 
                    title="Em Planejamento" 
                    value={stats.planning} 
                    icon={<Clock size={18} />} 
                    color="bg-[#EABE41]" 
                  />
                  <StatCard 
                    title="Em Melhoria" 
                    value={stats.inImprovement} 
                    icon={<TrendingUp size={18} />} 
                    color="bg-indigo-400" 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 w-full">
                  {/* 2. Impacto de Ganho por Projeto */}
                  <div className="bg-theme-card p-4 sm:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-theme-border shadow-sm space-y-6 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base md:text-lg font-black text-theme-foreground uppercase tracking-tight flex items-center gap-2">
                        Ganhos por Projeto
                        <ContextHelp contentKey="resultadoPorProjeto" size="xs" />
                      </h3>
                      <TrendingUp size={20} className="text-emerald-500" />
                    </div>
                    <div className="h-[250px] md:h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.projectGains}
                          layout="vertical"
                          margin={{ left: 10, right: 75, top: 10, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" hide domain={gainsXDomain} />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={120} 
                            tick={renderYAxisGainTick}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ 
                              backgroundColor: '#1e293b', 
                              borderRadius: '12px', 
                              border: '1px solid #334155', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                              color: '#ffffff',
                              padding: '8px 12px'
                            }}
                            itemStyle={{ color: '#ffffff' }}
                            labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                            formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                          />
                          <ReferenceLine x={0} stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" />
                          <Bar dataKey="gain" radius={[0, 8, 8, 0]} barSize={20}>
                            {stats.projectGains.map((entry, index) => (
                              <Cell 
                                key={`cell-gain-${index}`} 
                                fill={entry.gain < 0 ? '#f43f5e' : '#10b981'} 
                              />
                            ))}
                            <LabelList 
                              dataKey="gain" 
                              content={renderGainBarLabel}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 3. Status dos Processos */}
                  <div className="bg-theme-card p-8 rounded-[2.5rem] border border-theme-border shadow-sm space-y-6">
                    <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight">Distribuição de Status</h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.processStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                          >
                            {stats.processStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <Label 
                              value={stats.total} 
                              position="center" 
                              style={{ fontSize: '24px', fontWeight: 900, fill: 'var(--foreground)' }} 
                            />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1e293b', 
                              borderRadius: '12px', 
                              border: '1px solid #334155', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                              color: '#ffffff'
                            }}
                            itemStyle={{ color: '#ffffff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 4. Ranking de Colaboradores */}
                  <div className="bg-theme-card p-8 rounded-[2.5rem] border border-theme-border shadow-sm space-y-6">
                    <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight flex items-center justify-between">
                      <span>Colaboradores Ativos</span>
                      <Users size={20} className="text-indigo-500" />
                    </h3>
                    <div className="space-y-4">
                      {stats.collaboratorRanking.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-theme-background border border-theme-border">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 font-black text-xs flex items-center justify-center border border-indigo-500/20">
                              {i + 1}
                            </div>
                            <span className="text-xs font-bold text-theme-foreground">{c.name}</span>
                          </div>
                          <span className="text-xs font-black text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                            {c.count} {c.count === 1 ? 'projeto' : 'projetos'}
                          </span>
                        </div>
                      ))}
                      {stats.collaboratorRanking.length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-8">Nenhum dado encontrado</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Setores Envolvidos */}
                <div className="bg-theme-card p-8 rounded-[2.5rem] border border-theme-border shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight flex items-center gap-2">
                        Setores Envolvidos
                        <span className="text-xs font-bold text-slate-400 bg-theme-background px-2.5 py-0.5 rounded-full border border-theme-border">
                          {stats.sectorDistribution.length} Total
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Concentração de projetos por setor mapeado.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {displayedSectors.map((sector, idx) => (
                      <div 
                        key={idx} 
                        className="p-3.5 rounded-2xl bg-theme-background border border-theme-border flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-bold text-theme-foreground truncate" title={sector.name}>
                          {sector.name}
                        </span>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg shrink-0">
                          {sector.count}
                        </span>
                      </div>
                    ))}
                  </div>

                  {stats.sectorDistribution.length > 10 && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setShowAllSectors(!showAllSectors)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {showAllSectors ? 'Ver menos setores' : `Ver mais ${stats.sectorDistribution.length - 10} setores`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ) : activeTab === 'actions' ? (
          <motion.div
            key="actions-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ActionsDashboardView actions={actions} users={users} projects={projects} />
          </motion.div>
        ) : (
          <motion.div
            key="overview-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <DetailedOverviewTab projects={projects} users={users} onProjectClick={onProjectClick} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value);
}

function formatCompactValue(value: number, isCurrency: boolean = false) {
  const absValue = Math.abs(value);
  if (absValue < 1000) {
    return isCurrency ? formatCurrency(value) : value.toString();
  }

  let suffix = '';
  let divisor = 1;

  if (absValue >= 1e9) {
    suffix = 'B';
    divisor = 1e9;
  } else if (absValue >= 1e6) {
    suffix = 'M';
    divisor = 1e6;
  } else if (absValue >= 1e3) {
    suffix = 'K';
    divisor = 1e3;
  }

  const formattedNumber = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(absValue / divisor);

  if (isCurrency) {
    return value < 0 ? `-R$ ${formattedNumber}${suffix}` : `R$ ${formattedNumber}${suffix}`;
  }
  return value < 0 ? `-${formattedNumber}${suffix}` : `${formattedNumber}${suffix}`;
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  highlight,
  isCurrency = false,
  subtext,
  helpContentKey
}: { 
  title: string, 
  value: string | number, 
  icon: React.ReactNode, 
  color: string,
  highlight?: boolean,
  isCurrency?: boolean,
  subtext?: React.ReactNode,
  helpContentKey?: string
}) {
  const fullValue = typeof value === 'number' 
    ? (isCurrency ? formatCurrency(value) : value.toLocaleString('pt-BR'))
    : value;

  const displayValue = typeof value === 'number' 
    ? formatCompactValue(value, isCurrency)
    : value;

  const isNegative = typeof value === 'number' && value < 0;

  return (
    <motion.div 
      whileHover={{ y: -3 }}
      className={cn(
        "p-4 md:p-5 rounded-2xl md:rounded-3xl border shadow-sm flex items-center justify-between gap-4 transition-all min-h-[80px] md:min-h-[100px] min-w-0 group",
        highlight 
          ? "bg-slate-900 dark:bg-black border-slate-800 dark:border-slate-800 text-white" 
          : "bg-theme-card border-theme-border text-theme-foreground"
      )}
      title={fullValue.toString()}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={cn(
          "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 transition-transform group-hover:scale-110", 
          color
        )}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <p className={cn(
              "text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 truncate"
            )}>{title}</p>
            {helpContentKey && (
              <ContextHelp contentKey={helpContentKey} size="xs" />
            )}
          </div>
          <h4 
            className={cn(
              "font-black tracking-tight leading-none overflow-hidden text-ellipsis whitespace-nowrap mt-1",
              isCurrency && (isNegative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")
            )}
            style={{ 
              fontSize: 'clamp(1.1rem, 2.5vw, 1.75rem)'
            }}
          >
            {displayValue}
          </h4>
          {subtext && <div className="mt-1">{subtext}</div>}
        </div>
      </div>
      {highlight && (
        <div className="shrink-0 hidden md:block">
          <ArrowUpRight size={18} className="text-emerald-400 opacity-50" />
        </div>
      )}
    </motion.div>
  );
}
