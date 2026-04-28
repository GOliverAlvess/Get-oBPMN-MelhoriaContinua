import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  Users, 
  Briefcase, 
  Target,
  History,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import html2pdf from 'html2pdf.js';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { 
  db, 
  auth, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  doc, 
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { Project, User, OperationalAction, ReportLog } from '../types';
import { cn, exportarCSVPadrao } from '../lib/utils';
import FilterDropdown from './FilterDropdown';

const STATUS_MAP: Record<string, string> = {
  'pending': 'Pendente',
  'in_progress': 'Em andamento',
  'done': 'Concluído'
};

const translateStatus = (status: string) => STATUS_MAP[status] || status;

// Set up pdfMake fonts
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if ((pdfFonts as any).vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).vfs;
}

const HEADERS_PDCA = [
  "ID do Processo",
  "Nome do Problema",
  "Descrição do Problema",
  "PLAN - Causa Raiz",
  "PLAN - Impacto Descrição",
  "PLAN - Impacto Valor Atual",
  "PLAN - Meta (%)",
  "DO - Ação (What)",
  "DO - Responsável",
  "DO - Setor",
  "DO - Status",
  "DO - Data Início",
  "DO - Data Conclusão",
  "CHECK - Modo Acompanhamento",
  "CHECK - Período",
  "CHECK - Como Acompanha",
  "CHECK - Funcionou",
  "CHECK - Link evidência do acompanhamento",
  "CHECK - Impacto de ganho",
  "ACT - Status Final",
  "ACT - Ação Final",
  "ACT - Padronização"
];

const HEADERS_ACTIONS = [
  "Projeto",
  "Subtarefa",
  "Responsável",
  "Ação",
  "Prioridade",
  "Status",
  "Previsão",
  "Retorno da tratativa",
  "Data de conclusão"
];

const SYSTEM_LOGO_SVG = `<svg width="500" height="500" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="500" rx="125" fill="#003489"/>
<path d="M350 150H250V200H300C295 230 280 250 250 250C216.863 250 190 223.137 190 190C190 156.863 216.863 130 250 130C270 130 290 140 300 155L340 115C315 90 285 75 250 75C186.487 75 135 126.487 135 190C135 253.513 186.487 305 250 305C313.513 305 365 253.513 365 190C365 176.487 359.513 163.513 350 150Z" fill="white"/>
</svg>`;

const SYSTEM_LOGO = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDUwMCA1MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIiByeD0iMTI1IiBmaWxsPSIjMDAzNDg5Ii8+CjxwYXRoIGQ9Ik0zNTAgMTUwSDI1MFYyMDBIMzAwQzI5NSAyMzAgMjgwIDI1MCAyNTAgMjUwQzIxNi44NjMgMjUwIDE5MCAyMjMuMTM3IDE5MCAxOTBDMTkwIDE1Ni44NjMgMjE2Ljg2MyAxMzAgMjUwIDEzMEMyNzAgMTMwIDI5MCAxNDAgMzAwIDE1NUwzNDAgMTE1QzMxNSA5MCAyODUgNzUgMjUwIDc1QzE4Ni40ODcgNzUgMTM1IDEyNi40ODcgMTM1IDE5MEMxMzUgMjUzLjUxMyAxODYuNDg3IDMwNSAyNTAgMzA1QzMxMy41MTMgMzA1IDM2NSAyNTMuNTEzIDM2NSAxOTBDMzY1IDE3Ni40ODcgMzU5LjUxMyAxNjMuNTEzIDM1MCAxNTBaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K";

interface ReportsTabProps {
  projects: Project[];
  users: User[];
  actions: OperationalAction[];
}

export default function ReportsTab({ projects, users, actions }: ReportsTabProps) {
  const [reportType, setReportType] = useState<'PDCA' | 'Histórico de Ações' | 'Relatório Completo'>('PDCA');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(''); // For complete report
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Hidden ref for report generation
  const printRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'reportLogs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReportLog));
      setReportLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reportLogs');
    });
    return () => unsubscribe();
  }, []);

  const toggleFilter = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const normalizeColors = (element: HTMLElement) => {
    element.classList.add('pdf-mode');
    const all = element.querySelectorAll("*");
    all.forEach(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'].forEach(prop => {
        const val = (style as any)[prop];
        if (val && (val.includes("oklab") || val.includes("oklch"))) {
          if (prop === 'backgroundColor') htmlEl.style.backgroundColor = "rgb(255, 255, 255)";
          else if (prop === 'borderColor') htmlEl.style.borderColor = "rgb(226, 232, 240)";
          else htmlEl.style.setProperty(prop, "rgb(30, 41, 59)", "important");
        }
      });
      // Force simple colors for specific classes
      if (htmlEl.classList.contains('bg-indigo-600')) htmlEl.style.backgroundColor = "rgb(79, 70, 229)";
      if (htmlEl.classList.contains('text-indigo-600')) htmlEl.style.color = "rgb(79, 70, 229)";
      
      const shadow = style.boxShadow;
      if (shadow && (shadow.includes("oklab") || shadow.includes("oklch"))) {
        htmlEl.style.boxShadow = "none";
      }
    });
  };

  const PDFHeader = ({ projectName }: { projectName: string }) => (
    <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-8">
      <div className="flex items-center gap-3">
        <img src={SYSTEM_LOGO} alt="Logo" className="w-8 h-8 rounded-lg" referrerPolicy="no-referrer" />
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-indigo-600 tracking-wider">GESTÃO PRO</span>
          <span className="text-[8px] text-slate-400 font-bold uppercase">Sistema de Melhoria Contínua</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[300px]">{projectName}</p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>
    </div>
  );

  const generateReport = async () => {
    if (reportType === 'Relatório Completo' && !selectedProjectId) {
      alert('Por favor, selecione um projeto para gerar o relatório completo.');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    
    try {
      if (reportType === 'Relatório Completo') {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) throw new Error('Projeto não encontrado');

        setProgress(30);

        const docDefinition: any = {
          pageSize: 'A4',
          pageMargins: [40, 60, 40, 60],
          header: (currentPage: number, pageCount: number) => {
            if (currentPage === 1) return null;
            return {
              columns: [
                {
                  svg: SYSTEM_LOGO_SVG,
                  width: 20,
                  margin: [40, 20, 0, 0]
                },
                {
                  text: 'GESTÃO PRO - Sistema de Melhoria Contínua',
                  style: 'headerSmall',
                  margin: [10, 25, 0, 0]
                },
                {
                  text: project.name,
                  alignment: 'right',
                  style: 'headerSmall',
                  margin: [0, 25, 40, 0]
                }
              ]
            };
          },
          footer: (currentPage: number, pageCount: number) => {
            return {
              columns: [
                {
                  text: `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
                  style: 'footerText',
                  margin: [40, 10, 0, 0]
                },
                {
                  text: `Página ${currentPage} de ${pageCount}`,
                  alignment: 'right',
                  style: 'footerText',
                  margin: [0, 10, 40, 0]
                }
              ],
              canvas: [
                {
                  type: 'line',
                  x1: 40, y1: 5, x2: 555, y2: 5,
                  lineWidth: 0.5,
                  lineColor: '#f1f5f9'
                }
              ]
            };
          },
          content: [
            // CAPA
            {
              stack: [
                {
                  svg: SYSTEM_LOGO_SVG,
                  width: 80,
                  alignment: 'center',
                  margin: [0, 100, 0, 20]
                },
                {
                  text: 'RELATÓRIO EXECUTIVO',
                  style: 'subtitle',
                  color: '#4f46e9',
                  alignment: 'center'
                },
                {
                  text: project.name.toUpperCase(),
                  style: 'mainTitle',
                  margin: [0, 10, 0, 40],
                  alignment: 'center'
                },
                {
                  canvas: [
                    {
                      type: 'line',
                      x1: 100, y1: 0, x2: 400, y2: 0,
                      lineWidth: 2,
                      lineColor: '#4f46e9'
                    }
                  ],
                  margin: [0, 0, 0, 40]
                },
                {
                  columns: [
                    {
                      stack: [
                        { text: 'RESPONSÁVEL', style: 'label' },
                        { text: users.find(u => u.id === project.assignedTo)?.name || 'Não atribuído', style: 'value' }
                      ]
                    },
                    {
                      stack: [
                        { text: 'STATUS DO PROJETO', style: 'label' },
                        { text: project.status.toUpperCase(), style: 'value', color: project.status === 'Concluído' ? '#059669' : '#d97706' }
                      ]
                    }
                  ],
                  margin: [0, 0, 0, 30]
                },
                {
                  columns: [
                    {
                      stack: [
                        { text: 'DATA DE INÍCIO', style: 'label' },
                        { text: project.scope?.startDate ? format(parseISO(project.scope.startDate), 'dd/MM/yyyy') : 'N/A', style: 'value' }
                      ]
                    },
                    {
                      stack: [
                        { text: 'DATA DE GERAÇÃO', style: 'label' },
                        { text: format(new Date(), "dd/MM/yyyy"), style: 'value' }
                      ]
                    }
                  ]
                }
              ],
              pageBreak: 'after'
            },
            // ESCOPO
            {
              text: '01. ESCOPO DO PROJETO',
              style: 'sectionHeading',
              margin: [0, 0, 0, 20]
            },
            {
              stack: [
                { text: 'DESCRIÇÃO COMPLETA', style: 'label' },
                {
                  text: project.description || project.scope?.problemDescription || 'Nenhuma descrição fornecida.',
                  style: 'bodyText',
                  margin: [0, 5, 0, 20]
                }
              ]
            },
            {
              columns: [
                {
                  stack: [
                    { text: 'OBJETIVO MENSURÁVEL', style: 'label' },
                    { text: project.scope?.measurableObjective || 'Não definido', style: 'bodyText' }
                  ]
                },
                {
                  stack: [
                    { text: 'SETORES ENVOLVIDOS', style: 'label' },
                    { text: project.scope?.involvedSectors?.map(s => s.name).join(', ') || 'Nenhum', style: 'bodyText' }
                  ]
                }
              ],
              margin: [0, 0, 0, 30]
            },
            // MAPEAMENTO
            {
              text: '02. MAPEAMENTO DE ETAPAS',
              style: 'sectionHeading',
              margin: [0, 20, 0, 20]
            },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  [
                    { text: 'TÍTULO DA ETAPA', style: 'tableHeader' },
                    { text: 'RESPONSÁVEL', style: 'tableHeader' },
                    { text: 'PERÍODO', style: 'tableHeader' },
                    { text: 'STATUS', style: 'tableHeader' }
                  ],
                  ...(project.subtasks || []).map(sub => [
                    { text: sub.title, style: 'tableCell' },
                    { text: users.find(u => u.id === sub.responsibleId)?.name || 'N/A', style: 'tableCell' },
                    { text: `${sub.startDate ? format(parseISO(sub.startDate), 'dd/MM/yyyy') : '?'} - ${sub.endDate ? format(parseISO(sub.endDate), 'dd/MM/yyyy') : '?'}`, style: 'tableCell' },
                    { text: sub.status, style: 'tableCell', color: sub.status === 'Concluído' ? '#059669' : '#d97706' }
                  ])
                ]
              },
              layout: 'lightHorizontalLines'
            },
            // PDCA
            {
              text: '03. CICLOS PDCA',
              style: 'sectionHeading',
              margin: [0, 40, 0, 20],
              pageBreak: 'before'
            },
            ...(project.subtasks?.flatMap(s => s.pdcaCycles) || []).map((cycle, idx) => ({
              stack: [
                {
                  text: `CICLO ${idx + 1}: ${cycle.title.toUpperCase()}`,
                  style: 'subSectionHeading',
                  margin: [0, 10, 0, 10]
                },
                {
                  columns: [
                    {
                      stack: [
                        { text: 'PLAN (Planejamento)', style: 'stepHeading', color: '#4f46e9' },
                        { text: cycle.plan.problemDescription, style: 'bodyTextSmall' },
                        { text: 'CAUSA RAIZ', style: 'labelSmall', margin: [0, 5, 0, 2] },
                        { text: cycle.plan.rootCauseAnalysis.identifiedRootCause || 'Não definida', style: 'bodyTextSmall' }
                      ]
                    },
                    {
                      stack: [
                        { text: 'DO (Execução)', style: 'stepHeading', color: '#d97706' },
                        ...(cycle.plan.actionPlan || []).map(action => ({
                          text: `• ${action.what} (${translateStatus(action.status)})`,
                          style: 'bodyTextSmall'
                        }))
                      ]
                    }
                  ],
                  margin: [0, 0, 0, 20]
                }
              ],
              unbreakable: true
            })),
            // HISTORICO
            {
              text: '04. HISTÓRICO DE AÇÕES OPERACIONAIS',
              style: 'sectionHeading',
              margin: [0, 40, 0, 20],
              pageBreak: 'before'
            },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto'],
                body: [
                  [
                    { text: 'RESPONSÁVEL', style: 'tableHeader' },
                    { text: 'AÇÃO', style: 'tableHeader' },
                    { text: 'STATUS', style: 'tableHeader' },
                    { text: 'CONCLUSÃO', style: 'tableHeader' }
                  ],
                  ...actions.filter(a => a.projectId === selectedProjectId).map(a => [
                    { text: a.responsibleName, style: 'tableCell' },
                    { text: a.action, style: 'tableCell' },
                    { text: translateStatus(a.status), style: 'tableCell' },
                    { text: a.completionDate || '---', style: 'tableCell' }
                  ])
                ]
              },
              layout: 'lightHorizontalLines'
            }
          ],
          styles: {
            mainTitle: { fontSize: 32, bold: true, color: '#0f172a' },
            subtitle: { fontSize: 10, bold: true, letterSpacing: 2 },
            sectionHeading: { fontSize: 18, bold: true, color: '#0f172a' },
            subSectionHeading: { fontSize: 14, bold: true, color: '#334155' },
            stepHeading: { fontSize: 10, bold: true, margin: [0, 10, 0, 5] },
            label: { fontSize: 8, bold: true, color: '#94a3b8', margin: [0, 0, 0, 2] },
            labelSmall: { fontSize: 7, bold: true, color: '#94a3b8' },
            value: { fontSize: 12, bold: true, color: '#1e293b' },
            bodyText: { fontSize: 10, color: '#475569', lineHeight: 1.4 },
            bodyTextSmall: { fontSize: 8, color: '#475569', lineHeight: 1.2 },
            tableHeader: { fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
            tableCell: { fontSize: 8, color: '#475569' },
            headerSmall: { fontSize: 8, bold: true, color: '#94a3b8' },
            footerText: { fontSize: 8, color: '#94a3b8' }
          }
        };

        setProgress(70);
        pdfMake.createPdf(docDefinition).download(`Relatorio_Completo_${project.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        
        setProgress(100);

        // Log the generation
        const user = auth.currentUser;
        if (user) {
          const logId = uuidv4();
          await setDoc(doc(db, 'reportLogs', logId), {
            id: logId,
            userId: user.uid,
            userName: user.displayName || user.email || 'Usuário',
            timestamp: new Date().toISOString(),
            reportType: 'Relatório Completo'
          });
        }
        
        setTimeout(() => setIsGenerating(false), 1000);
        return;
      }

      const timestamp = new Date().toISOString();
      const user = auth.currentUser;
      
      if (!user) throw new Error('Usuário não autenticado');

      let data: any[] = [];
      let fileName = '';

      const filterByCommon = (itemDate: string, projectId: string, responsibleId: string, status: string) => {
        const dateMatch = (!startDate || !endDate) || isWithinInterval(parseISO(itemDate), {
          start: startOfDay(parseISO(startDate)),
          end: endOfDay(parseISO(endDate))
        });
        const projectMatch = selectedProjectIds.length === 0 || selectedProjectIds.includes(projectId);
        const collabMatch = selectedCollaborators.length === 0 || selectedCollaborators.includes(responsibleId);
        const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(status);
        
        return dateMatch && projectMatch && collabMatch && statusMatch;
      };

      if (reportType === 'PDCA') {
        fileName = `Relatorio_PDCA_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        
        projects.forEach(project => {
          project.subtasks.forEach(subtask => {
            subtask.pdcaCycles.forEach(cycle => {
              const dateMatch = (!startDate || !endDate) || isWithinInterval(parseISO(cycle.createdAt), {
                start: startOfDay(parseISO(startDate)),
                end: endOfDay(parseISO(endDate))
              });
              const projectMatch = selectedProjectIds.length === 0 || selectedProjectIds.includes(project.id);
              
              if (dateMatch && projectMatch) {
                cycle.plan.actionPlan.forEach(action => {
                  const collabMatch = selectedCollaborators.length === 0 || selectedCollaborators.includes(action.who);
                  const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(translateStatus(action.status));

                  if (collabMatch && statusMatch) {
                    data.push({
                      "ID do Processo": subtask.id,
                      "Nome do Problema": cycle.title,
                      "Descrição do Problema": cycle.plan.problemDescription,
                      "PLAN - Causa Raiz": cycle.plan.rootCauseAnalysis.identifiedRootCause || 'N/A',
                      "PLAN - Impacto Descrição": cycle.plan.impact.description,
                      "PLAN - Impacto Valor Atual": cycle.plan.impact.value,
                      "PLAN - Meta (%)": cycle.plan.impact.goal,
                      "DO - Ação (What)": action.what,
                      "DO - Responsável": users.find(u => u.id === action.who)?.name || action.who,
                      "DO - Setor": action.sector || 'N/A',
                      "DO - Status": translateStatus(action.status),
                      "DO - Data Início": action.startDate || 'N/A',
                      "DO - Data Conclusão": action.endDate || 'N/A',
                      "CHECK - Modo Acompanhamento": action.monitoringMode || 'N/A',
                      "CHECK - Período": action.monitoringPeriod || 'N/A',
                      "CHECK - Como Acompanha": action.monitoringTool || 'N/A',
                      "CHECK - Funcionou": action.worked || 'N/A',
                      "CHECK - Link evidência do acompanhamento": action.evidence || 'N/A',
                      "CHECK - Impacto de ganho": action.gainImpact || 'N/A',
                      "ACT - Status Final": action.finalProblemStatus || 'N/A',
                      "ACT - Ação Final": action.finalAction || 'N/A',
                      "ACT - Padronização": action.standardizationModels?.join(', ') || 'N/A'
                    });
                  }
                });
              }
            });
          });
        });
      } else {
        fileName = `Historico_Acoes_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        
        actions.forEach(action => {
          if (filterByCommon(action.createdAt, action.projectId, action.responsibleId, translateStatus(action.status))) {
            data.push({
              "Projeto": action.projectName,
              "Subtarefa": action.subtaskTitle,
              "Responsável": action.responsibleName,
              "Ação": action.action,
              "Prioridade": action.priority,
              "Status": translateStatus(action.status),
              "Previsão": action.forecastDate,
              "Retorno da tratativa": action.feedback || 'N/A',
              "Data de conclusão": action.completionDate || 'N/A'
            });
          }
        });
      }

      if (data.length === 0) {
        alert('Nenhum dado encontrado para os filtros selecionados.');
        return;
      }

      const headers = reportType === 'PDCA' ? HEADERS_PDCA : HEADERS_ACTIONS;
      const csvRows = data.map(item => headers.map(header => item[header] || ''));

      exportarCSVPadrao(headers, csvRows, fileName);

      // Log the generation
      const logId = uuidv4();
      const log: ReportLog = {
        id: logId,
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuário',
        timestamp,
        reportType
      };

      await setDoc(doc(db, 'reportLogs', logId), log);

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Verifique os logs do console.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-12 w-full">
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Gerador de Relatórios</h3>
          <p className="text-slate-500 text-sm mt-1">Selecione os filtros e gere relatórios em formato Excel.</p>
        </div>

        <div className="bg-slate-50/50 p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tipo de Relatório */}
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Tipo de Relatório</label>
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm h-[52px]">
                <button 
                  onClick={() => setReportType('PDCA')}
                  className={cn(
                    "flex-1 rounded-xl text-xs font-bold transition-all",
                    reportType === 'PDCA' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  PDCA (Excel)
                </button>
                <button 
                  onClick={() => setReportType('Histórico de Ações')}
                  className={cn(
                    "flex-1 rounded-xl text-xs font-bold transition-all",
                    reportType === 'Histórico de Ações' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  Histórico de Ações (Excel)
                </button>
                <button 
                  onClick={() => setReportType('Relatório Completo')}
                  className={cn(
                    "flex-1 rounded-xl text-xs font-bold transition-all",
                    reportType === 'Relatório Completo' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  Relatório Completo (PDF)
                </button>
              </div>
            </div>

            {reportType === 'Relatório Completo' ? (
              <div className="space-y-3 md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Selecione o Projeto</label>
                <div className="relative">
                  <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm appearance-none"
                  >
                    <option value="">Selecione um projeto...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 italic ml-1">Este relatório consolida todas as informações do projeto em um arquivo PDF profissional.</p>
              </div>
            ) : (
              <>
                {/* Período */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Período de Análise</label>
              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
                <div className="relative">
                  <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
                <span className="text-slate-300 font-bold text-[10px] uppercase">até</span>
                <div className="relative">
                  <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Projetos */}
            <div className="space-y-3">
              <FilterDropdown
                label="3. Projetos"
                placeholder="Todos os projetos"
                options={projects.map(p => ({ id: p.id, label: p.name }))}
                selected={selectedProjectIds}
                onToggle={(id) => toggleFilter(selectedProjectIds, id, setSelectedProjectIds)}
                onClear={() => setSelectedProjectIds([])}
                icon={<Briefcase size={16} />}
                showSearch
              />
            </div>

            {/* Colaboradores */}
            <div className="space-y-3">
              <FilterDropdown
                label="4. Colaboradores"
                placeholder="Todos os colaboradores"
                options={users.map(u => ({ id: u.id, label: u.name }))}
                selected={selectedCollaborators}
                onToggle={(id) => toggleFilter(selectedCollaborators, id, setSelectedCollaborators)}
                onClear={() => setSelectedCollaborators([])}
                icon={<Users size={16} />}
                showSearch
              />
            </div>

            {/* Status */}
            <div className="space-y-3 md:col-span-2">
              <FilterDropdown
                label="5. Status das Ações"
                placeholder="Todos os status"
                options={['Pendente', 'Em andamento', 'Concluído'].map(s => ({ id: s, label: s }))}
                selected={selectedStatuses}
                onToggle={(id) => toggleFilter(selectedStatuses, id, setSelectedStatuses)}
                onClear={() => setSelectedStatuses([])}
                icon={<Target size={16} />}
              />
            </div>
          </>
        )}
      </div>

      <div className="pt-8 flex justify-end border-t border-slate-100">
            <button 
              onClick={generateReport}
              disabled={isGenerating}
              className={cn(
                "group relative bg-indigo-600 text-white min-w-[200px] h-[58px] rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                isGenerating && "animate-pulse"
              )}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Gerando... {progress}%</span>
                </>
              ) : (
                <>
                  <Download size={20} className="group-hover:-translate-y-0.5 transition-transform" />
                  <span>Gerar Relatório</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hidden Report Container for PDF Generation */}
        <div className="hidden">
          {reportType === 'Relatório Completo' && selectedProjectId && (
            <div id="full-project-report" className="bg-white p-12 text-slate-800 font-sans max-w-[210mm]">
              {(() => {
                const project = projects.find(p => p.id === selectedProjectId);
                if (!project) return null;
                
                return (
                  <div className="space-y-12">
                    {/* CAPA */}
                    <div className="h-[270mm] flex flex-col justify-between items-center text-center py-20 border-[20px] border-indigo-50 rounded-3xl">
                      <div className="space-y-4">
                        <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-200">
                          <FileText size={48} className="text-white" />
                        </div>
                        <h4 className="text-[12px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-2">Relatório Executivo</h4>
                        <h1 className="text-5xl font-black text-slate-900 leading-tight">{project.name}</h1>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-slate-400 text-sm font-medium">Status do Projeto</p>
                        <div className={cn(
                          "inline-block px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest",
                          project.status === 'Concluído' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                        )}>
                          {project.status}
                        </div>
                      </div>

                      <div className="w-full max-w-md space-y-6">
                        <div className="h-px bg-slate-100" />
                        <div className="grid grid-cols-2 gap-8 text-left">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável</p>
                            <p className="text-sm font-bold text-slate-700">{users.find(u => u.id === project.assignedTo)?.name || 'Não atribuído'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data de Geração</p>
                            <p className="text-sm font-bold text-slate-700">{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="html2pdf__page-break" />

                    {/* ESCOPO */}
                    <div className="space-y-8 min-h-[250mm]">
                      <PDFHeader projectName={project.name} />
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <Target size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-500 pb-1">01. Escopo do Projeto</h2>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-8">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição Completa</p>
                          <div className="p-6 bg-slate-50 rounded-3xl text-sm leading-relaxed text-slate-700">
                            {project.description || "Nenhuma descrição fornecida."}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Início</p>
                            <p className="text-sm font-bold text-slate-800">{project.scope?.startDate ? format(parseISO(project.scope.startDate), "dd/MM/yyyy") : "N/A"}</p>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previsão de Término</p>
                            <p className="text-sm font-bold text-slate-800">{project.scope?.forecastCompletion ? format(parseISO(project.scope.forecastCompletion), "dd/MM/yyyy") : "N/A"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="html2pdf__page-break" />

                    {/* MAPEAMENTO / FLUXOGRAMA */}
                    <div className="space-y-8 min-h-[250mm]">
                      <PDFHeader projectName={project.name} />
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <Clock size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-500 pb-1">02. Mapeamento de Etapas</h2>
                      </div>

                      <div className="space-y-4">
                        {project.subtasks && project.subtasks.length > 0 ? (
                          <div className="space-y-4">
                            {project.subtasks.map((sub, idx) => (
                              <div key={sub.id} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center text-[10px] font-black">{idx + 1}</div>
                                    <h3 className="font-bold text-slate-800">{sub.title}</h3>
                                  </div>
                                  <span className={cn(
                                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                    sub.status === 'Concluído' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                  )}>
                                    {sub.status}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-[10px]">
                                  <div className="space-y-1">
                                    <p className="font-black text-slate-400 uppercase">Período</p>
                                    <p className="font-bold text-slate-700">{sub.startDate ? format(parseISO(sub.startDate), "dd/MM/yyyy") : "?"} - {sub.endDate ? format(parseISO(sub.endDate), "dd/MM/yyyy") : "?"}</p>
                                  </div>
                                  <div className="space-y-1 text-right">
                                    <p className="font-black text-slate-400 uppercase">Responsável</p>
                                    <p className="font-bold text-slate-700">{users.find(u => u.id === sub.responsibleId)?.name || 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Nenhuma etapa ou sub-tarefa mapeada neste projeto.</p>
                        )}
                      </div>
                    </div>

                    <div className="html2pdf__page-break" />

                    {/* PDCA COMPLETO */}
                    <div className="space-y-8 min-h-[250mm]">
                      <PDFHeader projectName={project.name} />
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <CheckCircle2 size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-500 pb-1">03. Ciclos PDCA</h2>
                      </div>

                      <div className="space-y-12">
                        {project.subtasks && project.subtasks.flatMap(s => s.pdcaCycles).length > 0 ? (
                          project.subtasks.flatMap(s => s.pdcaCycles).map((cycle, cIdx) => (
                            <div key={cycle.id} className="space-y-8 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                              <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-slate-900">CICLO {cIdx + 1}: {cycle.title}</h3>
                                <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{cycle.status}</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 space-y-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PLAN (Planejamento)</p>
                                  </div>
                                  <div className="space-y-4 text-xs">
                                    <p><span className="font-black text-slate-400 mr-2 uppercase">Problema:</span> <span className="text-slate-700 font-bold">{cycle.plan.problemDescription}</span></p>
                                    <p><span className="font-black text-slate-400 mr-2 uppercase">Causa Raiz:</span> <span className="text-slate-700 font-bold">{cycle.plan.rootCauseAnalysis.identifiedRootCause || 'N/A'}</span></p>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                      <div className="p-3 bg-slate-50 rounded-xl">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Impacto Atual</p>
                                        <p className="font-black text-slate-900">R$ {cycle.plan.impact.value}</p>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-xl">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Meta Definitiva</p>
                                        <p className="font-black text-emerald-600">{cycle.plan.impact.goal}% de redução</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 space-y-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DO (Execução)</p>
                                  </div>
                                  <div className="space-y-2">
                                    {cycle.plan.actionPlan.map((action, aIdx) => (
                                      <div key={action.id} className="text-[10px] p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                                        <span className="font-bold text-slate-700">{aIdx + 1}. {action.what}</span>
                                        <span className="px-2 py-0.5 bg-white rounded-md text-slate-400 font-black">{translateStatus(action.status)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 space-y-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CHECK (Verificação)</p>
                                  </div>
                                  <div className="space-y-3">
                                    {cycle.plan.actionPlan.map((action) => (
                                      <div key={action.id} className="text-[9px] p-3 bg-slate-50 rounded-xl space-y-1">
                                        <p className="font-black text-slate-400 uppercase">{action.what}</p>
                                        <p className="font-bold text-slate-700 italic">" {action.gainImpact || 'Sem registro de acompanhamento' } "</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 space-y-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-rose-500 rounded-full" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ACT (Agir)</p>
                                  </div>
                                  <div className="space-y-3">
                                    {cycle.plan.actionPlan.map((action) => (
                                      <div key={action.id} className="text-[9px] p-3 bg-slate-50 rounded-xl space-y-1">
                                        <p className="font-black text-slate-400 uppercase">{action.what}</p>
                                        <p className="font-bold text-slate-700 italic">" {action.finalAction || 'Em análise final' } "</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">Nenhum ciclo PDCA registrado para este projeto.</p>
                        )}
                      </div>
                    </div>

                    <div className="html2pdf__page-break" />

                    {/* HISTÓRICO DE AÇÕES */}
                    <div className="space-y-8 min-h-[250mm]">
                      <PDFHeader projectName={project.name} />
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <History size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-500 pb-1">04. Histórico de Ações</h2>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Conclusão</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[10px]">
                            {actions.filter(a => a.projectId === selectedProjectId).map((a) => (
                              <tr key={a.id}>
                                <td className="px-6 py-4 font-bold text-slate-700">{a.responsibleName}</td>
                                <td className="px-6 py-4 font-medium text-slate-600">{a.action}</td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md font-black uppercase text-[8px]",
                                    a.status === 'Concluído' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                  )}>
                                    {translateStatus(a.status)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{a.completionDate || '---'}</td>
                              </tr>
                            ))}
                            {actions.filter(a => a.projectId === selectedProjectId).length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhum histórico de ações operacionais encontrado.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="html2pdf__page-break" />

                    {/* STATUS FINAL / CONCLUSÃO */}
                    <div className="h-[270mm] flex flex-col justify-center items-center text-center space-y-12">
                      <div className="w-32 h-32 bg-indigo-50 text-indigo-600 rounded-[3rem] flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={64} />
                      </div>
                      <div className="space-y-4">
                        <h2 className="text-4xl font-black text-slate-900 leading-tight">Síntese e Status Final</h2>
                        <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
                          Este relatório contempla todas as etapas executadas desde a definição de escopo até o encerramento do último ciclo PDCA.
                          As informações aqui contidas foram extraídas em tempo real da plataforma de gestão.
                        </p>
                      </div>
                      
                      <div className="w-full max-w-2xl grid grid-cols-3 gap-6 pt-12">
                        <div className="p-8 bg-slate-50 rounded-[2rem] space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Subetapas</p>
                          <p className="text-3xl font-black text-indigo-600">{project.subtasks.length}</p>
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[2rem] space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ciclos Ativos</p>
                          <p className="text-3xl font-black text-amber-600">{project.subtasks.flatMap(s => s.pdcaCycles).filter(c => c.status === 'Ativo').length}</p>
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[2rem] space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concluídos</p>
                          <p className="text-3xl font-black text-emerald-600">{project.subtasks.flatMap(s => s.pdcaCycles).filter(c => c.status === 'Concluído').length}</p>
                        </div>
                      </div>

                      <div className="pt-20">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Gerado Automático pelo Sistema</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RefreshCw({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
