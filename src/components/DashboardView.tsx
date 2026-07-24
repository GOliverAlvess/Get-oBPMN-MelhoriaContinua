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
  ReferenceLine
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
  Search
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
import ActionsDashboardView from './ActionsDashboardView';
import FilterDropdown from './FilterDropdown';
import DetailedOverviewTab from './DetailedOverviewTab';

interface DashboardViewProps {
  projects: Project[];
  users: User[];
  actions: OperationalAction[];
  onProjectClick: (id: string) => void;
  key?: string;
}

export default function DashboardView({ projects, users, actions, onProjectClick }: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'actions' | 'overview'>('projects');
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showAllSectors, setShowAllSectors] = useState(false);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchCollab = selectedCollaborators.length === 0 || selectedCollaborators.includes(p.assignedTo);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(p.status);
      const matchProject = selectedProjectIds.length === 0 || selectedProjectIds.includes(p.id);
      return matchCollab && matchStatus && matchProject;
    });
  }, [projects, selectedCollaborators, selectedStatuses, selectedProjectIds]);

  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const completed = filteredProjects.filter(p => p.status === 'Concluído').length;
    const inImprovement = filteredProjects.filter(p => p.status === 'Em melhoria').length;
    const inProgress = filteredProjects.filter(p => p.status === 'Em andamento').length;
    const planning = filteredProjects.filter(p => p.status === 'Planejamento').length;
    const backlog = filteredProjects.filter(p => p.status === 'Backlog').length;

    // Process Status Data for Pie Chart
    const processStatusData = [
      { name: 'Backlog', value: backlog, color: '#64748b' }, // Slate
      { name: 'Planejamento', value: planning, color: '#EABE41' }, // Brand Gold
      { name: 'Em andamento', value: inProgress, color: '#3b82f6' }, // Brighter Blue for Dark Mode
      { name: 'Em melhoria', value: inImprovement, color: '#818cf8' }, // Lighter Indigo
      { name: 'Concluídos', value: completed, color: '#10b981' }, // Emerald
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

    // Gain Impact (Ganho Geral do Dashboard considera PDCAs concluídos de qualquer projeto)
    let totalGainValue = 0; // Ganho Realizado (PDCAs concluídos)
    let potentialGainValue = 0; // Ganho Potencial (PDCAs em andamento)
    const projectGainsMap: Record<string, { name: string; gain: number }> = {};

    filteredProjects.forEach(p => {
      let pRealizedGain = 0;
      const processedCycleIds = new Set<string>();

      (p.subtasks || []).forEach(subtask => {
        (subtask.pdcaCycles || []).forEach(cycle => {
          if (processedCycleIds.has(cycle.id)) return;
          processedCycleIds.add(cycle.id);

          const isCycleCompleted = cycle.status === 'Concluído' || cycle.etapaAtual === 'REPORT';

          if (isCycleCompleted) {
            const cycleGain = (cycle.plan?.actionPlan || []).reduce((s, action) => {
              if (action.ativo === false) return s;
              const tangibleSum = (action.realGains?.tangible || []).reduce((acc, t) => acc + (t.value || 0), 0);
              return s + tangibleSum;
            }, 0);

            pRealizedGain += cycleGain;
            totalGainValue += cycleGain;
          } else if (cycle.status !== 'Cancelado') {
            const cycleExpected = (cycle.plan?.impact?.expectedGains?.tangible || []).reduce(
              (acc, t) => acc + (t.value || 0),
              0
            );
            potentialGainValue += cycleExpected;
          }
        });
      });

      if (pRealizedGain !== 0) {
        projectGainsMap[p.id] = { name: p.name, gain: pRealizedGain };
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
      // Rule: count only once per project
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
      potentialGainValue,
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

  const toggleFilter = (list: any[], item: any, setter: (val: any[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const renderCustomPieLabel = ({ name, value, percent }: any) => {
    return `${(percent * 100).toFixed(0)}% (${value})`;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-black text-theme-foreground tracking-tight truncate">Dashboard Executivo</h2>
          <p className="text-slate-400 mt-1 truncate">Visão estratégica e financeira do sistema.</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 flex-wrap md:flex-nowrap">
          <div className="bg-theme-card p-1 rounded-xl border border-theme-border shadow-sm flex items-center">
            <button 
              onClick={() => setActiveTab('projects')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'projects' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              Projetos
            </button>
            <button 
              onClick={() => setActiveTab('actions')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'actions' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              Ações
            </button>
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'overview' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              Visão geral detalhada
            </button>
          </div>
          <div className="bg-theme-card px-4 py-2 rounded-xl border border-theme-border shadow-sm flex items-center gap-2 hidden md:flex">
            <Clock size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </span>
          </div>
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
            {/* Filtros Dropdown */}
            <div className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-4">
                <Filter size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Filtros Estratégicos</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Colaboradores Dropdown */}
                <FilterDropdown
                  label="Colaboradores"
                  placeholder="Selecionar colaboradores"
                  options={users.map(u => ({ id: u.id, label: u.name }))}
                  selected={selectedCollaborators}
                  onToggle={(id) => toggleFilter(selectedCollaborators, id, setSelectedCollaborators)}
                  onClear={() => setSelectedCollaborators([])}
                  icon={<Users size={16} />}
                />

                {/* Status Dropdown */}
                <FilterDropdown
                  label="Status"
                  placeholder="Selecionar status"
                  options={['Planejamento', 'Em andamento', 'Em melhoria', 'Concluído'].map(s => ({ id: s, label: s }))}
                  selected={selectedStatuses}
                  onToggle={(id) => toggleFilter(selectedStatuses, id as ProjectStatus, setSelectedStatuses)}
                  onClear={() => setSelectedStatuses([])}
                  icon={<Target size={16} />}
                />

                {/* Projetos Dropdown */}
                <FilterDropdown
                  label="Projetos"
                  placeholder="Selecionar projetos"
                  options={projects.map(p => ({ id: p.id, label: p.name }))}
                  selected={selectedProjectIds}
                  onToggle={(id) => toggleFilter(selectedProjectIds, id, setSelectedProjectIds)}
                  onClear={() => setSelectedProjectIds([])}
                  icon={<Briefcase size={16} />}
                  showSearch
                />
              </div>
            </div>

            {/* 1. Visão Geral e Impacto Financeiro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
              <StatCard 
                title="Ganho Geral" 
                value={stats.totalGainValue} 
                isCurrency
                icon={<DollarSign size={18} />} 
                color={stats.totalGainValue < 0 ? "bg-rose-600" : "bg-emerald-600"}
                subtext={
                  stats.potentialGainValue > 0 ? (
                    <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap leading-tight mt-1">
                      <span className="text-amber-600 dark:text-amber-400">
                        📈 Potencial: {formatCurrency(stats.potentialGainValue)}
                      </span>
                    </div>
                  ) : undefined
                }
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
                  <h3 className="text-base md:text-lg font-black text-theme-foreground uppercase tracking-tight">Ganhos por Projeto</h3>
                  <TrendingUp size={20} className="text-emerald-500" />
                </div>
                <div className="h-[250px] md:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.projectGains} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
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
                        formatter={(value: number) => [formatCurrency(value), 'Ganho']}
                      />
                      <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                      <Bar dataKey="gain" radius={[0, 8, 8, 0]} barSize={20}>
                        {stats.projectGains.map((entry, index) => (
                          <Cell 
                            key={`cell-gain-${index}`} 
                            fill={entry.gain < 0 ? '#f43f5e' : '#10b981'} 
                          />
                        ))}
                        <LabelList 
                          dataKey="gain" 
                          position="right" 
                          formatter={(value: number) => formatCurrency(value)}
                          style={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }}
                          offset={10}
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
                        labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 4. Colaboradores */}
              <div className="bg-theme-card p-8 rounded-[2.5rem] border border-theme-border shadow-sm space-y-6">
                <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight">QTD de projetos por colaborador</h3>
                <div className="space-y-4">
                  {stats.collaboratorRanking.map((collab, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-theme-background rounded-2xl border border-theme-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">
                          {idx + 1}
                        </div>
                        <span className="font-bold text-theme-foreground">{collab.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-indigo-600">{collab.count}</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projetos</p>
                      </div>
                    </div>
                  ))}
                  {stats.collaboratorRanking.length === 0 && (
                    <p className="text-slate-400 text-sm italic text-center py-10">Nenhum colaborador com projetos.</p>
                  )}
                </div>
              </div>
            </div>

            {/* 4.5 Análise por Setores Envolvidos */}
            <div className="bg-theme-card p-6 md:p-8 rounded-[2.5rem] border border-theme-border shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight">Setores Envolvidos</h3>
                    {stats.sectorDistribution.length > 10 && (
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                        {showAllSectors ? `Todos (${stats.sectorDistribution.length})` : `Top 10 de ${stats.sectorDistribution.length}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Recorrência de setores nos escopos dos projetos ativos (ordenado por frequência).</p>
                </div>
                <div className="p-3 bg-theme-background rounded-2xl border border-theme-border">
                  <Users size={20} className="text-indigo-400" />
                </div>
              </div>

              {displayedSectors.length > 0 ? (
                <div className="space-y-4">
                  <div className="max-h-[450px] overflow-y-auto custom-scrollbar pr-2 w-full">
                    <div style={{ height: `${Math.max(260, displayedSectors.length * 38)}px`, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayedSectors} layout="vertical" margin={{ left: 10, right: 35, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={150} 
                            tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
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
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)'
                            }}
                            itemStyle={{ color: '#ffffff' }}
                            labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                            formatter={(value: number) => [`${value} projeto(s)`, 'Ocorrência']}
                          />
                          <Bar dataKey="count" fill="#EABE41" radius={[0, 8, 8, 0]} barSize={22}>
                            <LabelList 
                              dataKey="count" 
                              position="right" 
                              style={{ fontSize: 11, fontWeight: 900, fill: '#EABE41' }}
                              offset={10}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {stats.sectorDistribution.length > 10 && (
                    <div className="flex justify-center pt-2 border-t border-theme-border">
                      <button
                        type="button"
                        onClick={() => setShowAllSectors(!showAllSectors)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-2"
                      >
                        {showAllSectors ? (
                          <>
                            Ver apenas Top 10 <ChevronUp size={14} />
                          </>
                        ) : (
                          <>
                            Ver todos os {stats.sectorDistribution.length} setores <ChevronDown size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4 bg-theme-background rounded-3xl border border-dashed border-theme-border mx-auto max-w-sm">
                  <p className="text-slate-400 text-sm font-medium">Nenhum setor informado nos escopos.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 5. Progresso dos Projetos */}
              <div className="bg-theme-card p-8 rounded-[2.5rem] border border-theme-border shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight">Progresso dos Projetos</h3>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-400">{stats.avgProgress}%</span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Média Geral</p>
                  </div>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {stats.projectProgressList.map((p) => (
                    <div 
                      key={p.id} 
                      onClick={() => onProjectClick(p.id)}
                      className="group p-4 bg-theme-background rounded-2xl border border-theme-border hover:border-indigo-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2 min-w-0 gap-2">
                        <span className="font-bold text-theme-foreground group-hover:text-indigo-400 transition-colors truncate">{p.name}</span>
                        <span className="text-xs font-black text-slate-400 shrink-0">{p.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-theme-card rounded-full overflow-hidden border border-theme-border">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${p.progress}%` }}
                          className={cn(
                            "h-full transition-all duration-1000",
                            p.progress === 100 ? "bg-emerald-500" : "bg-indigo-500"
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Atividade Recente */}
              <div className="bg-theme-card p-8 rounded-[2.5rem] border border-theme-border shadow-sm space-y-6">
                <h3 className="text-lg font-black text-theme-foreground uppercase tracking-tight">Atividade Recente</h3>
                <div className="space-y-6">
                  {stats.recentActivities.map((activity, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      {idx !== stats.recentActivities.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-theme-border" />
                      )}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        activity.type.includes('Concluído') ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-400"
                      )}>
                        {activity.type.includes('Concluído') ? <CheckCircle2 size={20} /> : <TrendingUp size={20} />}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest truncate">{activity.type}</span>
                          <span className="text-[10px] text-slate-500">•</span>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">{format(new Date(activity.date), "dd/MM HH:mm")}</span>
                        </div>
                        <p className="font-bold text-theme-foreground break-words line-clamp-2" title={activity.title}>{activity.title}</p>
                        <p className="text-xs text-slate-400 font-medium truncate">Projeto: {activity.projectName}</p>
                      </div>
                    </div>
                  ))}
                  {stats.recentActivities.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-theme-background rounded-full flex items-center justify-center mx-auto text-slate-500">
                        <Activity size={32} />
                      </div>
                      <p className="text-slate-400 text-sm italic">Nenhuma atividade recente registrada.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
  subtext
}: { 
  title: string, 
  value: string | number, 
  icon: React.ReactNode, 
  color: string,
  highlight?: boolean,
  isCurrency?: boolean,
  subtext?: React.ReactNode
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
          <p className={cn(
            "text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 truncate"
          )}>{title}</p>
          <h4 
            className={cn(
              "font-black tracking-tight leading-none overflow-hidden text-ellipsis whitespace-nowrap",
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
