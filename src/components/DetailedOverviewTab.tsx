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
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Target, 
  Search, 
  ArrowUpDown, 
  Building2, 
  Eye, 
  Filter, 
  X,
  Sparkles,
  ChevronDown,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { SYSTEM_LOGO_PATH } from '../constants/pdfLogo';
import { getBase64ImageFromUrl } from '../lib/utils';
import { Project, User, PDCACycle, Subtask } from '../types';
import { ComputedProjectItem, filterActiveProjects, computeProjectItems, filterComputedData, sortComputedData } from '../utils/calculations';
import { cn } from '../lib/utils';
import FilterDropdown from './FilterDropdown';

// Set up pdfMake fonts
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if ((pdfFonts as any).vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).vfs;
}

interface DetailedOverviewTabProps {
  projects: Project[];
  users: User[];
  onProjectClick: (id: string) => void;
  id?: string;
}

export default function DetailedOverviewTab({ projects, users, onProjectClick }: DetailedOverviewTabProps) {
  // Filtros selecionados para a visão detalhada
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Ordenação da tabela
  const [sortField, setSortField] = useState<'tempo_etapa' | 'tempo_total' | 'nivel_alerta'>('tempo_etapa');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 1. ORIGEM DOS DADOS (Cards não cancelados ou excluídos)
  const activeProjects = useMemo(() => {
    return filterActiveProjects(projects);
  }, [projects]);

  // 2-6. MAPEAMENTO, REGRAS DE TEMPO, RESPONSABILIDADE, PROGRESSÃO E ALERTAS
  const computedData = useMemo<ComputedProjectItem[]>(() => {
    return computeProjectItems(projects, users);
  }, [projects, users]);

  // Lista única de responsáveis calculados para o filtro dropdown
  const uniqueResponsaveis = useMemo(() => {
    return Array.from(new Set(computedData.map(d => d.responsavel_atual).filter(Boolean))).map(name => ({ id: name, label: name }));
  }, [computedData]);

  // Lista única de setores para o filtro dropdown
  const uniqueSetores = useMemo(() => {
    return Array.from(new Set(computedData.map(d => d.setor_atual).filter(Boolean))).map(name => ({ id: name, label: name }));
  }, [computedData]);

  // Aplicar filtros e busca
  const filteredData = useMemo(() => {
    return filterComputedData(computedData, searchQuery, selectedStatuses, selectedResponsibles, selectedSectors);
  }, [computedData, searchQuery, selectedStatuses, selectedResponsibles, selectedSectors]);

  // Aplicar ordenação
  const sortedData = useMemo(() => {
    return sortComputedData(filteredData, sortField, sortDirection);
  }, [filteredData, sortField, sortDirection]);

  // 7.1 Indicadores detalhados do topo (Calculados sobre os dados gerais ativos)
  const stats = useMemo(() => {
    const total = computedData.length;
    const emAndamento = computedData.filter(d => d.status_visao_geral !== 'Concluído' && d.status_visao_geral !== 'Planejamento').length;
    const concluidos = computedData.filter(d => d.status_visao_geral === 'Concluído').length;
    const parados = computedData.filter(d => d.nivel_alerta === 'Parado').length;
    const criticos = computedData.filter(d => d.nivel_alerta === 'Crítico' || d.nivel_alerta === 'Muito crítico').length;

    return { total, emAndamento, concluidos, parados, criticos };
  }, [computedData]);

  // Dados para gráficos (Agregados da base filtrada para refletir dinamismo visual ao usar os filtros)
  const chartsData = useMemo(() => {
    // 1. Distribuição por status_visao_geral
    const statusesList = [
      'Backlog',
      'Planejamento', 
      'Em mapeamento', 
      'Análise do problema', 
      'Plano de ação', 
      'Período de teste', 
      'Em implantação', 
      'Concluído'
    ];
    const statusCounts = filteredData.reduce((acc, curr) => {
      acc[curr.status_visao_geral] = (acc[curr.status_visao_geral] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusColors: Record<string, string> = {
      'Backlog': '#94a3b8', // Slate Gray
      'Planejamento': '#eab308', // Gold
      'Em mapeamento': '#6366f1', // Indigo
      'Análise do problema': '#3b82f6', // Light Blue
      'Plano de ação': '#a855f7', // Purple
      'Período de teste': '#ec4899', // Pink
      'Em implantação': '#14b8a6', // Teal
      'Concluído': '#10b981' // Green
    };

    const statusChart = statusesList.map(st => ({
      name: st,
      value: statusCounts[st] || 0,
      color: statusColors[st] || '#94a3b8'
    })).filter(d => d.value > 0);

    // 2. Distribuição por responsável
    const respCounts = filteredData.reduce((acc, curr) => {
      if (curr.status_visao_geral === 'Backlog') return acc;
      acc[curr.responsavel_atual] = (acc[curr.responsavel_atual] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const respChart = Object.entries(respCounts)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 3. Distribuição por setor
    const sectorCounts = filteredData.reduce((acc, curr) => {
      acc[curr.setor_atual] = (acc[curr.setor_atual] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sectorChart = Object.entries(sectorCounts)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { statusChart, respChart, sectorChart };
  }, [filteredData]);

  const handleSort = (field: 'tempo_etapa' | 'tempo_total' | 'nivel_alerta') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getAlertBadgeStyles = (nivel: string) => {
    switch (nivel) {
      case 'Finalizado':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      case 'Muito crítico':
        return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      case 'Crítico':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'Parado':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      let logoBase64 = '';
      try {
        logoBase64 = await getBase64ImageFromUrl(SYSTEM_LOGO_PATH);
      } catch (err) {
        console.warn("Could not load logo base64", err);
      }

      // data as sorted & filtered
      const dataToExport = sortedData; 

      // metrics data
      const total = dataToExport.length;
      const emAndamento = dataToExport.filter(d => d.status_visao_geral !== 'Concluído' && d.status_visao_geral !== 'Planejamento').length;
      const concluidos = dataToExport.filter(d => d.status_visao_geral === 'Concluído').length;
      const parados = dataToExport.filter(d => d.nivel_alerta === 'Parado').length;
      const criticos = dataToExport.filter(d => d.nivel_alerta === 'Crítico' || d.nivel_alerta === 'Muito crítico').length;

      // charts data summary
      const sectorMap: Record<string, number> = {};
      const respMap: Record<string, number> = {};
      dataToExport.forEach(item => {
        if (item.setor_atual) {
          sectorMap[item.setor_atual] = (sectorMap[item.setor_atual] || 0) + 1;
        }
        if (item.responsavel_atual) {
          respMap[item.responsavel_atual] = (respMap[item.responsavel_atual] || 0) + 1;
        }
      });

      const sectorSummary = Object.entries(sectorMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const respSummary = Object.entries(respMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [30, 40, 30, 40],
        images: logoBase64 ? { logo: logoBase64 } : {},
        footer: (currentPage: number, pageCount: number) => ({
          margin: [30, 10, 30, 0],
          stack: [
            {
              canvas: [
                { type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }
              ]
            },
            {
              columns: [
                { text: 'GIP FLOW – Visão Geral Detalhada', style: 'footerText', fontSize: 8, color: '#64748b' },
                { text: `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, style: 'footerText', alignment: 'center', fontSize: 8, color: '#64748b' },
                { text: `Página ${currentPage} de ${pageCount}`, style: 'footerText', alignment: 'right', fontSize: 8, color: '#64748b' }
              ],
              margin: [0, 8, 0, 0]
            }
          ]
        }),
        content: [
          logoBase64 ? { image: 'logo', width: 140, alignment: 'left', margin: [0, 0, 0, 15] } : { text: 'GIP FLOW', fontSize: 16, bold: true, color: '#4f46e5', margin: [0, 0, 0, 15] },
          
          { text: 'VISÃO GERAL DETALHADA DA DIRETORIA', style: 'mainTitle', margin: [0, 0, 0, 4] },
          { text: 'Relatório Executivo consolidado de projetos, subtarefas e etapas operacionais.', style: 'subtitle', margin: [0, 0, 0, 15] },

          // Indicators Section
          {
            table: {
              widths: ['20%', '20%', '20%', '20%', '20%'],
              body: [
                [
                  { text: 'TOTAL PROJETOS', style: 'cardHeader', fillColor: '#4f46e5' },
                  { text: 'EM ANDAMENTO', style: 'cardHeader', fillColor: '#3b82f6' },
                  { text: 'CONCLUÍDOS', style: 'cardHeader', fillColor: '#10b981' },
                  { text: 'PARADOS', style: 'cardHeader', fillColor: '#f59e0b' },
                  { text: 'CRÍTICOS', style: 'cardHeader', fillColor: '#ef4444' }
                ],
                [
                  { text: total.toString(), style: 'cardVal' },
                  { text: emAndamento.toString(), style: 'cardVal' },
                  { text: concluidos.toString(), style: 'cardVal' },
                  { text: parados.toString(), style: 'cardVal' },
                  { text: criticos.toString(), style: 'cardVal' }
                ]
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 20]
          },

          // Side-by-side tables
          {
            columns: [
              {
                width: '48%',
                stack: [
                  { text: 'PROJETOS NO SETOR (TOP 5)', style: 'sectionTitle' },
                  {
                    table: {
                      widths: ['70%', '30%'],
                      body: [
                        [
                          { text: 'Setor', style: 'tableHeaderSmall' },
                          { text: 'Quantidade', style: 'tableHeaderSmall', alignment: 'center' }
                        ],
                        ...(sectorSummary.length > 0 
                          ? sectorSummary.map(item => [
                              { text: item.name, style: 'tableCellSmall' },
                              { text: item.count.toString(), style: 'tableCellSmall', alignment: 'center' }
                            ])
                          : [[{ text: 'Sem dados', style: 'tableCellSmall', italic: true }, { text: '0', style: 'tableCellSmall', alignment: 'center' }]])
                      ]
                    },
                    layout: 'lightHorizontalLines'
                  }
                ]
              },
              { width: '4%', text: '' },
              {
                width: '48%',
                stack: [
                  { text: 'PROJETOS COM O RESPONSÁVEL (TOP 5)', style: 'sectionTitle' },
                  {
                    table: {
                      widths: ['70%', '30%'],
                      body: [
                        [
                          { text: 'Responsável', style: 'tableHeaderSmall' },
                          { text: 'Quantidade', style: 'tableHeaderSmall', alignment: 'center' }
                        ],
                        ...(respSummary.length > 0 
                          ? respSummary.map(item => [
                              { text: item.name, style: 'tableCellSmall' },
                              { text: item.count.toString(), style: 'tableCellSmall', alignment: 'center' }
                            ])
                          : [[{ text: 'Sem dados', style: 'tableCellSmall', italic: true }, { text: '0', style: 'tableCellSmall', alignment: 'center' }]])
                      ]
                    },
                    layout: 'lightHorizontalLines'
                  }
                ]
              }
            ],
            margin: [0, 0, 0, 25]
          },

          // Primary Table: Lançamentos Gerais
          { text: 'LANÇAMENTOS GERAIS', style: 'sectionTitle' },
          {
            table: {
              headerRows: 1,
              dontBreakRows: true,
              widths: ['15%', '13%', '12%', '14%', '10%', '8%', '8%', '11%', '9%'],
              body: [
                [
                  { text: 'PROJETO', style: 'tableHeader' },
                  { text: 'SUBTAREFA', style: 'tableHeader' },
                  { text: 'STATUS GERAL', style: 'tableHeader' },
                  { text: 'RESPONSÁVEL', style: 'tableHeader' },
                  { text: 'SETOR', style: 'tableHeader' },
                  { text: 'T. ETAPA', style: 'tableHeader', alignment: 'center' },
                  { text: 'T. TOTAL', style: 'tableHeader', alignment: 'center' },
                  { text: 'PROGRESSO', style: 'tableHeader', alignment: 'center' },
                  { text: 'ALERTA', style: 'tableHeader', alignment: 'center' }
                ],
                ...dataToExport.map(row => {
                  let alertColor = '#10b981';
                  if (row.nivel_alerta === 'Muito crítico') alertColor = '#e11d48';
                  else if (row.nivel_alerta === 'Crítico') alertColor = '#f97316';
                  else if (row.nivel_alerta === 'Parado') alertColor = '#f59e0b';
                  else if (row.nivel_alerta === 'Finalizado') alertColor = '#64748b';

                  return [
                    { text: row.name, style: 'tableCell', bold: true },
                    { text: row.subtask_name, style: 'tableCell', italic: row.subtask_name === '-' },
                    { text: row.status_visao_geral, style: 'tableCell' },
                    { text: row.responsavel_atual, style: 'tableCell' },
                    { text: row.setor_atual, style: 'tableCell' },
                    { text: `${row.tempo_etapa} d`, style: 'tableCell', alignment: 'center' },
                    { text: `${row.tempo_total} d`, style: 'tableCell', alignment: 'center' },
                    { text: `${row.percentual_conclusao}%`, style: 'tableCell', alignment: 'center' },
                    { text: row.nivel_alerta, style: 'tableCell', alignment: 'center', bold: true, color: alertColor }
                  ];
                })
              ]
            },
            layout: {
              hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#e2e8f0',
              vLineColor: () => '#e2e8f0'
            }
          }
        ],
        styles: {
          mainTitle: { fontSize: 13, bold: true, color: '#1e1b4b', tracking: 1 },
          subtitle: { fontSize: 8, color: '#64748b' },
          sectionTitle: { fontSize: 9, bold: true, color: '#1e1b4b', margin: [0, 10, 0, 6], tracking: 0.5 },
          cardHeader: { fontSize: 7, bold: true, color: '#ffffff', alignment: 'center' },
          cardVal: { fontSize: 11, bold: true, alignment: 'center', margin: [0, 4, 0, 4], color: '#1e293b' },
          tableHeader: { fontSize: 7, bold: true, color: '#ffffff', fillColor: '#1e1b4b', alignment: 'left', margin: [2, 4, 2, 4] },
          tableHeaderSmall: { fontSize: 7, bold: true, color: '#475569', fillColor: '#f8fafc', margin: [2, 3, 2, 3] },
          tableCell: { fontSize: 6.5, color: '#334155', margin: [2, 3, 2, 3] },
          tableCellSmall: { fontSize: 7, color: '#334155', margin: [2, 3, 2, 3] },
          footerText: { fontSize: 7, italic: true }
        },
        defaultStyle: {
          font: 'Roboto'
        }
      };

      pdfMake.createPdf(docDefinition).download(`visao-geral-detalhada-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const toggleFilter = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 id-detailed-overview-tab">
      
      {/* 7.1 Indicadores no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
        <div className="bg-theme-card p-5 rounded-3xl border border-theme-border shadow-sm flex items-center justify-between gap-4 transition-all hover:y-[-3px] group">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md bg-indigo-600 shrink-0 group-hover:scale-110 transition-transform">
              <Briefcase size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Total Projetos</p>
              <h4 className="text-2xl font-black text-theme-foreground leading-none mt-1">{stats.total}</h4>
            </div>
          </div>
        </div>

        <div className="bg-theme-card p-5 rounded-3xl border border-theme-border shadow-sm flex items-center justify-between gap-4 transition-all hover:y-[-3px] group">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md bg-blue-500 shrink-0 group-hover:scale-110 transition-transform">
              <Clock size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Em Andamento</p>
              <h4 className="text-2xl font-black text-theme-foreground leading-none mt-1">{stats.emAndamento}</h4>
            </div>
          </div>
        </div>

        <div className="bg-theme-card p-5 rounded-3xl border border-theme-border shadow-sm flex items-center justify-between gap-4 transition-all hover:y-[-3px] group">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md bg-emerald-500 shrink-0 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Concluídos</p>
              <h4 className="text-2xl font-black text-theme-foreground leading-none mt-1">{stats.concluidos}</h4>
            </div>
          </div>
        </div>

        <div className="bg-theme-card p-5 rounded-3xl border border-theme-border shadow-sm flex items-center justify-between gap-4 transition-all hover:y-[-3px] group">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md bg-amber-500 shrink-0 group-hover:scale-110 transition-transform">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Projetos Parados</p>
              <h4 className="text-2xl font-black text-amber-500 leading-none mt-1">{stats.parados}</h4>
            </div>
          </div>
        </div>

        <div className="bg-theme-card p-5 rounded-3xl border border-theme-border shadow-sm flex items-center justify-between gap-4 transition-all hover:y-[-3px] group">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md bg-rose-600 shrink-0 group-hover:scale-110 transition-transform">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Projetos Críticos</p>
              <h4 className="text-2xl font-black text-rose-500 leading-none mt-1">{stats.criticos}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Filtros Avançados */}
      <div className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter size={16} />
            <span className="text-xs font-black uppercase tracking-widest">Painel de filtros</span>
          </div>
          <div className="flex items-center gap-3">
            {(selectedStatuses.length > 0 || selectedResponsibles.length > 0 || selectedSectors.length > 0 || searchQuery !== '') && (
              <button 
                onClick={() => {
                  setSelectedStatuses([]);
                  setSelectedResponsibles([]);
                  setSelectedSectors([]);
                  setSearchQuery('');
                }}
                className="text-xs text-rose-500 hover:text-rose-400 font-bold flex items-center gap-1 transition-colors self-start animate-in fade-in"
              >
                <X size={14} />
                Limpar Filtros ({selectedStatuses.length + selectedResponsibles.length + selectedSectors.length + (searchQuery ? 1 : 0)})
              </button>
            )}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-sm transition-all flex items-center gap-2 select-none cursor-pointer"
            >
              <FileDown size={14} />
              {isExportingPDF ? 'Exportando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Busca por texto */}
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pesquisar</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Buscar projeto, responsável..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Filtro Status */}
          <FilterDropdown
            label="Mapeamento Geral"
            placeholder="Escolher status"
            options={[
              { id: 'Planejamento', label: 'Planejamento' },
              { id: 'Em mapeamento', label: 'Em mapeamento' },
              { id: 'Análise do problema', label: 'Análise do problema' },
              { id: 'Plano de ação', label: 'Plano de ação' },
              { id: 'Período de teste', label: 'Período de teste' },
              { id: 'Em implantação', label: 'Em implantação' },
              { id: 'Concluído', label: 'Concluído' }
            ]}
            selected={selectedStatuses}
            onToggle={(id) => toggleFilter(selectedStatuses, id, setSelectedStatuses)}
            onClear={() => setSelectedStatuses([])}
            icon={<Target size={16} />}
          />

          {/* Filtro Responsável */}
          <FilterDropdown
            label="Responsável Atual"
            placeholder="Escolher responsável"
            options={uniqueResponsaveis}
            selected={selectedResponsibles}
            onToggle={(id) => toggleFilter(selectedResponsibles, id, setSelectedResponsibles)}
            onClear={() => setSelectedResponsibles([])}
            icon={<Users size={16} />}
            showSearch
          />

          {/* Filtro Setor */}
          <FilterDropdown
            label="Setor Atual"
            placeholder="Escolher setor"
            options={uniqueSetores}
            selected={selectedSectors}
            onToggle={(id) => toggleFilter(selectedSectors, id, setSelectedSectors)}
            onClear={() => setSelectedSectors([])}
            icon={<Building2 size={16} />}
            showSearch
          />
        </div>
      </div>

      {/* 7.2 Gráficos de Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 w-full">
        {/* Gráfico 1: Status Geral */}
        <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border border-theme-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-theme-foreground uppercase tracking-wider">Mapeamento Gerencial</h3>
            <Sparkles size={16} className="text-yellow-500" />
          </div>
          <div className="h-[250px] w-full mt-2">
            {chartsData.statusChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Nenhum dado com os filtros atuais.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.statusChart}
                    cx="50%"
                    cy="48%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ percent, cx, cy, midAngle, outerRadius }) => {
                      if (!percent || percent < 0.01) return null;
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 14;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="#94a3b8"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-[11px] font-bold fill-slate-500 dark:fill-slate-300"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                  >
                    {chartsData.statusChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <Label 
                      value={filteredData.length} 
                      position="center" 
                      style={{ fontSize: '18px', fontWeight: 900, fill: 'var(--foreground)' }} 
                    />
                  </Pie>
                  <Tooltip 
                     contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '12px', 
                      border: '1px solid #334155', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                      color: '#ffffff',
                      fontSize: '11px'
                    }}
                    itemStyle={{ color: '#ffffff' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                  />
                  <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Responsável */}
        <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border border-theme-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-theme-foreground uppercase tracking-wider font-semibold">Projetos com o Responsável</h3>
            <Users size={16} className="text-indigo-400" />
          </div>
          <div className="h-[250px] w-full mt-2">
            {chartsData.respChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Nenhum dado com os filtros atuais.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.respChart} layout="vertical" margin={{ left: -10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={90} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '12px', 
                      border: '1px solid #334155',
                      color: '#ffffff',
                      fontSize: '11px'
                    }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16}>
                    <LabelList 
                      dataKey="value" 
                      position="right" 
                      style={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                      offset={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 3: Setor */}
        <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border border-theme-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-theme-foreground uppercase tracking-wider font-semibold">Projetos no Setor</h3>
            <Building2 size={16} className="text-teal-400" />
          </div>
          <div className="h-[250px] w-full mt-2">
            {chartsData.sectorChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Nenhum setor encontrado com os filtros atuais.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.sectorChart} layout="vertical" margin={{ left: -10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={90} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '12px', 
                      border: '1px solid #334155',
                      color: '#ffffff',
                      fontSize: '11px'
                    }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                  <Bar dataKey="value" fill="#14b8a6" radius={[0, 6, 6, 0]} barSize={16}>
                    <LabelList 
                      dataKey="value" 
                      position="right" 
                      style={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                      offset={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 7.3 Tabela Principal de Visão Geral Detalhada */}
      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-theme-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-theme-foreground">Lançamentos gerais</h3>
            <p className="text-xs text-slate-400 font-medium">Lista de projetos consolidados com status operacional mapeado gerencialmente.</p>
          </div>
          <div className="text-xs text-slate-400 font-bold bg-theme-background px-4 py-2 rounded-xl border border-theme-border self-start">
            Exibindo <span className="text-indigo-400">{sortedData.length}</span> de <span className="text-slate-300">{computedData.length}</span> projetos
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-background border-b border-theme-border text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="py-4 px-6">Nome do Projeto</th>
                <th className="py-4 px-3 min-w-[130px]">Subtarefa</th>
                <th className="py-4 px-3 min-w-[150px]">Status Geral</th>
                <th className="py-4 px-3">Responsável Atual</th>
                <th className="py-4 px-3">Setor</th>
                <th 
                  className="py-4 px-3 cursor-pointer hover:bg-theme-card/50 transition-colors select-none"
                  onClick={() => handleSort('tempo_etapa')}
                >
                  <div className="flex items-center gap-1">
                    Tempo na Etapa
                    <ArrowUpDown size={12} className={cn("text-slate-500", sortField === 'tempo_etapa' && "text-indigo-400")} />
                  </div>
                </th>
                <th 
                  className="py-4 px-3 cursor-pointer hover:bg-theme-card/50 transition-colors select-none"
                  onClick={() => handleSort('tempo_total')}
                >
                  <div className="flex items-center gap-1">
                    Tempo Total
                    <ArrowUpDown size={12} className={cn("text-slate-500", sortField === 'tempo_total' && "text-indigo-400")} />
                  </div>
                </th>
                <th className="py-4 px-3">Progresso / Conclusão</th>
                <th 
                  className="py-4 px-6 text-right cursor-pointer hover:bg-theme-card/50 transition-colors select-none"
                  onClick={() => handleSort('nivel_alerta')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Alerta
                    <ArrowUpDown size={12} className={cn("text-slate-500", sortField === 'nivel_alerta' && "text-indigo-400")} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border text-sm text-theme-foreground">
              {sortedData.map((project, idx) => (
                <tr 
                  key={project.id} 
                  className="hover:bg-theme-background/50 transition-colors group"
                >
                  <td className="py-4 px-6 font-bold">
                    <button 
                      onClick={() => onProjectClick(project.projectId)}
                      className="text-left hover:text-indigo-400 transition-colors focus:outline-none focus:underline"
                    >
                      {project.name}
                    </button>
                  </td>

                  <td className="py-4 px-3 text-slate-300 font-medium italic">
                    {project.subtask_name}
                  </td>
                  
                  <td className="py-4 px-3">
                    <span className={cn(
                      "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border",
                      project.status_visao_geral === 'Planejamento' && 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                      project.status_visao_geral === 'Em mapeamento' && 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                      project.status_visao_geral === 'Análise do problema' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                      project.status_visao_geral === 'Plano de ação' && 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                      project.status_visao_geral === 'Período de teste' && 'bg-pink-500/10 text-pink-400 border-pink-500/20',
                      project.status_visao_geral === 'Em implantação' && 'bg-teal-500/10 text-teal-400 border-teal-500/20',
                      project.status_visao_geral === 'Concluído' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    )}>
                      {project.status_visao_geral}
                    </span>
                  </td>

                  <td className="py-4 px-3 text-slate-300 font-medium">
                    {project.responsavel_atual}
                  </td>

                  <td className="py-4 px-3 text-slate-400 font-bold text-xs uppercase tracking-wider">
                    {project.setor_atual}
                  </td>

                  <td className="py-4 px-3 font-semibold text-xs">
                    {project.tempo_etapa === 0 ? 'Atualizado hoje' : `${project.tempo_etapa} ${project.tempo_etapa === 1 ? 'dia' : 'dias'}`}
                  </td>

                  <td className="py-4 px-3 text-slate-400 text-xs">
                    {project.tempo_total === 0 ? 'Criado hoje' : `${project.tempo_total} ${project.tempo_total === 1 ? 'dia' : 'dias'}`}
                  </td>

                  <td className="py-4 px-3 w-[150px]">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400">{project.percentual_conclusao}%</span>
                      <div className="w-full h-1.5 bg-theme-background border border-theme-border rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            project.percentual_conclusao === 100 ? "bg-emerald-500" : "bg-indigo-500"
                          )}
                          style={{ width: `${project.percentual_conclusao}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6 text-right">
                    <span className={cn(
                      "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md",
                      getAlertBadgeStyles(project.nivel_alerta)
                    )}>
                      {project.nivel_alerta}
                    </span>
                  </td>
                </tr>
              ))}

              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm font-medium italic">
                    Nenhum projeto encontrado correspondente a esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
