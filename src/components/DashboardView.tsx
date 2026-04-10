import React, { useMemo } from 'react';
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
  AlertCircle, 
  DollarSign,
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Project, User } from '../types';
import { cn } from '../lib/utils';
import { calculateProjectProgress } from '../lib/projectUtils';

interface DashboardViewProps {
  projects: Project[];
  users: User[];
  onProjectClick: (id: string) => void;
  key?: string;
}

export default function DashboardView({ projects, users, onProjectClick }: DashboardViewProps) {
  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter(p => p.status === 'Concluído').length;
    const inProgress = projects.filter(p => p.status === 'Em Execução').length;
    const planning = projects.filter(p => p.status === 'Planejamento').length;
    const suspended = projects.filter(p => p.status === 'Suspenso').length;

    // "Parados" - No activity in last 7 days
    const sevenDaysAgo = subDays(new Date(), 7);
    const stopped = projects.filter(p => {
      const lastEdited = p.mapping.lastEdited ? new Date(p.mapping.lastEdited) : new Date(p.createdAt);
      return !isAfter(lastEdited, sevenDaysAgo) && p.status !== 'Concluído';
    }).length;

    // Process Status Data for Pie Chart
    const processStatusData = [
      { name: 'Em andamento', value: inProgress + planning, color: '#6366f1' },
      { name: 'Parados', value: stopped, color: '#f43f5e' },
      { name: 'Concluídos', value: completed, color: '#10b981' },
    ];

    // Collaborators Ranking
    const collaboratorCounts = projects.reduce((acc, p) => {
      acc[p.assignedTo] = (acc[p.assignedTo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const collaboratorRanking = users.map(u => ({
      name: u.name,
      count: collaboratorCounts[u.id] || 0
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    // Gain Impact
    const projectGains = projects.map(p => {
      const totalGain = p.pdcaCycles.reduce((sum, cycle) => {
        const cycleGain = cycle.plan.actionPlan.reduce((s, action) => s + (action.gainImpact || 0), 0);
        return sum + cycleGain;
      }, 0);
      return { name: p.name, gain: totalGain };
    }).sort((a, b) => b.gain - a.gain).slice(0, 5);

    const totalGainValue = projects.reduce((sum, p) => {
      return sum + p.pdcaCycles.reduce((s, cycle) => {
        return s + cycle.plan.actionPlan.reduce((acc, action) => acc + (action.gainImpact || 0), 0);
      }, 0);
    }, 0);

    // Project Progress
    const projectProgressList = projects.map(p => ({
      id: p.id,
      name: p.name,
      progress: calculateProjectProgress(p)
    })).sort((a, b) => b.progress - a.progress);

    const avgProgress = total > 0 
      ? Math.round(projectProgressList.reduce((sum, p) => sum + p.progress, 0) / total) 
      : 0;

    // Recent Activity
    const activities: { type: string, title: string, date: string, projectName: string }[] = [];
    projects.forEach(p => {
      p.pdcaCycles.forEach(c => {
        activities.push({
          type: c.status === 'Concluído' ? 'PDCA Concluído' : 'PDCA Iniciado',
          title: c.title,
          date: c.createdAt,
          projectName: p.name
        });
      });
    });
    const recentActivities = activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

    return {
      total,
      completed,
      inProgress: inProgress + planning,
      stopped,
      processStatusData,
      collaboratorRanking,
      projectGains,
      totalGainValue,
      projectProgressList,
      avgProgress,
      recentActivities
    };
  }, [projects, users]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Executivo</h2>
          <p className="text-slate-500 mt-1">Visão geral e analítica de todos os projetos.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* 1. Visão Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total de Projetos" 
          value={stats.total} 
          icon={<GitBranch size={24} />} 
          color="bg-indigo-600" 
        />
        <StatCard 
          title="Em Andamento" 
          value={stats.inProgress} 
          icon={<Activity size={24} />} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Concluídos" 
          value={stats.completed} 
          icon={<CheckCircle2 size={24} />} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Parados" 
          value={stats.stopped} 
          icon={<AlertCircle size={24} />} 
          color="bg-rose-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Status dos Processos */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Status dos Processos</h3>
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

        {/* 3. Colaboradores */}
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

        {/* 4. Impacto de Ganho */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Impacto de Ganho</h3>
            <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-xs font-black">
              R$ {stats.totalGainValue.toLocaleString()} Total
            </div>
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
                <Bar dataKey="gain" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
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
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-5"
    >
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
      </div>
    </motion.div>
  );
}

function GitBranch(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
