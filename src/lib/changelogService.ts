export type ChangelogType = 'feature' | 'fix' | 'melhoria' | 'ajuste';

export interface ChangelogEvent {
  id: string;
  timestamp: string; // ISO 8601 string, e.g. "2026-07-24T11:35:00.000Z"
  tipo: ChangelogType;
  descricao: string; // 1 linha
  origem: string; // e.g. 'BPMN', 'PDCA', 'Relatórios', 'Dashboard', 'Ações', 'Notificações'
  icon?: string;
}

export interface GroupedChangelog {
  dateLabel: string;
  isToday: boolean;
  events: ChangelogEvent[];
}

const CHANGELOG_STORAGE_KEY = 'changelog_events';

// Mapeamento automático de ícones por tipo ou origem
export function getEventIcon(tipo: ChangelogType, origem: string, customIcon?: string): string {
  if (customIcon) return customIcon;
  if (origem.toLowerCase().includes('bpmn')) return '🌐';
  if (origem.toLowerCase().includes('notifica')) return '🔔';
  if (origem.toLowerCase().includes('pdca')) return '✏️';
  if (origem.toLowerCase().includes('filtro') || origem.toLowerCase().includes('ações')) return '⚡';
  if (origem.toLowerCase().includes('relatóri')) return '📄';
  if (origem.toLowerCase().includes('dashboard') || origem.toLowerCase().includes('gráfico')) return '📊';

  switch (tipo) {
    case 'feature':
      return '✨';
    case 'fix':
      return '🐞';
    case 'melhoria':
      return '⚡';
    case 'ajuste':
      return '🎯';
    default:
      return '🔹';
  }
}

// Inicializa ou carrega os eventos armazenados
export function getStoredChangelogEvents(): ChangelogEvent[] {
  try {
    const raw = localStorage.getItem(CHANGELOG_STORAGE_KEY);
    if (raw) {
      const parsed: ChangelogEvent[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler changelog do localStorage:', err);
  }

  // Seed inicial de eventos reais gravados no log do sistema
  const now = new Date();
  const todayISO = now.toISOString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayISO = yesterday.toISOString();

  const initialEvents: ChangelogEvent[] = [
    {
      id: 'evt-1',
      timestamp: todayISO,
      tipo: 'feature',
      descricao: 'Tradução dos elementos de alteração do BPMN',
      origem: 'BPMN',
      icon: '🌐'
    },
    {
      id: 'evt-2',
      timestamp: todayISO,
      tipo: 'ajuste',
      descricao: 'Ajustes e correções dos símbolos da guia BPMN',
      origem: 'BPMN',
      icon: '🎨'
    },
    {
      id: 'evt-3',
      timestamp: todayISO,
      tipo: 'feature',
      descricao: 'Permissão de edição no histórico da etapa DO do PDCA',
      origem: 'PDCA',
      icon: '✏️'
    },
    {
      id: 'evt-4',
      timestamp: todayISO,
      tipo: 'feature',
      descricao: 'Inclusão do sistema de notificações em tempo real',
      origem: 'Notificações',
      icon: '🔔'
    },
    {
      id: 'evt-5',
      timestamp: todayISO,
      tipo: 'melhoria',
      descricao: 'Filtros dinâmicos no histórico de ações do projeto',
      origem: 'Ações',
      icon: '⚡'
    },
    {
      id: 'evt-6',
      timestamp: todayISO,
      tipo: 'fix',
      descricao: 'Ajuste no gráfico de ganhos por projeto com suporte a valores negativos',
      origem: 'Dashboard',
      icon: '📊'
    },
    {
      id: 'evt-7',
      timestamp: todayISO,
      tipo: 'ajuste',
      descricao: 'Remoção do campo potencial no card de Ganho Geral',
      origem: 'Dashboard',
      icon: '🎯'
    },
    {
      id: 'evt-8',
      timestamp: todayISO,
      tipo: 'feature',
      descricao: 'Vínculo de ciclo PDCA compartilhado entre múltiplas subtarefas',
      origem: 'PDCA',
      icon: '🔗'
    },
    {
      id: 'evt-9',
      timestamp: todayISO,
      tipo: 'melhoria',
      descricao: 'Indicador visual de subtarefas vinculadas ao PDCA',
      origem: 'PDCA',
      icon: '🏷️'
    },
    {
      id: 'evt-10',
      timestamp: yesterdayISO,
      tipo: 'feature',
      descricao: 'Histórico de interações no plano de ação',
      origem: 'Ações',
      icon: '💬'
    },
    {
      id: 'evt-11',
      timestamp: yesterdayISO,
      tipo: 'ajuste',
      descricao: 'Padronização visual das badges de status do PDCA',
      origem: 'PDCA',
      icon: '📈'
    },
    {
      id: 'evt-12',
      timestamp: yesterdayISO,
      tipo: 'melhoria',
      descricao: 'Busca textual instantânea na matriz 5W2H',
      origem: 'Relatórios',
      icon: '🔍'
    },
    {
      id: 'evt-13',
      timestamp: yesterdayISO,
      tipo: 'feature',
      descricao: 'Filtros avançados na exportação de relatórios gerenciais',
      origem: 'Relatórios',
      icon: '📄'
    }
  ];

  try {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, JSON.stringify(initialEvents));
  } catch (err) {
    console.error('Erro ao salvar changelog inicial no localStorage:', err);
  }

  return initialEvents;
}

// Registra um evento automaticamente no changelog_events
export function recordChangelogEvent(
  tipo: ChangelogType,
  descricao: string,
  origem: string,
  icon?: string
): ChangelogEvent {
  const events = getStoredChangelogEvents();

  // Deduplicação: previne eventos idênticos em curto intervalo (< 15s)
  const now = new Date();
  const recentDuplicate = events.find(evt => {
    if (evt.descricao === descricao && evt.origem === origem) {
      const timeDiff = now.getTime() - new Date(evt.timestamp).getTime();
      return timeDiff < 15000; // 15 segundos
    }
    return false;
  });

  if (recentDuplicate) {
    return recentDuplicate;
  }

  const newEvent: ChangelogEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    tipo,
    descricao,
    origem,
    icon: icon || getEventIcon(tipo, origem)
  };

  const updated = [newEvent, ...events];
  try {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, JSON.stringify(updated));
    // Dispara evento customizado para re-renderizar componentes escutando
    window.dispatchEvent(new CustomEvent('changelog_updated'));
  } catch (err) {
    console.error('Erro ao salvar evento no changelog:', err);
  }

  return newEvent;
}

// Helpers padronizados para registro automático de eventos
export function logFeature(descricao: string, origem: string, icon?: string): ChangelogEvent {
  return recordChangelogEvent('feature', descricao, origem, icon || '✨');
}

export function logFix(descricao: string, origem: string, icon?: string): ChangelogEvent {
  return recordChangelogEvent('fix', descricao, origem, icon || '🐞');
}

export function logMelhoria(descricao: string, origem: string, icon?: string): ChangelogEvent {
  return recordChangelogEvent('melhoria', descricao, origem, icon || '⚡');
}

export function logAjuste(descricao: string, origem: string, icon?: string): ChangelogEvent {
  return recordChangelogEvent('ajuste', descricao, origem, icon || '🎯');
}

// Retorna apenas eventos dos últimos 7 dias, agrupados por data ("Hoje", "Ontem" ou "DD/MM/YYYY")
export function getRecentChangelogGrouped(daysLimit: number = 7): GroupedChangelog[] {
  const events = getStoredChangelogEvents();
  const now = new Date();
  const limitDate = new Date();
  limitDate.setDate(now.getDate() - daysLimit);
  limitDate.setHours(0, 0, 0, 0);

  // Filtrar eventos dentro dos últimos 7 dias
  const recentEvents = events.filter(evt => {
    const evtDate = new Date(evt.timestamp);
    return !isNaN(evtDate.getTime()) && evtDate >= limitDate;
  });

  if (recentEvents.length === 0) {
    return [];
  }

  // Ordenar mais recentes primeiro
  recentEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Agrupar por dia
  const groupsMap: Map<string, { label: string; isToday: boolean; events: ChangelogEvent[] }> = new Map();

  const todayStr = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterdayStr = yesterdayDate.toDateString();

  recentEvents.forEach(evt => {
    const d = new Date(evt.timestamp);
    const dStr = d.toDateString();

    let label = '';
    let isToday = false;

    if (dStr === todayStr) {
      label = 'Hoje';
      isToday = true;
    } else if (dStr === yesterdayStr) {
      label = 'Ontem';
    } else {
      label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    if (!groupsMap.has(label)) {
      groupsMap.set(label, { label, isToday, events: [] });
    }

    groupsMap.get(label)!.events.push(evt);
  });

  return Array.from(groupsMap.values()).map(g => ({
    dateLabel: g.label,
    isToday: g.isToday,
    events: g.events
  }));
}
