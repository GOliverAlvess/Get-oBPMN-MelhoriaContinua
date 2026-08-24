import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Activity, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Download, 
  ShieldAlert, 
  ArrowUpDown, 
  Zap, 
  LogIn, 
  FolderPlus, 
  FileText, 
  CheckSquare, 
  UploadCloud, 
  Settings,
  TrendingUp,
  X
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, handleFirestoreError, OperationType } from '../firebase';
import { User, UserActivityLog } from '../types';
import { cn, exportarCSVPadrao } from '../lib/utils';
import ContextHelp from './ContextHelp';

interface UserActivityMonitoringTabProps {
  users: User[];
  currentUser?: User;
}

export default function UserActivityMonitoringTab({ users, currentUser }: UserActivityMonitoringTabProps) {
  // 1. Verificação Estrita de Permissão
  const isMaster = currentUser?.profile === 'Usuário Master';

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ativo' | 'Inativo'>('all');
  const [sortBy, setSortBy] = useState<'actions_desc' | 'actions_asc' | 'last_access' | 'time_desc'>('last_access');

  // Estados de Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Logs de atividade em tempo real
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);
  const [selectedUserForAudit, setSelectedUserForAudit] = useState<User | null>(null);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');

  // Busca logs de auditoria no Firestore
  useEffect(() => {
    if (!isMaster) return;

    const q = query(collection(db, 'userActivityLogs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivityLog));
      setActivityLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'userActivityLogs');
    });

    return () => unsubscribe();
  }, [isMaster]);

  // Se não for master, bloqueia a interface por segurança
  if (!isMaster) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50 min-h-[400px] rounded-3xl border border-slate-200">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">Acesso Restrito ao Usuário Master</h3>
          <p className="text-slate-500 text-sm max-w-md mt-1">
            Esta aba contém relatórios confidenciais de auditoria de uso do sistema e está disponível exclusivamente para Administradores Principais (Usuário Master).
          </p>
        </div>
      </div>
    );
  }

  // Define limite de data conforme o período selecionado
  const getPeriodStartDate = () => {
    const now = new Date();
    if (periodFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return startOfDay.getTime();
    }
    if (periodFilter === '7days') {
      return now.getTime() - (7 * 24 * 60 * 60 * 1000);
    }
    if (periodFilter === '30days') {
      return now.getTime() - (30 * 24 * 60 * 60 * 1000);
    }
    return 0; // Todos
  };

  const periodStartTime = getPeriodStartDate();

  // Logs filtrados pelo período
  const filteredLogsInPeriod = useMemo(() => {
    if (periodStartTime === 0) return activityLogs;
    return activityLogs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return !isNaN(logTime) && logTime >= periodStartTime;
    });
  }, [activityLogs, periodStartTime]);

  // Consolidação de estatísticas por usuário
  const userStats = useMemo(() => {
    const map = new Map<string, {
      logins: number;
      actions: number;
      lastAccess: string | null;
      logs: UserActivityLog[];
    }>();

    // Inicializa todos os usuários cadastrados
    users.forEach(u => {
      map.set(u.id, {
        logins: u.loginCount || 0,
        actions: u.actionCount || 0,
        lastAccess: u.lastAccess || null,
        logs: [],
      });
    });

    // Agrega logs reais dentro do período
    filteredLogsInPeriod.forEach(log => {
      if (!log.userId) return;
      const current = map.get(log.userId) || {
        logins: 0,
        actions: 0,
        lastAccess: null,
        logs: [],
      };

      if (log.actionType === 'login') {
        current.logins += 1;
      } else {
        current.actions += 1;
      }

      current.logs.push(log);

      if (!current.lastAccess || new Date(log.timestamp) > new Date(current.lastAccess)) {
        current.lastAccess = log.timestamp;
      }

      map.set(log.userId, current);
    });

    return map;
  }, [users, filteredLogsInPeriod]);

  // Lista processada de usuários para tabela
  const processedUsers = useMemo(() => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return users.map(user => {
      const stats = userStats.get(user.id) || {
        logins: user.loginCount || 0,
        actions: user.actionCount || 0,
        lastAccess: user.lastAccess || null,
        logs: [],
      };

      const lastAccessTime = stats.lastAccess ? new Date(stats.lastAccess).getTime() : 0;
      // Define se está "Ativo" (teve acesso recente nos últimos 7 dias ou ações no período)
      const isActive = lastAccessTime > sevenDaysAgo || stats.actions > 0 || stats.logins > 0;
      const computedStatus: 'Ativo' | 'Inativo' = isActive ? 'Ativo' : 'Inativo';

      // Estimativa de minutos de uso
      const totalMinutes = user.totalUsageMinutes || (stats.logins * 5 + stats.actions * 2);

      return {
        ...user,
        periodLogins: stats.logins,
        periodActions: stats.actions,
        effectiveLastAccess: stats.lastAccess,
        computedStatus,
        totalMinutes,
        userLogs: stats.logs,
      };
    });
  }, [users, userStats]);

  // Aplicação de busca e filtros de status/ordenação
  const filteredUsers = useMemo(() => {
    return processedUsers.filter(u => {
      // Busca textual
      const matchesSearch = 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.sector || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de status
      const matchesStatus = statusFilter === 'all' || u.computedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'actions_desc') return b.periodActions - a.periodActions;
      if (sortBy === 'actions_asc') return a.periodActions - b.periodActions;
      if (sortBy === 'time_desc') return b.totalMinutes - a.totalMinutes;
      if (sortBy === 'last_access') {
        const timeA = a.effectiveLastAccess ? new Date(a.effectiveLastAccess).getTime() : 0;
        const timeB = b.effectiveLastAccess ? new Date(b.effectiveLastAccess).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });
  }, [processedUsers, searchTerm, statusFilter, sortBy]);

  // Métricas para os Cards de Topo
  const totalUsersCount = users.length;
  const activeUsersCount = processedUsers.filter(u => u.computedStatus === 'Ativo').length;
  const totalActionsInPeriod = filteredLogsInPeriod.length;
  const avgActionsPerUser = activeUsersCount > 0 ? (totalActionsInPeriod / activeUsersCount).toFixed(1) : '0';

  // Lógica de Paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Formatação amigável de datas
  const formatFriendlyDate = (isoString?: string | null) => {
    if (!isoString) return 'Nunca acessou';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Inválido';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Hoje às ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Ontem às ${timeStr}`;
    }

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ` às ${timeStr}`;
  };

  // Formatação de minutos em Horas e Minutos
  const formatUsageTime = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Exportar dados agregados em CSV
  const handleExportCSV = () => {
    const headers = [
      'Nome',
      'E-mail',
      'Perfil',
      'Setor',
      'Último Acesso',
      'Logins no Período',
      'Ações no Período',
      'Tempo de Uso Estimado',
      'Status'
    ];

    const rows = filteredUsers.map(u => [
      u.name,
      u.email || 'N/A',
      u.profile || 'Usuário Analista',
      u.sector || 'N/A',
      u.effectiveLastAccess ? new Date(u.effectiveLastAccess).toLocaleString('pt-BR') : 'Sem registro',
      u.periodLogins,
      u.periodActions,
      formatUsageTime(u.totalMinutes),
      u.computedStatus
    ]);

    exportarCSVPadrao(headers, rows, `monitoramento_uso_usuarios_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Render do Modal de Auditoria do Usuário
  const selectedUserLogs = useMemo(() => {
    if (!selectedUserForAudit) return [];
    const logs = activityLogs.filter(l => l.userId === selectedUserForAudit.id);
    if (auditActionFilter === 'all') return logs;
    return logs.filter(l => l.actionType === auditActionFilter);
  }, [activityLogs, selectedUserForAudit, auditActionFilter]);

  // 5. Suporte à navegação de retorno (Tecla ESC e Botão Voltar do Navegador)
  useEffect(() => {
    if (!selectedUserForAudit) return;

    // Listener para tecla ESC
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedUserForAudit(null);
      }
    };

    // Suporte ao botão 'Voltar' do navegador
    window.history.pushState({ auditOpen: true }, '');
    const handlePopState = () => {
      setSelectedUserForAudit(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedUserForAudit]);

  const getActionTypeBadge = (type: UserActivityLog['actionType']) => {
    switch (type) {
      case 'login':
        return { label: 'Login', icon: <LogIn size={13} />, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'project_create':
        return { label: 'Novo Card', icon: <FolderPlus size={13} />, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'project_update':
      case 'project_move':
        return { label: 'Edição Card / Kanban', icon: <Activity size={13} />, bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'subtask_update':
        return { label: 'Subtarefa', icon: <CheckSquare size={13} />, bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      case 'pdca_update':
        return { label: 'Atualização PDCA', icon: <Zap size={13} />, bg: 'bg-violet-50 text-violet-700 border-violet-200' };
      case 'operational_action':
        return { label: 'Ação Operacional', icon: <CheckSquare size={13} />, bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'file_upload':
        return { label: 'Upload Arquivo', icon: <UploadCloud size={13} />, bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'report_download':
        return { label: 'Relatório PDF', icon: <FileText size={13} />, bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: 'Alteração Relevante', icon: <Settings size={13} />, bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 min-h-[600px] flex-1 flex flex-col">
      {/* 1. Cabeçalho Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-100">
              <Activity size={22} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Monitoramento de Usuários</h2>
            <ContextHelp contentKey="monitoramento" size="sm" />
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Painel exclusivo do perfil Master para acompanhamento da frequência de acessos, engajamento e auditoria de atividades.
          </p>
        </div>

        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 px-4 py-2.5 rounded-2xl font-bold text-sm border border-slate-200 shadow-sm transition-all"
        >
          <Download size={16} />
          <span>Exportar Relatório</span>
        </button>
      </div>

      {/* 2. Cards de KPIs executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuários Totais</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{totalUsersCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuários Ativos</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{activeUsersCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl">
            <Zap size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações no Período</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{totalActionsInPeriod}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Média Ações/Usuário</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{avgActionsPerUser}</h3>
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar usuário por nome, e-mail ou setor..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* Filtros em Linha */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Período */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs font-semibold">
            <button 
              onClick={() => { setPeriodFilter('today'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all", periodFilter === 'today' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              Hoje
            </button>
            <button 
              onClick={() => { setPeriodFilter('7days'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all", periodFilter === '7days' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              7 Dias
            </button>
            <button 
              onClick={() => { setPeriodFilter('30days'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all", periodFilter === '30days' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              30 Dias
            </button>
            <button 
              onClick={() => { setPeriodFilter('all'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all", periodFilter === 'all' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              Todos
            </button>
          </div>

          {/* Status */}
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Status: Todos</option>
            <option value="Ativo">Apenas Ativos</option>
            <option value="Inativo">Apenas Inativos</option>
          </select>

          {/* Ordenação */}
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="last_access">Mais Recentes</option>
            <option value="actions_desc">Mais Ativos (Ações)</option>
            <option value="actions_asc">Menos Ativos</option>
            <option value="time_desc">Maior Tempo de Uso</option>
          </select>
        </div>
      </div>

      {/* 4. Tabela de Uso dos Usuários */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <th className="py-4 px-6">Usuário</th>
                <th className="py-4 px-6">E-mail / Perfil</th>
                <th className="py-4 px-6">Último Acesso</th>
                <th className="py-4 px-6 text-center">Logins</th>
                <th className="py-4 px-6 text-center">Ações Realizadas</th>
                <th className="py-4 px-6 text-center">Tempo Est.</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Auditoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((u) => {
                  const initial = (u.name || 'U').charAt(0).toUpperCase();

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Usuário */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 shadow-sm border border-indigo-200/50">
                            {initial}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{u.name}</p>
                            {u.sector && (
                              <p className="text-xs text-slate-400 font-medium">{u.sector}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* E-mail / Perfil */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-700">{u.email || 'E-mail não informado'}</p>
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                            u.profile === 'Usuário Master' ? "bg-purple-50 text-purple-700 border-purple-200" :
                            u.profile === 'Usuário Visualizador' ? "bg-slate-100 text-slate-600 border-slate-200" :
                            "bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}>
                            {u.profile || 'Usuário Analista'}
                          </span>
                        </div>
                      </td>

                      {/* Último Acesso */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                          <Clock size={14} className="text-slate-400 shrink-0" />
                          <span>{formatFriendlyDate(u.effectiveLastAccess)}</span>
                        </div>
                      </td>

                      {/* Logins */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-xl bg-slate-100 font-bold text-xs text-slate-800 border border-slate-200">
                          {u.periodLogins}
                        </span>
                      </td>

                      {/* Ações Realizadas */}
                      <td className="py-4 px-6 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-xl bg-amber-50 font-black text-xs text-amber-700 border border-amber-200">
                            {u.periodActions}
                          </span>
                        </div>
                      </td>

                      {/* Tempo Estimado */}
                      <td className="py-4 px-6 text-center font-bold text-xs text-slate-700 whitespace-nowrap">
                        {formatUsageTime(u.totalMinutes)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs",
                          u.computedStatus === 'Ativo' 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          <span className={cn("w-2 h-2 rounded-full", u.computedStatus === 'Ativo' ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                          {u.computedStatus}
                        </span>
                      </td>

                      {/* Auditoria / Ações */}
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => setSelectedUserForAudit(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl font-bold text-xs border border-slate-200 hover:border-indigo-200 transition-all"
                          title="Ver histórico detalhado de ações"
                        >
                          <Eye size={14} />
                          <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">Nenhum usuário encontrado com os filtros aplicados.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">
              Mostrando página <span className="font-bold text-slate-900">{currentPage}</span> de <span className="font-bold text-slate-900">{totalPages}</span> ({filteredUsers.length} usuários)
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modal Slide-Over de Auditoria Detalhada do Usuário */}
      {selectedUserForAudit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col p-6 overflow-hidden">
            {/* Breadcrumb e Navegação de Retorno */}
            <div className="flex flex-col gap-3 pb-4 border-b border-slate-200">
              <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 overflow-x-auto py-0.5">
                <span>Configurações</span>
                <ChevronRight size={12} className="text-slate-400 shrink-0" />
                <button 
                  onClick={() => setSelectedUserForAudit(null)} 
                  className="hover:text-indigo-600 font-semibold hover:underline transition-colors shrink-0"
                >
                  Monitoramento de Usuários
                </button>
                <ChevronRight size={12} className="text-slate-400 shrink-0" />
                <span className="text-indigo-600 font-bold shrink-0">Auditoria: {selectedUserForAudit.name}</span>
              </nav>

              <div className="flex items-center justify-between gap-3">
                <button 
                  onClick={() => setSelectedUserForAudit(null)}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all border border-slate-200 hover:border-indigo-200 shadow-2xs"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar para Monitoramento de Usuários</span>
                </button>

                <button 
                  onClick={() => setSelectedUserForAudit(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  title="Fechar (Pressione ESC)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Cabeçalho do Usuário */}
            <div className="flex items-center gap-3 pt-4 pb-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-md shadow-indigo-100">
                {(selectedUserForAudit.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{selectedUserForAudit.name}</h3>
                <p className="text-xs text-slate-500">{selectedUserForAudit.email || 'E-mail não informado'} • {selectedUserForAudit.profile || 'Usuário Analista'}</p>
              </div>
            </div>

            {/* Resumo do Usuário no Modal */}
            <div className="my-4 grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Logins Registrados</p>
                <p className="text-base font-black text-slate-900 mt-0.5">{selectedUserForAudit.periodLogins || selectedUserForAudit.loginCount || 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Total de Ações</p>
                <p className="text-base font-black text-indigo-600 mt-0.5">{selectedUserForAudit.periodActions || selectedUserForAudit.actionCount || 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Tempo de Uso</p>
                <p className="text-base font-black text-slate-900 mt-0.5">{formatUsageTime(selectedUserForAudit.totalMinutes || 0)}</p>
              </div>
            </div>

            {/* Filtro de Tipo de Ação na Auditoria */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico de Atividades</h4>
              <select 
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Todas as Ações</option>
                <option value="login">Logins</option>
                <option value="project_create">Criação de Projetos</option>
                <option value="project_update">Edições / Kanban</option>
                <option value="operational_action">Ações Operacionais</option>
                <option value="file_upload">Upload de Arquivos</option>
                <option value="report_download">Relatórios</option>
              </select>
            </div>

            {/* Lista com Scroll de Logs */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {selectedUserLogs.length > 0 ? (
                selectedUserLogs.map((log) => {
                  const badge = getActionTypeBadge(log.actionType);

                  return (
                    <div key={log.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border", badge.bg)}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatFriendlyDate(log.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-800">{log.actionName}</p>
                      {log.details && (
                        <p className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                          {log.details}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Activity size={32} className="mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">Nenhum registro de atividade capturado para este filtro.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
