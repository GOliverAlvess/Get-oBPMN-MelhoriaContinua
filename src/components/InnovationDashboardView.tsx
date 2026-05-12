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
  Label
} from 'recharts';
import { 
  Target, 
  Users, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Briefcase,
  Filter,
  ChevronDown,
  X,
  Search,
  SearchIcon,
  ChevronRight,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  InnovationProject, 
  User, 
  InnovationStatus,
  InnovationAction,
  InnovationActionType
} from '../types';
import { cn } from '../lib/utils';

interface InnovationDashboardProps {
  innovationProjects: InnovationProject[];
  users: User[];
  key?: string;
}

const statusColumns: { id: InnovationStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: '#94a3b8' },
  { id: 'análise', label: 'Análise', color: '#fbbf24' },
  { id: 'planejamento', label: 'Em planejamento', color: '#60a5fa' },
  { id: 'desenvolvimento', label: 'Em desenvolvimento', color: '#818cf8' },
  { id: 'teste', label: 'Em teste', color: '#a855f7' },
  { id: 'concluído', label: 'Concluído', color: '#34d399' }
];

export default function InnovationDashboardView({ innovationProjects, users }: InnovationDashboardProps) {
  const [activeTab, setActiveTab] = useState<'executive' | 'development'>('executive');
  
  // Filters
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<InnovationStatus[]>([]);

  const filteredProjects = useMemo(() => {
    return innovationProjects.filter(p => !p.deleted).filter(p => {
      const matchCollab = selectedCollaborators.length === 0 || selectedCollaborators.includes(p.responsibleId);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(p.status);
      return matchCollab && matchStatus;
    });
  }, [innovationProjects, selectedCollaborators, selectedStatuses]);

  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const byStatus = statusColumns.reduce((acc, col) => {
      acc[col.id] = filteredProjects.filter(p => p.status === col.id).length;
      return acc;
    }, {} as Record<InnovationStatus, number>);

    const statusChartData = statusColumns.map(col => ({
      name: col.label,
      value: byStatus[col.id],
      color: col.color
    })).filter(d => d.value > 0);

    const collaboratorCounts = filteredProjects.reduce((acc, p) => {
      acc[p.responsibleId] = (acc[p.responsibleId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const collaboratorRanking = users
      .filter(u => filteredProjects.some(p => p.responsibleId === u.id))
      .map(u => ({
        name: u.name,
        count: collaboratorCounts[u.id] || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const technologyCounts: Record<string, number> = {};
    filteredProjects.forEach(p => {
      p.technicalScope?.technologies?.forEach(tech => {
        technologyCounts[tech] = (technologyCounts[tech] || 0) + 1;
      });
    });

    const technologyChartData = Object.entries(technologyCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const delayedProjects = filteredProjects.filter(p => {
      if (!p.deadline || p.status === 'concluído') return false;
      return new Date(p.deadline).getTime() < new Date().getTime();
    });

    // Activity data (mocked activity based on deadlines/creation in last 30 days)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: format(date, 'dd/MM'),
        count: 0
      };
    });

    innovationProjects.forEach(p => {
      if (p.createdAt) {
        const dateStr = format(new Date(p.createdAt), 'dd/MM');
        const day = last30Days.find(d => d.date === dateStr);
        if (day) day.count += 1;
      }
      p.developmentActions?.forEach(a => {
        if (a.deadline) {
          const dateStr = format(new Date(a.deadline), 'dd/MM');
          const day = last30Days.find(d => d.date === dateStr);
          if (day) day.count += 0.5; // Weighting actions less than full projects
        }
      });
    });

    // Project Progress List
    const projectProgressList = filteredProjects.map(p => {
      const totalActions = p.developmentActions?.length || 0;
      const completedActions = p.developmentActions?.filter(a => a.status === 'Concluído').length || 0;
      const progress = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
      
      return {
        id: p.id,
        name: p.title,
        priority: p.priority || 'Baixa',
        progress
      };
    }).sort((a, b) => {
      const priorityOrder = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
      const valA = (priorityOrder as any)[a.priority] ?? 3;
      const valB = (priorityOrder as any)[b.priority] ?? 3;
      
      if (valA !== valB) return valA - valB;
      return b.progress - a.progress;
    });

    const avgProgress = total > 0 
      ? Math.round(projectProgressList.reduce((sum, p) => sum + p.progress, 0) / total) 
      : 0;

    // Recent Activity (Moved from activityData chart logic)
    const activities: { type: string, title: string, date: string, projectName: string }[] = [];
    innovationProjects.forEach(p => {
      if (p.createdAt) {
        activities.push({
          type: 'Projeto Criado',
          title: p.title,
          date: p.createdAt,
          projectName: p.title
        });
      }
      p.developmentActions?.forEach(a => {
        if (a.deadline) { // Using deadline as activity date for simulation if no updatedAt
          activities.push({
            type: a.status === 'Concluído' ? 'Ação Concluída' : 'Ação Registrada',
            title: a.description,
            date: a.deadline,
            projectName: p.title
          });
        }
      });
    });

    const recentActivities = activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);

    const completionRate = total > 0 ? Math.round((byStatus['concluído'] / total) * 100) : 0;

    return {
      total,
      byStatus,
      statusChartData,
      collaboratorRanking,
      technologyChartData,
      delayedProjectsCount: delayedProjects.length,
      completionRate,
      avgProgress,
      projectProgressList,
      recentActivities
    };
  }, [filteredProjects, users, innovationProjects]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Inovação</h2>
          <p className="text-slate-500 mt-1">Visão executiva e acompanhamento operacional de projetos.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-sm flex items-center">
            <button 
              onClick={() => setActiveTab('executive')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'executive' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              Visão Executiva
            </button>
            <button 
              onClick={() => setActiveTab('development')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'development' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              Desenvolvimento
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'executive' ? (
          <motion.div 
            key="executive"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="space-y-8"
          >
            {/* Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total de Projetos" value={stats.total} icon={<Briefcase size={22} />} color="bg-indigo-600" />
              <StatCard title="Projetos Concluídos" value={stats.byStatus['concluído']} icon={<CheckCircle2 size={22} />} color="bg-emerald-500" />
              <StatCard title="Em Desenvolvimento" value={stats.byStatus['desenvolvimento']} icon={<Layers size={22} />} color="bg-indigo-400" />
              <StatCard title="Backlog" value={stats.byStatus['backlog']} icon={<Clock size={22} />} color="bg-slate-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Projects by Status (Donut) */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Distribuição de Status</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ percent }: any) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {stats.statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <Label 
                          value={stats.total} 
                          position="center" 
                          style={{ fontSize: '24px', fontWeight: 900, fill: '#0f172a' }} 
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

              {/* Ranking of Collaborators (List Pattern) */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ranking Colaboradores</h3>
                <div className="space-y-4">
                  {stats.collaboratorRanking.map((collab, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs">
                          {idx + 1}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{collab.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{collab.count}</span>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Projetos</p>
                      </div>
                    </div>
                  ))}
                  {stats.collaboratorRanking.length === 0 && (
                    <p className="text-slate-400 text-sm italic text-center py-10">Nenhum colaborador com projetos.</p>
                  )}
                </div>
              </div>

              {/* Technologies Usage (Keep as is) */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Tecnologias mais Utilizadas</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.technologyChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
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
                      />
                      <Bar dataKey="count" fill="#60a5fa" radius={[0, 8, 8, 0]} barSize={24}>
                        <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 900, fill: '#1e40af' }} offset={10} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Project Progress (List with Progress Bars) */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Progresso dos Projetos</h3>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600">{stats.avgProgress}%</span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Média Geral</p>
                  </div>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {stats.projectProgressList.map((p) => (
                    <div 
                      key={p.id} 
                      className="group p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2 min-w-0 gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 shrink-0">{p.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${p.progress}%` }}
                          className={cn(
                            "h-full transition-all duration-1000",
                            p.progress === 100 ? "bg-emerald-500" : "bg-indigo-600"
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity (Timeline/List) */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Atividade Recente</h3>
                <div className="space-y-6">
                  {stats.recentActivities.map((activity, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      {idx !== stats.recentActivities.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-100 dark:bg-slate-800" />
                      )}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        activity.type.includes('Concluída') ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      )}>
                        {activity.type.includes('Concluída') ? <CheckCircle2 size={20} /> : <TrendingUp size={20} />}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{activity.type}</span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">{format(new Date(activity.date), "dd/MM HH:mm")}</span>
                        </div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 break-words line-clamp-2" title={activity.title}>{activity.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Projeto: {activity.projectName}</p>
                      </div>
                    </div>
                  ))}
                  {stats.recentActivities.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                        <TrendingUp size={32} />
                      </div>
                      <p className="text-slate-400 text-sm italic">Nenhuma atividade recente registrada.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="development"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
          >
            <DevelopmentPanel innovationProjects={innovationProjects} users={users} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DevelopmentPanel({ innovationProjects, users }: { innovationProjects: InnovationProject[], users: User[] }) {
  const [filterType, setFilterType] = useState<InnovationActionType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'Baixa' | 'Média' | 'Alta'>('all');
  const [filterResponsible, setFilterResponsible] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'project' | 'responsible' | 'priority'>('project');

  const STOPPED_DAYS_THRESHOLD = 7;

  const allActions = useMemo(() => {
    const actions: (InnovationAction & { projectName: string, projectId: string })[] = [];
    innovationProjects.filter(p => !p.deleted).forEach(p => {
      p.developmentActions?.forEach(a => {
        actions.push({
          ...a,
          projectName: p.title,
          projectId: p.id
        });
      });
    });
    return actions;
  }, [innovationProjects]);

  const filteredActions = useMemo(() => {
    return allActions.filter(a => {
      const matchType = filterType === 'all' || a.type === filterType;
      const matchPriority = filterPriority === 'all' || a.priority === filterPriority;
      const matchResponsible = filterResponsible === 'all' || a.responsibleId === filterResponsible;
      const matchStatus = filterStatus === 'all' || a.status === filterStatus;
      return matchType && matchPriority && matchResponsible && matchStatus;
    });
  }, [allActions, filterType, filterPriority, filterResponsible, filterStatus]);

  const isStopped = (action: InnovationAction) => {
    if ((action.status as any) === 'Concluído') return false;
    // For this prototype, we'll assume "completionDate" or a hypothetical "updatedAt"
    // Since we don't have updatedAt on action yet, we'll use a placeholder or logic based on deadline if not completed
    // Let's assume stopped if deadline is long past or if it's pending for a long time.
    // In a real scenario, each action object should have an updatedAt timestamp.
    // For now, let's use a dummy check or skip it if data doesn't support it well.
    // Let's add simulation: if deadline is older than 7 days ago and not completed
    if (!action.deadline) return false;
    const deadlineDate = new Date(action.deadline);
    const today = new Date();
    return (action.status as any) !== 'Concluído' && differenceInDays(today, deadlineDate) > STOPPED_DAYS_THRESHOLD;
  };

  const groupedActions = useMemo(() => {
    const groups: Record<string, { label: string, actions: typeof filteredActions }> = {};
    
    filteredActions.forEach(a => {
      let key = '';
      let label = '';
      
      if (groupBy === 'project') {
        key = a.projectId;
        label = a.projectName;
      } else if (groupBy === 'responsible') {
        key = a.responsibleId;
        label = users.find(u => u.id === a.responsibleId)?.name || 'Desconhecido';
      } else if (groupBy === 'priority') {
        key = a.priority;
        label = a.priority;
      }
      
      if (!groups[key]) {
        groups[key] = { label, actions: [] };
      }
      groups[key].actions.push(a);
    });
    
    return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredActions, groupBy, users]);

  return (
    <div className="space-y-6">
      {/* Filters & Grouping Bar */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="Alinhamento">Alinhamento</option>
            <option value="Ajustes">Ajustes</option>
            <option value="Decisão">Decisão</option>
            <option value="Testes">Testes</option>
            <option value="Implementação">Implementação</option>
          </select>

          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas Prioridades</option>
            <option value="Baixa">Baixa</option>
            <option value="Média">Média</option>
            <option value="Alta">Alta</option>
          </select>

          <select 
            value={filterResponsible} 
            onChange={(e) => setFilterResponsible(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 max-w-[150px]"
          >
            <option value="all">Responsáveis</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Agrupar por:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setGroupBy('project')}
              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", groupBy === 'project' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
            >
              Projeto
            </button>
            <button 
              onClick={() => setGroupBy('responsible')}
              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", groupBy === 'responsible' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
            >
              Responsável
            </button>
            <button 
              onClick={() => setGroupBy('priority')}
              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", groupBy === 'priority' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
            >
              Prioridade
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {groupedActions.map((group, idx) => (
          <div key={idx} className="space-y-4">
            <h4 className="flex items-center gap-3 px-4">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{group.label}</span>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{group.actions.length}</span>
            </h4>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo / Prioridade</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.actions.map(action => {
                      const stopped = isStopped(action);
                      return (
                        <tr key={action.id} className={cn("border-b border-slate-50 hover:bg-slate-50/50 transition-colors", stopped && "bg-rose-50/30")}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-slate-700">{action.type}</span>
                              <span className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full w-fit",
                                action.priority === 'Alta' ? "bg-rose-100 text-rose-600" :
                                action.priority === 'Média' ? "bg-indigo-100 text-indigo-600" :
                                "bg-slate-100 text-slate-600"
                              )}>
                                {action.priority}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[300px]">
                            <p className="text-sm font-medium text-slate-600 leading-relaxed italic line-clamp-2">{action.description}</p>
                            {stopped && (
                              <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-black text-rose-600 uppercase tracking-widest">
                                <AlertTriangle size={10} />
                                Ação Parada (+{STOPPED_DAYS_THRESHOLD} dias)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                {users.find(u => u.id === action.responsibleId)?.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="text-xs font-bold text-slate-600">
                                {users.find(u => u.id === action.responsibleId)?.name || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-slate-500">
                                {action.deadline ? format(new Date(action.deadline), 'dd/MM/yyyy') : 'Sem prazo'}
                              </span>
                              {action.completionDate && (
                                <span className="text-[9px] font-bold text-emerald-600">
                                  Concluído em {format(new Date(action.completionDate), 'dd/MM')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={cn(
                              "inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                              action.status === 'Concluído' ? "bg-emerald-100 text-emerald-700" :
                              action.status === 'Em andamento' ? "bg-amber-100 text-amber-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {action.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

        {groupedActions.length === 0 && (
          <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200 mb-4">
              <SearchIcon size={32} />
            </div>
            <p className="text-slate-400 font-medium">Nenhuma ação encontrada com os filtros selecionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCompactNumber(number: number) {
  if (number < 1000) return number.toString();
  if (number >= 1000 && number < 1000000) return (number / 1000).toFixed(number % 1000 === 0 ? 0 : 1) + 'K';
  if (number >= 1000000) return (number / 1000000).toFixed(number % 1000000 === 0 ? 0 : 1) + 'M';
  return number.toString();
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  highlight,
  isCurrency = false
}: { 
  title: string, 
  value: string | number, 
  icon: React.ReactNode, 
  color: string,
  highlight?: boolean,
  isCurrency?: boolean
}) {
  const displayValue = typeof value === 'number' ? formatCompactNumber(value) : value;
  const finalValue = isCurrency ? `R$ ${displayValue}` : displayValue;

  return (
    <motion.div 
      whileHover={{ y: -3 }}
      className={cn(
        "p-4 rounded-[1.5rem] border shadow-sm flex items-center justify-between gap-3 transition-all min-h-[80px] min-w-0",
        highlight 
          ? "bg-slate-900 border-slate-800 text-white" 
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0", 
          color
        )}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className={cn(
            "text-[9px] font-black uppercase tracking-widest text-slate-400 truncate"
          )} title={title}>{title}</p>
          <h4 
            className="font-black tracking-tight"
            style={{ 
              fontSize: 'clamp(14px, 1.5vw, 20px)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={value.toString()}
          >
            {finalValue}
          </h4>
        </div>
      </div>
    </motion.div>
  );
}
