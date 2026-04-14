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
  CheckCircle2, 
  Clock, 
  AlertCircle,
  History,
  TrendingUp,
  Users,
  Briefcase
} from 'lucide-react';
import { motion } from 'motion/react';
import { OperationalAction, User, Project } from '../types';
import { cn } from '../lib/utils';

interface ActionsDashboardViewProps {
  actions: OperationalAction[];
  users: User[];
  projects: Project[];
}

export default function ActionsDashboardView({ actions, users, projects }: ActionsDashboardViewProps) {
  const stats = useMemo(() => {
    const total = actions.length;
    const pending = actions.filter(a => a.status === 'Pendente').length;
    const inProgress = actions.filter(a => a.status === 'Em andamento').length;
    const completed = actions.filter(a => a.status === 'Concluído').length;

    // Status Data for Pie Chart
    const statusData = [
      { name: 'Pendente', value: pending, color: '#94a3b8' }, // Slate 400
      { name: 'Em andamento', value: inProgress, color: '#EABE41' }, // Brand Gold
      { name: 'Concluído', value: completed, color: '#10b981' }, // Emerald 500
    ].filter(d => d.value > 0);

    // Collaborators with most actions
    const collaboratorCounts = actions.reduce((acc, a) => {
      acc[a.responsibleId] = (acc[a.responsibleId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const collaboratorRanking = users
      .map(u => ({
        name: u.name,
        count: collaboratorCounts[u.id] || 0
      }))
      .filter(u => u.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Projects with most actions
    const projectCounts = actions.reduce((acc, a) => {
      acc[a.projectId] = (acc[a.projectId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const projectRanking = projects
      .map(p => ({
        name: p.name,
        count: projectCounts[p.id] || 0
      }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      total,
      pending,
      inProgress,
      completed,
      statusData,
      collaboratorRanking,
      projectRanking
    };
  }, [actions, users, projects]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="Total de Ações" 
          value={stats.total} 
          icon={<History size={20} />} 
          color="bg-slate-600" 
        />
        <SummaryCard 
          title="Pendentes" 
          value={stats.pending} 
          icon={<AlertCircle size={20} />} 
          color="bg-slate-400" 
        />
        <SummaryCard 
          title="Em Andamento" 
          value={stats.inProgress} 
          icon={<Clock size={20} />} 
          color="bg-[#EABE41]" 
        />
        <SummaryCard 
          title="Concluídas" 
          value={stats.completed} 
          icon={<CheckCircle2 size={20} />} 
          color="bg-emerald-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico de Colaboradores */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ações por Colaborador</h3>
            <Users size={20} className="text-indigo-500" />
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.collaboratorRanking} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Projetos */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ações por Projeto</h3>
            <Briefcase size={20} className="text-[#003489]" />
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.projectRanking} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#003489" radius={[0, 8, 8, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Distribuição de Status */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Status das Ações</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
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

        {/* Lista de Ações Recentes ou Destaques */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Últimas Ações Registradas</h3>
            <TrendingUp size={20} className="text-indigo-500" />
          </div>
          <div className="space-y-4">
            {actions.slice(0, 5).map((action) => (
              <div key={action.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm",
                    action.status === 'Concluído' ? "bg-emerald-500" : 
                    action.status === 'Em andamento' ? "bg-[#EABE41]" : "bg-slate-400"
                  )}>
                    {action.status === 'Concluído' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 line-clamp-1">{action.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{action.responsibleName}</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{action.projectName}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider",
                    action.priority === 'Alta' ? "bg-rose-100 text-rose-600" :
                    action.priority === 'Média' ? "bg-indigo-100 text-indigo-600" :
                    "bg-slate-200 text-slate-600"
                  )}>
                    {action.priority}
                  </span>
                </div>
              </div>
            ))}
            {actions.length === 0 && (
              <p className="text-slate-400 text-sm italic text-center py-10">Nenhuma ação registrada no sistema.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -3 }}
      className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4"
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
      </div>
    </motion.div>
  );
}
