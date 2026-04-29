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
  CheckCircle2, 
  Clock, 
  AlertCircle,
  History,
  TrendingUp,
  Users,
  Briefcase,
  Filter,
  Target,
  Search
} from 'lucide-react';
import { motion } from 'motion/react';
import { OperationalAction, User, Project } from '../types';
import { cn } from '../lib/utils';
import FilterDropdown from './FilterDropdown';

interface ActionsDashboardViewProps {
  actions: OperationalAction[];
  users: User[];
  projects: Project[];
}

export default function ActionsDashboardView({ actions, users, projects }: ActionsDashboardViewProps) {
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const filteredActions = useMemo(() => {
    return actions.filter(a => {
      const matchCollab = selectedCollaborators.length === 0 || selectedCollaborators.includes(a.responsibleId);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(a.status);
      const matchProject = selectedProjectIds.length === 0 || selectedProjectIds.includes(a.projectId);
      return matchCollab && matchStatus && matchProject;
    });
  }, [actions, selectedCollaborators, selectedStatuses, selectedProjectIds]);

  const stats = useMemo(() => {
    const total = filteredActions.length;
    const pending = filteredActions.filter(a => a.status === 'Pendente').length;
    const inProgress = filteredActions.filter(a => a.status === 'Em andamento').length;
    const completed = filteredActions.filter(a => a.status === 'Concluído').length;

    // Status Data for Pie Chart
    const statusData = [
      { name: 'Pendente', value: pending, color: '#94a3b8' }, // Slate 400
      { name: 'Em andamento', value: inProgress, color: '#EABE41' }, // Brand Gold
      { name: 'Concluído', value: completed, color: '#10b981' }, // Emerald 500
    ].filter(d => d.value > 0);

    // Collaborators with most actions
    const collaboratorCounts = filteredActions.reduce((acc, a) => {
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
    const projectCounts = filteredActions.reduce((acc, a) => {
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
  }, [filteredActions, users, projects]);

  const toggleFilter = (list: string[], item: string, setter: (val: string[]) => void) => {
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filtros Dropdown */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 mb-4">
          <Filter size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Filtros de Análise</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Colaboradores Dropdown */}
          <FilterDropdown
            label="Colaboradores"
            placeholder="Todos os colaboradores"
            options={users.map(u => ({ id: u.id, label: u.name }))}
            selected={selectedCollaborators}
            onToggle={(id) => toggleFilter(selectedCollaborators, id, setSelectedCollaborators)}
            onClear={() => setSelectedCollaborators([])}
            icon={<Users size={16} />}
          />

          {/* Status Dropdown */}
          <FilterDropdown
            label="Status"
            placeholder="Todos os status"
            options={['Pendente', 'Em andamento', 'Concluído'].map(s => ({ id: s, label: s }))}
            selected={selectedStatuses}
            onToggle={(id) => toggleFilter(selectedStatuses, id, setSelectedStatuses)}
            onClear={() => setSelectedStatuses([])}
            icon={<Target size={16} />}
          />

          {/* Projetos Dropdown */}
          <FilterDropdown
            label="Projetos"
            placeholder="Todos os projetos"
            options={projects.map(p => ({ id: p.id, label: p.name }))}
            selected={selectedProjectIds}
            onToggle={(id) => toggleFilter(selectedProjectIds, id, setSelectedProjectIds)}
            onClear={() => setSelectedProjectIds([])}
            icon={<Briefcase size={16} />}
            showSearch
          />
        </div>
      </div>

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
                <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24}>
                  <LabelList 
                    dataKey="count" 
                    position="right" 
                    style={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                    offset={10}
                  />
                </Bar>
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
                <Bar dataKey="count" fill="#003489" radius={[0, 8, 8, 0]} barSize={24}>
                  <LabelList 
                    dataKey="count" 
                    position="right" 
                    style={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                    offset={10}
                  />
                </Bar>
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
                  label={renderCustomPieLabel}
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <Label 
                    value={stats.total} 
                    position="center" 
                    style={{ fontSize: '24px', fontWeight: 900, fill: '#0f172a' }} 
                  />
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
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Últimas Ações Filtradas</h3>
            <TrendingUp size={20} className="text-indigo-500" />
          </div>
          <div className="space-y-4">
            {filteredActions.slice(0, 5).map((action) => (
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
            {filteredActions.length === 0 && (
              <p className="text-slate-400 text-sm italic text-center py-10">Nenhuma ação encontrada com os filtros selecionados.</p>
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
