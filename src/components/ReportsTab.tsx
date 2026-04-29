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

// FlowProcess Horizontal Logo SVG for PDF
const SYSTEM_LOGO_SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="921" height="212" viewBox="0 0 921 212">
<path d="M0 0 C6.85 4.55 10.97 12.5 14.92 19.47 C16.06 21.43 17.2 23.4 18.34 25.37 C18.91 26.34 19.48 27.32 20.07 28.33 C22.51 32.47 25.08 36.54 27.67 40.59 C32.1 47.52 36.41 54.5 40.67 61.53" fill="#003489"/><path d="M250 75C186.48 75 135 126.48 135 190C135 253.51 186.48 305 250 305" fill="#003489"/></svg>`;

const SYSTEM_LOGO_PRIMARY_COLOR = '#003489';

// Helper to convert SVG to PNG Base64 for pdfMake compatibility
const svgToPngBase64 = (svgString: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const pngBase64 = canvas.toDataURL('image/png');
        resolve(pngBase64);
      } else {
        // Fallback to a simple data URL if canvas fails
        resolve("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==");
      }
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      resolve("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==");
    };

    img.src = url;
  });
};

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
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">FP</div>
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
      const logoBase64 = await svgToPngBase64(SYSTEM_LOGO_SVG);
      
      if (reportType === 'Relatório Completo') {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) throw new Error('Projeto não encontrado');

        setProgress(30);

        const docDefinition: any = {
          pageSize: 'A4',
          pageMargins: [40, 80, 40, 60],
          header: (currentPage: number, pageCount: number) => {
            if (currentPage === 1) return null;
            return {
              margin: [40, 20, 40, 0],
              columns: [
                {
                  image: logoBase64,
                  fit: [120, 40],
                  alignment: 'left',
                  margin: [0, 10, 0, 10]
                },
                {
                  width: '*',
                  stack: [
                    { text: 'RELATÓRIO CORPORATIVO EXECUTIVO', style: 'headerLabel' },
                    { text: project.name.toUpperCase(), style: 'headerValue' }
                  ],
                  margin: [10, 0, 0, 0]
                },
                {
                  width: 'auto',
                  stack: [
                    { text: 'EMISSÃO', style: 'headerLabel', alignment: 'right' },
                    { text: format(new Date(), "dd/MM/yyyy"), style: 'headerValue', alignment: 'right' }
                  ]
                }
              ]
            };
          },
          footer: (currentPage: number, pageCount: number) => {
            return {
              margin: [40, 0, 40, 0],
              stack: [
                {
                  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }]
                },
                {
                  columns: [
                    {
                      image: logoBase64,
                      fit: [100, 30],
                      alignment: 'center',
                      margin: [0, 10, 0, 0]
                    },
                    { width: '*', text: `FLOWPROCESS - Melhoria Contínua`, style: 'footerText', margin: [10, 10, 0, 0] },
                    { width: 'auto', text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', style: 'footerText', margin: [0, 10, 0, 0] }
                  ]
                }
              ]
            };
          },
          content: [
            // CAPA
            {
              stack: [
                {
                  image: logoBase64,
                  fit: [300, 120],
                  alignment: 'center',
                  margin: [0, 40, 0, 20]
                },
                {
                  text: 'RELATÓRIO TÉCNICO DE MELHORIA',
                  style: 'capaSubtitle',
                  alignment: 'center'
                },
                {
                  text: project.name.toUpperCase(),
                  style: 'capaTitle',
                  alignment: 'center',
                  margin: [0, 10, 0, 80]
                },
                {
                  columns: [
                    {
                      width: '*',
                      stack: [
                        { text: 'RESPONSÁVEL ESTRATÉGICO', style: 'label' },
                        { text: users.find(u => u.id === project.assignedTo)?.name || 'NÃO ATRIBUÍDO', style: 'capaValue' },
                        { text: 'DURAÇÃO ESTIMADA', style: 'label', margin: [0, 20, 0, 2] },
                        { text: `${project.scope?.startDate ? format(parseISO(project.scope.startDate), 'dd/MM/yyyy') : 'N/A'} - ${project.scope?.forecastCompletion ? format(parseISO(project.scope.forecastCompletion), 'dd/MM/yyyy') : 'N/A'}`, style: 'capaValue' }
                      ]
                    },
                    {
                      width: '*',
                      stack: [
                        { text: 'SETOR(ES) ENVOLVIDO(S)', style: 'label' },
                        { text: project.scope?.involvedSectors?.map(s => s.name).join(', ').toUpperCase() || 'GERAL / TRANSVERSAL', style: 'capaValue' },
                        { text: 'STATUS ATUAL', style: 'label', margin: [0, 20, 0, 2] },
                        { text: project.status.toUpperCase(), style: 'capaValue', color: project.status === 'Concluído' ? '#059669' : '#003489' }
                      ]
                    }
                  ],
                  margin: [40, 0, 40, 0]
                }
              ],
              pageBreak: 'after'
            },
            // ESCOPO
            { text: '01. RESUMO EXECUTIVO E ESCOPO', style: 'sectionHeading' },
            {
              canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#003489' }],
              margin: [0, 0, 0, 20]
            },
            {
              columns: [
                {
                  width: '60%',
                  stack: [
                    { text: 'DESCRIÇÃO DO PROBLEMA / PROJETO', style: 'label' },
                    { text: project.description || project.scope?.problemDescription || 'Nenhum detalhe adicional fornecido.', style: 'bodyText', margin: [0, 5, 0, 15] },
                    { text: 'OBJETIVO MENSURÁVEL (META)', style: 'label' },
                    { text: project.scope?.measurableObjective || 'Não definido', style: 'bodyText', margin: [0, 5, 0, 15] }
                  ]
                },
                {
                  width: '40%',
                  stack: [
                    {
                      canvas: [{ type: 'rect', x: 0, y: 0, w: 180, h: 80, r: 10, color: '#f8fafc', lineColor: '#e2e8f0' }]
                    },
                    {
                      stack: [
                        { text: 'GANHO PROJETADO', style: 'label', margin: [15, -70, 0, 2] },
                        { text: project.scope?.financial?.gainProjection?.value ? `R$ ${project.scope.financial.gainProjection.value.toLocaleString()}` : 'Não estimado', style: 'value', margin: [15, 0, 0, 10] },
                        { text: 'IMPACTO ATUAL', style: 'label', margin: [15, 0, 0, 2] },
                        { text: project.scope?.financial?.currentImpact?.value ? `R$ ${project.scope.financial.currentImpact.value.toLocaleString()}` : 'Não definido', style: 'bodyText', margin: [15, 0, 0, 0], bold: true, color: '#e11d48' }
                      ]
                    }
                  ]
                }
              ],
              margin: [0, 0, 0, 40]
            },
            {
              stack: [
                { text: 'SETOR(ES) IMPACTADO(S)', style: 'label' },
                { text: project.scope?.involvedSectors?.map(s => s.name).join(', ') || 'Geral / Transversal', style: 'bodyText', margin: [0, 5, 0, 15] }
              ]
            },
            // MAPEAMENTO
            { text: '02. MAPEAMENTO DE PROCESSOS', style: 'sectionHeading', pageBreak: 'before' },
            {
              canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#003489' }],
              margin: [0, 0, 0, 20]
            },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  [
                    { text: 'ETAPA DO PROCESSO', style: 'tableHeader' },
                    { text: 'RESPONSÁVEL', style: 'tableHeader' },
                    { text: 'PRAZO', style: 'tableHeader' },
                    { text: 'STATUS', style: 'tableHeader' }
                  ],
                  ...(project.subtasks || []).map(sub => [
                    { text: sub.title.toUpperCase(), style: 'tableCell', bold: true },
                    { text: users.find(u => u.id === sub.responsibleId)?.name || 'N/A', style: 'tableCell' },
                    { text: `${sub.startDate ? format(parseISO(sub.startDate), 'dd/MM/yyyy') : '--'} a ${sub.endDate ? format(parseISO(sub.endDate), 'dd/MM/yyyy') : '--'}`, style: 'tableCell' },
                    { text: sub.status.toUpperCase(), style: 'tableCell', color: sub.status === 'Concluído' ? '#059669' : '#d97706', bold: true }
                  ])
                ]
              },
              layout: 'headerLineOnly'
            },
            {
              stack: [
                { text: 'GARGALOS E PONTOS DE MELHORIA IDENTIFICADOS', style: 'label', margin: [0, 15, 0, 5] },
                ...( (project.subtasks || []).flatMap(sub => 
                  (sub.mapping?.nodes || []).filter((n: any) => n.data?.isProblemStep).map((node: any) => ({
                    columns: [
                      { text: `• ${sub.title.toUpperCase()}:`, width: '30%', style: 'bodyTextSmall', bold: true },
                      { text: node.data?.label || 'Ponto de atenção', width: '70%', style: 'bodyTextSmall', color: '#e11d48' }
                    ],
                    margin: [0, 2, 0, 0]
                  }))
                ).length > 0 ? (project.subtasks || []).flatMap(sub => 
                  (sub.mapping?.nodes || []).filter((n: any) => n.data?.isProblemStep).map((node: any) => ({
                    columns: [
                      { text: `• ${sub.title.toUpperCase()}:`, width: '30%', style: 'bodyTextSmall', bold: true },
                      { text: node.data?.label || 'Ponto de atenção', width: '70%', style: 'bodyTextSmall', color: '#e11d48' }
                    ],
                    margin: [0, 2, 0, 0]
                  }))
                ) : [{ text: 'Nenhum gargalo crítico identificado no mapeamento atual.', style: 'bodyTextSmall', italic: true }] )
              ]
            },
            // ANALISES
            { text: '03. ANÁLISES DE CAUSA RAIZ', style: 'sectionHeading', pageBreak: 'before' },
            {
              canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#003489' }],
              margin: [0, 0, 0, 20]
            },
            ...(project.subtasks?.flatMap(s => s.pdcaCycles) || []).map((cycle, idx) => {
              const rca = cycle.plan.rootCauseAnalysis;
              const analysisContent = [];

              if (rca.type === '5whys') {
                analysisContent.push({ text: `5 PORQUÊS - ${cycle.title}`, style: 'stepHeading', color: '#4f46e9', margin: [0, 10, 0, 5] });
                analysisContent.push({
                  ul: rca.entries.map((entry, i) => `${i + 1}º Porquê: ${entry.text}`),
                  style: 'bodyTextSmall',
                  margin: [0, 0, 0, 15]
                });
              } else if (rca.type === 'ishikawa' && rca.ishikawa) {
                analysisContent.push({ text: `ISHIKAWA - ${cycle.title}`, style: 'stepHeading', color: '#4f46e9', margin: [0, 10, 0, 5] });
                const ishikawaTable = {
                  table: {
                    widths: ['30%', '70%'],
                    body: [
                      [{ text: 'CATEGORIA', style: 'tableHeader' }, { text: 'CAUSAS IDENTIFICADAS', style: 'tableHeader' }],
                      ...rca.ishikawa.map(cat => [
                        { text: cat.name, style: 'tableCell', bold: true },
                        { text: cat.entries.map(e => e.text).join(', ') || 'Nenhuma registrada', style: 'tableCell' }
                      ])
                    ]
                  },
                  layout: 'lightHorizontalLines',
                  margin: [0, 0, 0, 15]
                };
                analysisContent.push(ishikawaTable);
              }

              analysisContent.push({ text: 'CAUSA RAIZ IDENTIFICADA:', style: 'labelTiny' });
              analysisContent.push({ text: rca.identifiedRootCause || 'Não definida', style: 'bodyText', bold: true, color: '#e11d48', margin: [0, 0, 0, 20] });

              // 5W2H Table
              if (cycle.plan.actionPlan && cycle.plan.actionPlan.length > 0) {
                analysisContent.push({ text: 'PLANO DE AÇÃO (5W2H)', style: 'stepHeading', color: '#059669', margin: [0, 10, 0, 5] });
                const table5w2h = {
                  table: {
                    headerRows: 1,
                    widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                    body: [
                      [
                        { text: 'O QUE', style: 'tableHeaderSmall' },
                        { text: 'POR QUE', style: 'tableHeaderSmall' },
                        { text: 'ONDE', style: 'tableHeaderSmall' },
                        { text: 'QUANDO', style: 'tableHeaderSmall' },
                        { text: 'QUEM', style: 'tableHeaderSmall' },
                        { text: 'COMO', style: 'tableHeaderSmall' },
                        { text: 'QUANTO', style: 'tableHeaderSmall' }
                      ],
                      ...cycle.plan.actionPlan.map(item => [
                        { text: item.what, style: 'tableCellTiny' },
                        { text: item.why, style: 'tableCellTiny' },
                        { text: item.where, style: 'tableCellTiny' },
                        { text: item.when, style: 'tableCellTiny' },
                        { text: item.who, style: 'tableCellTiny' },
                        { text: item.how, style: 'tableCellTiny' },
                        { text: item.howMuch, style: 'tableCellTiny' }
                      ])
                    ]
                  },
                  layout: 'lightHorizontalLines',
                  margin: [0, 0, 0, 20]
                };
                analysisContent.push(table5w2h);
              }

              return analysisContent;
            }),

            // PDCA
            { text: '04. CICLOS DE MELHORIA (PDCA)', style: 'sectionHeading', pageBreak: 'before' },
            {
              canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#003489' }],
              margin: [0, 0, 0, 20]
            },
            ...( (project.subtasks?.flatMap(s => s.pdcaCycles) || []).length > 0 
              ? (project.subtasks?.flatMap(s => s.pdcaCycles) || []).map((cycle, idx) => ({
              stack: [
                {
                  text: `CICLO ${idx + 1}: ${cycle.title.toUpperCase()}`,
                  style: 'subSectionHeading',
                  margin: [0, 10, 0, 15]
                },
                {
                  columns: [
                    // PLAN & DO
                    {
                      width: '50%',
                      stack: [
                        { text: 'PLAN - Planejamento', style: 'stepHeading', color: '#4f46e9' },
                        { text: 'Problema:', style: 'labelTiny' },
                        { text: cycle.plan.problemDescription, style: 'bodyTextSmall', margin: [0, 0, 0, 5] },
                        { text: 'Causa Raiz:', style: 'labelTiny' },
                        { text: cycle.plan.rootCauseAnalysis.identifiedRootCause || 'Não definida', style: 'bodyTextSmall', margin: [0, 0, 0, 5] },
                        
                        { text: 'DO - Execução', style: 'stepHeading', color: '#d97706', margin: [0, 10, 0, 5] },
                        ...(cycle.plan.actionPlan || []).map(action => ({
                          text: `• ${action.what} (${translateStatus(action.status)})`,
                          style: 'bodyTextSmall',
                          margin: [0, 2, 0, 0]
                        }))
                      ],
                      margin: [0, 0, 10, 0]
                    },
                    // CHECK & ACT
                    {
                      width: '50%',
                      stack: [
                        { text: 'CHECK - Verificação', style: 'stepHeading', color: '#059669' },
                        { text: 'Resultado:', style: 'labelTiny' },
                        { text: cycle.plan.actionPlan?.[0]?.worked || 'Em análise', style: 'bodyTextSmall', margin: [0, 0, 0, 5] },
                        { text: 'Evidência:', style: 'labelTiny' },
                        { text: cycle.plan.actionPlan?.[0]?.evidence || 'Pendente', style: 'bodyTextSmall', margin: [0, 0, 0, 5] },

                        { text: 'ACT - Padronização', style: 'stepHeading', color: '#e11d48', margin: [0, 10, 0, 5] },
                        { text: 'Ação Final:', style: 'labelTiny' },
                        { text: cycle.plan.actionPlan?.[0]?.finalAction || 'Em definição', style: 'bodyTextSmall', margin: [0, 0, 0, 5] },
                        { text: 'Padronização:', style: 'labelTiny' },
                        { text: cycle.plan.actionPlan?.[0]?.standardizationModels?.join(', ') || 'Nenhum modelo aplicado', style: 'bodyTextSmall' }
                      ],
                      margin: [10, 0, 0, 0]
                    }
                  ],
                  margin: [0, 0, 0, 20]
                },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e8f0' }], margin: [0, 10, 0, 20] }
              ],
              unbreakable: true
            })) : [{ text: 'Nenhum ciclo PDCA registrado para este projeto.', style: 'bodyText', italic: true }] ),
            // HISTORICO
            { text: '05. HISTÓRICO DE INTERAÇÕES E AÇÕES', style: 'sectionHeading', pageBreak: 'before' },
            {
              canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#003489' }],
              margin: [0, 0, 0, 20]
            },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto'],
                body: [
                  [
                    { text: 'RESPONSÁVEL', style: 'tableHeader' },
                    { text: 'DESCRIÇÃO DA AÇÃO', style: 'tableHeader' },
                    { text: 'STATUS', style: 'tableHeader' },
                    { text: 'CONCLUSÃO', style: 'tableHeader' }
                  ],
                  ...actions.filter(a => a.projectId === selectedProjectId).map(a => [
                    { text: a.responsibleName, style: 'tableCell' },
                    { text: a.action, style: 'tableCell' },
                    { 
                      text: (STATUS_MAP[a.status] || a.status).toUpperCase(), 
                      style: 'tableCell', 
                      bold: true, 
                      color: a.status === 'Concluído' ? '#059669' : a.status === 'Em andamento' ? '#d97706' : '#64748b' 
                    },
                    { text: a.completionDate || '---', style: 'tableCell' }
                  ])
                ]
              },
              layout: {
                fillColor: function (i: number) {
                  return (i % 2 === 0) ? '#f8fafc' : null;
                },
                hLineColor: '#e2e8f0',
                vLineColor: '#e2e8f0'
              },
              margin: [0, 0, 0, 20]
            }
          ],
          styles: {
            capaTitle: { fontSize: 28, bold: true, color: '#0f172a', letterSpacing: 1 },
            capaSubtitle: { fontSize: 10, bold: true, color: '#4f46e9', letterSpacing: 4 },
            capaValue: { fontSize: 14, bold: true, color: '#1e293b' },
            headerLabel: { fontSize: 7, bold: true, color: '#94a3b8', letterSpacing: 1 },
            headerValue: { fontSize: 9, bold: true, color: '#475569' },
            sectionHeading: { fontSize: 20, bold: true, color: '#003489', margin: [0, 0, 0, 5] },
            subSectionHeading: { fontSize: 14, bold: true, color: '#334155', fillColor: '#f8fafc', padding: [5, 5] },
            stepHeading: { fontSize: 11, bold: true, decoration: 'underline' },
            label: { fontSize: 8, bold: true, color: '#64748b', margin: [0, 0, 0, 2] },
            labelTiny: { fontSize: 7, bold: true, color: '#94a3b8' },
            value: { fontSize: 12, bold: true, color: '#1e293b' },
            bodyText: { fontSize: 11, color: '#334155', lineHeight: 1.4 },
            bodyTextSmall: { fontSize: 9, color: '#475569', lineHeight: 1.3 },
            tableHeader: { fontSize: 10, bold: true, color: '#0f172a', margin: [0, 5, 0, 5] },
            tableHeaderSmall: { fontSize: 8, bold: true, color: '#0f172a' },
            tableCell: { fontSize: 9, color: '#44546a', margin: [0, 5, 0, 5] },
            tableCellTiny: { fontSize: 7, color: '#44546a' },
            footerText: { fontSize: 8, color: '#94a3b8' }
          },
          defaultStyle: {
            font: 'Roboto'
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
