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
  X,
  Info,
  ChevronDown,
  Layers,
  Sparkles,
  MousePointerClick,
  UserCheck
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, handleFirestoreError, OperationType } from '../firebase';
import { User, UserActivityLog, UserDailyActivity } from '../types';
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
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | '30days' | 'custom' | 'all'>('30days');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ativo' | 'Inativo'>('all');
  const [sortBy, setSortBy] = useState<'last_active' | 'last_access' | 'time_desc' | 'actions_desc' | 'actions_asc'>('last_active');

  // Estados de Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Logs de atividade e registros diários em tempo real
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);
  const [dailyActivities, setDailyActivities] = useState<UserDailyActivity[]>([]);
  const [selectedUserForAudit, setSelectedUserForAudit] = useState<User | null>(null);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [isRulesExpanded, setIsRulesExpanded] = useState<boolean>(false);

  // Busca logs de auditoria e registros diários no Firestore
  useEffect(() => {
    if (!isMaster) return;

    const qLogs = query(collection(db, 'userActivityLogs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivityLog));
      setActivityLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'userActivityLogs');
    });

    const unsubscribeDaily = onSnapshot(collection(db, 'userDailyActivity'), (snapshot) => {
      const dailies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserDailyActivity));
      setDailyActivities(dailies);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'userDailyActivity');
    });

    return () => {
      unsubscribeLogs();
      unsubscribeDaily();
    };
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
            Esta aba contém relatórios confidenciais de monitoramento e auditoria de uso do sistema e está disponível exclusivamente para Administradores Principais (Usuário Master).
          </p>
        </div>
      </div>
    );
  }

  // Intervalo de datas no formato YYYY-MM-DD e Timestamps
  const { periodStartTimestamp, periodEndTimestamp, periodStartDateStr, periodEndDateStr } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (periodFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        periodStartTimestamp: startOfDay.getTime(),
        periodEndTimestamp: endOfDay.getTime(),
        periodStartDateStr: todayStr,
        periodEndDateStr: todayStr
      };
    }

    if (periodFilter === '7days') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        periodStartTimestamp: start.getTime(),
        periodEndTimestamp: end.getTime(),
        periodStartDateStr: start.toISOString().split('T')[0],
        periodEndDateStr: todayStr
      };
    }

    if (periodFilter === '30days') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        periodStartTimestamp: start.getTime(),
        periodEndTimestamp: end.getTime(),
        periodStartDateStr: start.toISOString().split('T')[0],
        periodEndDateStr: todayStr
      };
    }

    if (periodFilter === 'custom') {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : new Date();
      return {
        periodStartTimestamp: start.getTime(),
        periodEndTimestamp: end.getTime(),
        periodStartDateStr: customStartDate || '1970-01-01',
        periodEndDateStr: customEndDate || todayStr
      };
    }

    // Todos
    return {
      periodStartTimestamp: 0,
      periodEndTimestamp: Number.MAX_SAFE_INTEGER,
      periodStartDateStr: '1970-01-01',
      periodEndDateStr: '2999-12-31'
    };
  }, [periodFilter, customStartDate, customEndDate]);

  // Logs filtrados pelo período
  const filteredLogsInPeriod = useMemo(() => {
    return activityLogs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      if (isNaN(logTime)) return false;
      return logTime >= periodStartTimestamp && logTime <= periodEndTimestamp;
    });
  }, [activityLogs, periodStartTimestamp, periodEndTimestamp]);

  // Registros diários filtrados pelo período
  const filteredDailiesInPeriod = useMemo(() => {
    return dailyActivities.filter(d => {
      if (!d.date) return false;
      return d.date >= periodStartDateStr && d.date <= periodEndDateStr;
    });
  }, [dailyActivities, periodStartDateStr, periodEndDateStr]);

  // Consolidação precisa e auditável de métricas por usuário (ÚNICA FONTE DE VERDADE)
  const userStatsMap = useMemo(() => {
    const map = new Map<string, {
      lastLogin: string | null;
      lastActive: string | null;
      lastPresence: string | null;
      activeSeconds: number;
      sessionsCount: number;
      actionsCount: number;
      activeDaysSet: Set<string>;
      logs: UserActivityLog[];
    }>();

    // 1. Inicializa todos os usuários com dados base
    users.forEach(u => {
      map.set(u.id, {
        lastLogin: u.lastLoginAt || u.lastAccess || null,
        lastActive: u.lastActiveAt || u.lastAccess || null,
        lastPresence: u.lastPresenceAt || u.lastActiveAt || null,
        activeSeconds: 0,
        sessionsCount: 0,
        actionsCount: 0,
        activeDaysSet: new Set<string>(),
        logs: [],
      });
    });

    // 2. Agrega tempo ativo, sessões e dias ativos a partir de userDailyActivity no período selecionado
    filteredDailiesInPeriod.forEach(d => {
      if (!d.userId) return;
      const current = map.get(d.userId) || {
        lastLogin: null,
        lastActive: null,
        lastPresence: null,
        activeSeconds: 0,
        sessionsCount: 0,
        actionsCount: 0,
        activeDaysSet: new Set<string>(),
        logs: [],
      };

      const daySeconds = d.activeSeconds || 0;
      const dayActions = d.actionsCount || 0;

      current.activeSeconds += daySeconds;

      // REGRA OFICIAL DE DIA ATIVO: Mínimo de 1 minuto (>= 60s) de Tempo Ativo ou pelo menos 1 ação relevante
      if (daySeconds >= 60 || dayActions > 0) {
        current.activeDaysSet.add(d.date);
        // Sessão válida com utilização efetiva
        current.sessionsCount += Math.max(1, d.sessionsCount || 0);
      }

      current.actionsCount += dayActions;

      if (d.lastActiveAt) {
        if (!current.lastActive || new Date(d.lastActiveAt) > new Date(current.lastActive)) {
          current.lastActive = d.lastActiveAt;
        }
      }

      map.set(d.userId, current);
    });

    // 3. Agrega logs reais dentro do período
    filteredLogsInPeriod.forEach(log => {
      if (!log.userId) return;
      const current = map.get(log.userId) || {
        lastLogin: null,
        lastActive: null,
        lastPresence: null,
        activeSeconds: 0,
        sessionsCount: 0,
        actionsCount: 0,
        activeDaysSet: new Set<string>(),
        logs: [],
      };

      current.logs.push(log);

      const logDate = log.timestamp.split('T')[0];
      if (logDate && log.actionType !== 'login') {
        current.activeDaysSet.add(logDate);
      }

      if (log.actionType === 'login') {
        if (!current.lastLogin || new Date(log.timestamp) > new Date(current.lastLogin)) {
          current.lastLogin = log.timestamp;
        }
      } else {
        // Operação relevante concluída
        if (!current.lastActive || new Date(log.timestamp) > new Date(current.lastActive)) {
          current.lastActive = log.timestamp;
        }
      }

      map.set(log.userId, current);
    });

    // 4. Fallback retrocompatível de tempo caso o usuário ainda não possua registros diários
    users.forEach(u => {
      const stats = map.get(u.id);
      if (stats && stats.activeSeconds === 0 && u.totalActiveSeconds) {
        stats.activeSeconds = u.totalActiveSeconds;
      }
      if (stats && stats.sessionsCount === 0 && u.loginCount) {
        stats.sessionsCount = u.loginCount;
      }
      if (stats && stats.actionsCount === 0 && u.actionCount) {
        stats.actionsCount = u.actionCount;
      }
    });

    return map;
  }, [users, filteredDailiesInPeriod, filteredLogsInPeriod]);

  // Lista processada de usuários para tabela e cards
  const processedUsers = useMemo(() => {
    const nowTime = Date.now();
    // REGRA OFICIAL: Interação e presença nos últimos 5 MINUTOS (300.000 ms)
    const fiveMinutesAgo = nowTime - (5 * 60 * 1000);
    const sevenDaysAgo = nowTime - (7 * 24 * 60 * 60 * 1000);

    return users.map(user => {
      const stats = userStatsMap.get(user.id) || {
        lastLogin: user.lastLoginAt || user.lastAccess || null,
        lastActive: user.lastActiveAt || user.lastAccess || null,
        lastPresence: user.lastPresenceAt || user.lastActiveAt || null,
        activeSeconds: user.totalActiveSeconds || (user.totalUsageMinutes ? user.totalUsageMinutes * 60 : 0),
        sessionsCount: user.loginCount || 0,
        actionsCount: user.actionCount || 0,
        activeDaysSet: new Set<string>(),
        logs: [],
      };

      // Avaliação de "Ativo Agora":
      // 1. Presença recente (lastPresenceAt ou lastActiveAt nos últimos 5 minutos)
      // 2. Não possui flag explícita de offline/logout
      const rawPresenceTime = stats.lastPresence || user.lastPresenceAt || stats.lastActive || user.lastActiveAt;
      const lastPresenceTimestamp = rawPresenceTime ? new Date(rawPresenceTime).getTime() : 0;
      const isOnlineNow = (lastPresenceTimestamp > fiveMinutesAgo) && (user.isOnline !== false);

      const isRecentlyActive = lastPresenceTimestamp > sevenDaysAgo || stats.actionsCount > 0 || stats.activeSeconds >= 60;
      const computedStatus: 'Ativo' | 'Inativo' = isRecentlyActive ? 'Ativo' : 'Inativo';

      const activeMinutes = Math.round(stats.activeSeconds / 60);
      const activeDays = stats.activeDaysSet.size;
      const sessions = Math.max(stats.sessionsCount, activeDays > 0 ? activeDays : (stats.actionsCount > 0 ? 1 : 0));
      const avgSecondsPerSession = sessions > 0 ? Math.round(stats.activeSeconds / sessions) : 0;

      return {
        ...user,
        effectiveLastLogin: stats.lastLogin,
        effectiveLastActive: stats.lastActive,
        effectiveLastPresence: stats.lastPresence || user.lastPresenceAt,
        periodActiveSeconds: stats.activeSeconds,
        periodActiveMinutes: activeMinutes,
        periodActions: stats.actionsCount,
        periodSessions: sessions,
        periodActiveDays: activeDays,
        avgSecondsPerSession,
        isOnlineNow,
        computedStatus,
        userLogs: stats.logs,
      };
    });
  }, [users, userStatsMap]);

  // Aplicação de busca e filtros de status/ordenação
  const filteredUsers = useMemo(() => {
    return processedUsers.filter(u => {
      const matchesSearch = 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.sector || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || (
        statusFilter === 'Ativo' ? (u.isOnlineNow || u.computedStatus === 'Ativo') : (!u.isOnlineNow && u.computedStatus === 'Inativo')
      );

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'last_active') {
        const timeA = a.effectiveLastActive ? new Date(a.effectiveLastActive).getTime() : 0;
        const timeB = b.effectiveLastActive ? new Date(b.effectiveLastActive).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'last_access') {
        const timeA = a.effectiveLastLogin ? new Date(a.effectiveLastLogin).getTime() : 0;
        const timeB = b.effectiveLastLogin ? new Date(b.effectiveLastLogin).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'time_desc') {
        return b.periodActiveSeconds - a.periodActiveSeconds;
      }
      if (sortBy === 'actions_desc') {
        return b.periodActions - a.periodActions;
      }
      if (sortBy === 'actions_asc') {
        return a.periodActions - b.periodActions;
      }
      return 0;
    });
  }, [processedUsers, searchTerm, statusFilter, sortBy]);

  // Formatação de Segundos em Horas, Minutos e Segundos
  const formatActiveTime = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return '0 min';
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) {
      const remainingSeconds = totalSeconds % 60;
      return remainingSeconds > 0 ? `${totalMinutes}m ${remainingSeconds}s` : `${totalMinutes} min`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  // -------------------------------------------------------------
  // MÉTRICAS CONSOLIDADAS PARA OS CARDS DE TOPO (EXATAMENTE A MESMA FONTE)
  // -------------------------------------------------------------
  // 1. Usuários Ativos Agora: Presença real com interação nos últimos 5 minutos
  const activeNowCount = processedUsers.filter(u => u.isOnlineNow).length;
  // 2. Usuários que Utilizaram no Período: Usuários com pelo menos 1 Dia Ativo (>= 1 min de uso) no período
  const periodUsersCount = processedUsers.filter(u => u.periodActiveDays >= 1 || u.periodActiveSeconds >= 60 || u.periodActions > 0).length;
  // 3. Tempo Ativo Total no Período: Soma dos tempos ativos reais
  const totalPeriodActiveSeconds = processedUsers.reduce((sum, u) => sum + u.periodActiveSeconds, 0);
  // 4. Ações Realizadas no Período: Soma das operações concluídas com sucesso
  const totalPeriodActions = processedUsers.reduce((sum, u) => sum + u.periodActions, 0);
  // 5. Média por Sessão: Tempo ativo total / total de sessões válidas
  const totalPeriodSessions = processedUsers.reduce((sum, u) => sum + u.periodSessions, 0);
  const overallAvgSecondsPerSession = totalPeriodSessions > 0 ? Math.round(totalPeriodActiveSeconds / totalPeriodSessions) : 0;

  // Lógica de Paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Formatação amigável de datas e horários
  const formatFriendlyDate = (isoString?: string | null) => {
    if (!isoString) return 'Sem registro';
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

  // Exportar dados agregados em CSV
  const handleExportCSV = () => {
    const headers = [
      'Nome',
      'E-mail',
      'Perfil',
      'Setor',
      'Último Acesso (Login)',
      'Última Atividade Relevante',
      'Tempo Ativo Real',
      'Ações Relevantes',
      'Dias Ativos no Período',
      'Sessões Válidas no Período',
      'Tempo Médio por Sessão',
      'Status Atual'
    ];

    const rows = filteredUsers.map(u => [
      u.name,
      u.email || 'N/A',
      u.profile || 'Usuário Analista',
      u.sector || 'N/A',
      u.effectiveLastLogin ? new Date(u.effectiveLastLogin).toLocaleString('pt-BR') : 'Sem registro',
      u.effectiveLastActive ? new Date(u.effectiveLastActive).toLocaleString('pt-BR') : 'Sem registro',
      formatActiveTime(u.periodActiveSeconds),
      u.periodActions,
      u.periodActiveDays,
      u.periodSessions,
      formatActiveTime(u.avgSecondsPerSession),
      u.isOnlineNow ? 'Ativo agora' : u.computedStatus
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

  // Suporte à navegação de retorno (Tecla ESC e Botão Voltar do Navegador)
  useEffect(() => {
    if (!selectedUserForAudit) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedUserForAudit(null);
      }
    };

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
        return { label: 'Criação de Card', icon: <FolderPlus size={13} />, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
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
            Painel auditável para acompanhamento de tempo de uso ativo real, acessos e operações realizadas pelos usuários.
          </p>
        </div>

        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 px-4 py-2.5 rounded-2xl font-bold text-sm border border-slate-200 shadow-sm transition-all cursor-pointer"
        >
          <Download size={16} />
          <span>Exportar Relatório</span>
        </button>
      </div>

      {/* 2. Cards de KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Usuários Ativos Agora */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl relative">
            <UserCheck size={22} />
            {activeNowCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ativos Agora</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{activeNowCount}</h3>
            <p className="text-[10px] text-emerald-600 font-bold">Interação nos últimos 5 min</p>
          </div>
        </div>

        {/* Card 2: Usuários que Utilizaram no Período */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utilizaram no Período</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{periodUsersCount} <span className="text-xs text-slate-400 font-semibold">/ {users.length}</span></h3>
            <p className="text-[10px] text-slate-400 font-semibold">Com ≥ 1 dia ativo</p>
          </div>
        </div>

        {/* Card 3: Tempo Ativo Total */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tempo Ativo Total</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{formatActiveTime(totalPeriodActiveSeconds)}</h3>
            <p className="text-[10px] text-slate-400 font-semibold">Utilização real no período</p>
          </div>
        </div>

        {/* Card 4: Ações Realizadas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl">
            <Zap size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações Realizadas</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{totalPeriodActions}</h3>
            <p className="text-[10px] text-slate-400 font-semibold">Operações concluídas</p>
          </div>
        </div>

        {/* Card 5: Média por Sessão */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xl">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Média / Sessão</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{formatActiveTime(overallAvgSecondsPerSession)}</h3>
            <p className="text-[10px] text-slate-400 font-semibold">Por sessão válida</p>
          </div>
        </div>
      </div>

      {/* 3. Guia de Transparência das Regras de Cálculo e Auditoria */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
        <button 
          onClick={() => setIsRulesExpanded(!isRulesExpanded)}
          className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <Info size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Como essas métricas são calculadas? (Regras e Critérios Oficiais)</h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Clique para visualizar as definições matemáticas e as regras de medição de presença, tempo ativo e ações.
              </p>
            </div>
          </div>
          <ChevronDown size={18} className={cn("text-slate-400 transition-transform duration-200 shrink-0", isRulesExpanded && "rotate-180")} />
        </button>

        {isRulesExpanded && (
          <div className="px-5 pb-6 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-4 bg-slate-50/40 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <UserCheck size={15} className="text-emerald-600" />
                  <span>Ativo Agora</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Usuário autenticado com aba visível e interação comprovada nos últimos <strong>5 minutos</strong>. Após 5 minutos sem interação ou se a aba for minimizada/fechada, o status passa imediatamente para <strong>Inativo</strong>.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Clock size={15} className="text-blue-600" />
                  <span>Tempo Ativo Real</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Soma dos períodos em que o usuário esteve efetivamente utilizando o GIP Flow. Janelas de inatividade (&gt;5 min), abas em segundo plano (Excel, Teams, etc.) e navegador fechado são automaticamente pausados. Múltiplas abas não duplicam o tempo.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Calendar size={15} className="text-purple-600" />
                  <span>Dia Ativo</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Dia calendário com pelo menos <strong>1 minuto de tempo ativo real</strong> (≥ 60s) ou pelo menos uma operação relevante concluída. Um mesmo dia conta no máximo 1 vez, independente da quantidade de acessos.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <LogIn size={15} className="text-indigo-600" />
                  <span>Sessões Válidas</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Entrada autenticada que gerou pelo menos 1 minuto de utilização real. Recarregar a página (F5) ou abrir novas abas não cria sessões adicionais.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Zap size={15} className="text-amber-600" />
                  <span>Ações Realizadas</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Total de operações relevantes <strong>concluídas com sucesso</strong> (cards, subtarefas, ações operacionais, PDCA, BPMN, uploads e relatórios). Cliques vazios, navegação e filtros não são contados como ações de alteração de dados.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Activity size={15} className="text-cyan-600" />
                  <span>Último Acesso vs Atividade</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Último Acesso</strong> é o momento do login. <strong>Última Atividade</strong> é o momento da última operação relevante ou interação ativa registrada.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Barra de Filtros e Busca */}
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
              className={cn("px-3 py-1.5 rounded-xl transition-all cursor-pointer", periodFilter === 'today' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              Hoje
            </button>
            <button 
              onClick={() => { setPeriodFilter('7days'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all cursor-pointer", periodFilter === '7days' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              7 Dias
            </button>
            <button 
              onClick={() => { setPeriodFilter('30days'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all cursor-pointer", periodFilter === '30days' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              30 Dias
            </button>
            <button 
              onClick={() => { setPeriodFilter('custom'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all cursor-pointer", periodFilter === 'custom' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              Personalizado
            </button>
            <button 
              onClick={() => { setPeriodFilter('all'); setCurrentPage(1); }}
              className={cn("px-3 py-1.5 rounded-xl transition-all cursor-pointer", periodFilter === 'all' ? "bg-indigo-600 text-white shadow-sm font-bold" : "text-slate-600 hover:text-slate-900")}
            >
              Todos
            </button>
          </div>

          {/* Seletores de Data Personalizada */}
          {periodFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-2xl border border-slate-200 text-xs">
              <span className="font-semibold text-slate-500">De:</span>
              <input 
                type="date" 
                value={customStartDate} 
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none"
              />
              <span className="font-semibold text-slate-500">Até:</span>
              <input 
                type="date" 
                value={customEndDate} 
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none"
              />
            </div>
          )}

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
            <option value="last_active">Última Atividade</option>
            <option value="last_access">Último Acesso (Login)</option>
            <option value="time_desc">Maior Tempo Ativo</option>
            <option value="actions_desc">Mais Ações Realizadas</option>
            <option value="actions_asc">Menos Ações</option>
          </select>
        </div>
      </div>

      {/* 5. Tabela de Monitoramento de Usuários */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <th className="py-4 px-6">Usuário</th>
                <th className="py-4 px-6">E-mail / Perfil</th>
                <th className="py-4 px-6">Último Acesso</th>
                <th className="py-4 px-6">Última Atividade</th>
                <th className="py-4 px-6 text-center">Tempo Ativo</th>
                <th className="py-4 px-6 text-center">Ações</th>
                <th className="py-4 px-6 text-center">Dias Ativos</th>
                <th className="py-4 px-6 text-center">Sessões</th>
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

                      {/* Último Acesso (Login) */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                          <LogIn size={14} className="text-emerald-500 shrink-0" />
                          <span>{formatFriendlyDate(u.effectiveLastLogin)}</span>
                        </div>
                      </td>

                      {/* Última Atividade Relevante */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                          <Clock size={14} className="text-indigo-500 shrink-0" />
                          <span>{formatFriendlyDate(u.effectiveLastActive)}</span>
                        </div>
                      </td>

                      {/* Tempo Ativo Real */}
                      <td className="py-4 px-6 text-center font-bold text-xs text-slate-800 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 font-black">
                          {formatActiveTime(u.periodActiveSeconds)}
                        </span>
                      </td>

                      {/* Ações Realizadas */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-xl bg-amber-50 font-black text-xs text-amber-700 border border-amber-200">
                          {u.periodActions}
                        </span>
                      </td>

                      {/* Dias Ativos */}
                      <td className="py-4 px-6 text-center font-bold text-xs text-slate-700">
                        {u.periodActiveDays}
                      </td>

                      {/* Sessões Válidas */}
                      <td className="py-4 px-6 text-center font-bold text-xs text-slate-700">
                        {u.periodSessions}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        {u.isOnlineNow ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Ativo agora
                          </span>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs",
                            u.computedStatus === 'Ativo' 
                              ? "bg-slate-100 text-slate-700 border-slate-200" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          )}>
                            <span className={cn("w-2 h-2 rounded-full", u.computedStatus === 'Ativo' ? "bg-slate-500" : "bg-slate-300")} />
                            {u.computedStatus}
                          </span>
                        )}
                      </td>

                      {/* Auditoria / Detalhes */}
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => setSelectedUserForAudit(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl font-bold text-xs border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer"
                          title="Ver histórico detalhado de ações e auditoria"
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
                  <td colSpan={10} className="py-12 text-center text-slate-400">
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
                className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Modal Slide-Over de Auditoria Detalhada do Usuário */}
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
                  className="hover:text-indigo-600 font-semibold hover:underline transition-colors shrink-0 cursor-pointer"
                >
                  Monitoramento de Usuários
                </button>
                <ChevronRight size={12} className="text-slate-400 shrink-0" />
                <span className="text-indigo-600 font-bold shrink-0">Auditoria: {selectedUserForAudit.name}</span>
              </nav>

              <div className="flex items-center justify-between gap-3">
                <button 
                  onClick={() => setSelectedUserForAudit(null)}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all border border-slate-200 hover:border-indigo-200 shadow-2xs cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar para Monitoramento de Usuários</span>
                </button>

                <button 
                  onClick={() => setSelectedUserForAudit(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
            <div className="my-4 grid grid-cols-4 gap-2.5 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Último Login</p>
                <p className="text-xs font-black text-slate-900 mt-1 truncate">
                  {selectedUserForAudit.effectiveLastLogin ? formatFriendlyDate(selectedUserForAudit.effectiveLastLogin) : 'Sem registro'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Última Atividade</p>
                <p className="text-xs font-black text-slate-900 mt-1 truncate">
                  {selectedUserForAudit.effectiveLastActive ? formatFriendlyDate(selectedUserForAudit.effectiveLastActive) : 'Sem registro'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Tempo Ativo</p>
                <p className="text-xs font-black text-blue-600 mt-1">
                  {formatActiveTime(selectedUserForAudit.periodActiveSeconds || selectedUserForAudit.totalActiveSeconds || 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Ações Realizadas</p>
                <p className="text-xs font-black text-amber-600 mt-1">
                  {selectedUserForAudit.periodActions || selectedUserForAudit.actionCount || 0}
                </p>
              </div>
            </div>

            {/* Filtro de Tipo de Ação na Auditoria */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico de Atividades Auditadas</h4>
              <select 
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Todas as Ações</option>
                <option value="login">Logins</option>
                <option value="project_create">Criação de Cards</option>
                <option value="project_update">Edições / Kanban</option>
                <option value="subtask_update">Subtarefas</option>
                <option value="pdca_update">Atualizações PDCA</option>
                <option value="operational_action">Ações Operacionais</option>
                <option value="file_upload">Upload de Arquivos</option>
                <option value="report_download">Relatórios</option>
              </select>
            </div>

            {/* Lista com Scroll dos Logs de Auditoria */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedUserLogs.length > 0 ? (
                selectedUserLogs.map((log) => {
                  const badge = getActionTypeBadge(log.actionType);

                  return (
                    <div key={log.id} className="p-3.5 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition-colors space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border", badge.bg)}>
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-900">{log.actionName}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                          {formatFriendlyDate(log.timestamp)}
                        </span>
                      </div>

                      {log.details && (
                        <p className="text-xs text-slate-600 font-medium pl-1">{log.details}</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Activity size={32} className="text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">Nenhuma atividade registrada para este filtro.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
