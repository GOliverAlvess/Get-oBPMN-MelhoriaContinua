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
  Legend
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
import { calculateProjectProgress } from '../lib/projectUtils';
import ActionsDashboardView from './ActionsDashboardView';
import FilterDropdown from './FilterDropdown';

interface DashboardViewProps {
  projects: Project[];
  users: User[];
  actions: OperationalAction[];
  onProjectClick: (id: string) => void;
  key?: string;
}

export default function DashboardView({ projects, users, actions, onProjectClick }: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'actions'>('projects');
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

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

    // Process Status Data for Pie Chart
    const processStatusData = [
      { name: 'Planejamento', value: planning, color: '#EABE41' }, // Brand Gold
      { name: 'Em andamento', value: inProgress, color: '#003489' }, // Brand Blue
      { name: 'Em melhoria', value: inImprovement, color: '#678ecb' }, // Lighter Blue
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

    // Gain Impact
    const projectGains = filteredProjects.map(p => {
      let totalGain = 0;
      (p.subtasks || []).forEach(subtask => {
        subtask.pdcaCycles.forEach(cycle => {
          // Apenas PDCAs finalizados
          if (cycle.status !== 'Concluído') return;
          
          const cycleGain = cycle.plan.actionPlan.reduce((s, action) => {
            if (action.finalProblemStatus === 'Resolvido') {
              return s + (action.gainImpact || 0);
            }
            return s;
          }, 0);
          totalGain += cycleGain;
        });
      });
      return { name: p.name, gain: totalGain };
    }).filter(g => g.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 5);

    const totalGainValue = filteredProjects.reduce((sum, p) => {
      let pGain = 0;
      (p.subtasks || []).forEach(subtask => {
        subtask.pdcaCycles.forEach(cycle => {
          // Considerar apenas PDCAs finalizados
          if (cycle.status !== 'Concluído') return;
          
          pGain += cycle.plan.actionPlan.reduce((acc, action) => {
            // Considerar apenas ações resolvidas
            if (action.finalProblemStatus === 'Resolvido') {
              return acc + (action.gainImpact || 0);
            }
            return acc;
          }, 0);
        });
      });
      return sum + pGain;
    }, 0);

    // Project Progress
    const projectProgressList = filteredProjects.map(p => ({
      id: p.id,
      name: p.name,
      progress: calculateProjectProgress(p)
    })).sort((a, b) => b.progress - a.progress);

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
      recentActivities
    };
  }, [filteredProjects, users]);

  const toggleFilter = (list: any[], item: any, setter: (val: any[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Executivo</h2>
          <p className="text-slate-500 mt-1">Visão estratégica e financeira do sistema.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex items-center">
            <button 
              onClick={() => setActiveTab('projects')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'projects' ? "bg-[#003489] text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              Projetos
            </button>
            <button 
              onClick={() => setActiveTab('actions')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'actions' ? "bg-[#003489] text-white shadow-md" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              Ações
            </button>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 hidden md:flex">
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
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
              <StatCard 
                title="Ganho Geral" 
                value={stats.totalGainValue} 
                isCurrency
                icon={<DollarSign size={18} />} 
                color="bg-emerald-600"
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 2. Impacto de Ganho por Projeto */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ganhos por Projeto</h3>
                  <TrendingUp size={20} className="text-emerald-500" />
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.projectGains} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString()}`, 'Ganho']}
                      />
                      <Bar dataKey="gain" fill="#003489" radius={[0, 8, 8, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3. Status dos Processos */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Distribuição de Status</h3>
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
                      >
                        {stats.processStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 4. Colaboradores */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ranking Colaboradores</h3>
                <div className="space-y-4">
                  {stats.collaboratorRanking.map((collab, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">
                          {idx + 1}
                        </div>
                        <span className="font-bold text-slate-700">{collab.name}</span>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 5. Progresso dos Projetos */}
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
                      onClick={() => onProjectClick(p.id)}
                      className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{p.name}</span>
                        <span className="text-xs font-black text-slate-500">{p.progress}%</span>
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

              {/* 6. Atividade Recente */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Atividade Recente</h3>
                <div className="space-y-6">
                  {stats.recentActivities.map((activity, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      {idx !== stats.recentActivities.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-100" />
                      )}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        activity.type.includes('Concluído') ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"
                      )}>
                        {activity.type.includes('Concluído') ? <CheckCircle2 size={20} /> : <TrendingUp size={20} />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{activity.type}</span>
                          <span className="text-[10px] text-slate-300">•</span>
                          <span className="text-[10px] font-bold text-slate-400">{format(new Date(activity.date), "dd/MM HH:mm")}</span>
                        </div>
                        <p className="font-bold text-slate-800">{activity.title}</p>
                        <p className="text-xs text-slate-500 font-medium">Projeto: {activity.projectName}</p>
                      </div>
                    </div>
                  ))}
                  {stats.recentActivities.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                        <Activity size={32} />
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
            key="actions-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ActionsDashboardView actions={actions} users={users} projects={projects} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatCompactNumber(number: number) {
  if (number < 1000) return number.toString();
  if (number >= 1000 && number < 1000000) return (number / 1000).toFixed(number % 1000 === 0 ? 0 : 1) + 'K';
  if (number >= 1000000) return (number / 1000000).toFixed(number % 1000000 === 0 ? 0 : 1) + 'M';
  return number.toString();
}

const StatCard = React.memo(({ 
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
}) => {
  const displayValue = typeof value === 'number' ? formatCompactNumber(value) : value;
  const finalValue = isCurrency ? `R$ ${displayValue}` : displayValue;

  return (
    <motion.div 
      whileHover={{ y: -3 }}
      className={cn(
        "p-4 rounded-[1.5rem] border shadow-sm flex items-center justify-between gap-3 transition-all min-h-[80px]",
        highlight 
          ? "bg-slate-900 border-slate-800 text-white" 
          : "bg-white border-slate-200 text-slate-900"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0", 
          color
        )}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-[9px] font-black uppercase tracking-widest text-slate-400 truncate"
          )}>{title}</p>
          <h4 
            className="font-black tracking-tight truncate"
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
      {highlight && (
        <div className="shrink-0">
          <ArrowUpRight size={18} className="text-emerald-400 opacity-50" />
        </div>
      )}
    </motion.div>
  );
});
