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
import { SYSTEM_LOGO_PATH } from '../constants/pdfLogo';
import { getBase64ImageFromUrl } from '../lib/utils';
import html2pdf from 'html2pdf.js';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import Viewer from 'bpmn-js/lib/NavigatedViewer';
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
import { Project, User, OperationalAction, ReportLog, GainsStructure } from '../types';

const formatGains = (gains: GainsStructure | undefined): string => {
  if (!gains) return 'Sem registro';
  const tangible = (gains.tangible || []).map(t => `${t.type}: ${t.unit} ${t.value}`).join(' | ');
  const intangible = (gains.intangible || []).map(i => `${i.type} (${i.impactLevel})`).join(' | ');
  
  if (!tangible && !intangible) return 'Sem registro';
  return [tangible, intangible].filter(Boolean).join(' || ');
};
import { cn, exportarCSVPadrao } from '../lib/utils';
import { logFeature } from '../lib/changelogService';
import { logUserActivity } from '../lib/activityLogger';
import FilterDropdown from './FilterDropdown';

const STATUS_MAP: Record<string, string> = {
  'pending': 'Pendente',
  'in_progress': 'Em andamento',
  'done': 'Concluído'
};

const translateStatus = (status: string) => STATUS_MAP[status] || status;

const translateMonitoringMode = (mode: string) => {
  if (mode === 'Dias') return 'dias';
  if (mode === 'Semanas') return 'semanas';
  if (mode === 'Meses') return 'meses';
  return mode || '';
};

const formatValueBrl = (val: any): string => {
  if (val === undefined || val === null || val === '') return 'R$ 0,00';
  if (typeof val === 'string' && val.includes('R$')) return val;
  const num = Number(val);
  if (isNaN(num)) return `R$ ${val}`;
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getSubtaskSVG = async (xml: string, customData: Record<string, any> = {}): Promise<string | null> => {
  if (!xml) return null;
  let container: HTMLDivElement | null = null;
  try {
    container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.width = '1024px';
    container.style.height = '600px';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    const viewer = new Viewer({ container });
    await viewer.importXML(xml);
    
    const canvas = viewer.get('canvas') as any;
    if (canvas) {
      canvas.zoom('fit-viewport');
    }

    const elementRegistry = viewer.get('elementRegistry') as any;
    if (elementRegistry && customData) {
      // Previne duplicação removendo quaisquer badges/indicadores de problemas antigos que já existam no contêiner
      const existingIndicators = container.querySelectorAll('.problem-indicator-svg');
      existingIndicators.forEach(el => el.parentNode?.removeChild(el));

      // Varre cada elemento customizado para aplicar as respectivas cores de fundo/borda e indicadores de gargalos
      Object.entries(customData).forEach(([elementId, data]: [string, any]) => {
        const element = elementRegistry.get(elementId);
        if (!element) return;

        const gElement = container?.querySelector(`[data-element-id="${elementId}"]`);
        if (!gElement) return;

        // Aplica cores personalizadas do usuário do editor para preservar o layout idêntico das formas no PDF
        const visual = gElement.querySelector('.djs-visual');
        if (visual) {
          const shapes = visual.querySelectorAll('rect, circle, polygon');
          shapes.forEach((shape: any) => {
            if (data?.backgroundColor) {
              shape.style.fill = data.backgroundColor;
              shape.setAttribute('fill', data.backgroundColor);
            }
            if (data?.borderColor) {
              shape.style.stroke = data.borderColor;
              shape.setAttribute('stroke', data.borderColor);
            }
          });
        }

        // Se este nó de subprocesso estiver marcado como um gargalo/etapa problema, insere dinamicamente uma tag/badge vermelha de atenção
        if (data?.isProblemStep) {
          const width = element.width || 100;
          
          // Define coordenadas relativas baseadas na largura para posicionar a tag de atenção no canto direito
          const badgeX = width;
          const badgeY = 0;
          
          const ns = "http://www.w3.org/2000/svg";
          const badgeGroup = document.createElementNS(ns, "g");
          badgeGroup.setAttribute("class", "problem-indicator-svg");
          
          // Cria o círculo vermelho de alerta do badge
          const circle = document.createElementNS(ns, "circle");
          circle.setAttribute("cx", badgeX.toString());
          circle.setAttribute("cy", badgeY.toString());
          circle.setAttribute("r", "10");
          circle.setAttribute("fill", "#FF6B6B");
          circle.setAttribute("stroke", "#ffffff");
          circle.setAttribute("stroke-width", "2");
          badgeGroup.appendChild(circle);
          
          // Cria a linha vertical branca do ponto de exclamação
          const rect = document.createElementNS(ns, "rect");
          rect.setAttribute("x", (badgeX - 1).toString());
          rect.setAttribute("y", (badgeY - 5).toString());
          rect.setAttribute("width", "2");
          rect.setAttribute("height", "6");
          rect.setAttribute("fill", "#ffffff");
          rect.setAttribute("rx", "1");
          badgeGroup.appendChild(rect);
          
          // Cria o ponto branco na base do ponto de exclamação do badge
          const dot = document.createElementNS(ns, "circle");
          dot.setAttribute("cx", badgeX.toString());
          dot.setAttribute("cy", (badgeY + 3).toString());
          dot.setAttribute("r", "1.2");
          dot.setAttribute("fill", "#ffffff");
          badgeGroup.appendChild(dot);
          
          gElement.appendChild(badgeGroup);
        }
      });
    }
    
    const { svg } = await viewer.saveSVG();
    document.body.removeChild(container);
    return svg;
  } catch (error) {
    console.error('Error rendering SVG from XML in complete report', error);
    try {
      if (container && container.parentNode) {
        document.body.removeChild(container);
      }
    } catch (_) {}
    return null;
  }
};

const renderGainsTable = (gains: GainsStructure | undefined) => {
  if (!gains || !gains.tangible || gains.tangible.length === 0) {
    return {
      text: "Nenhum ganho tangível registrado.",
      style: "bodyTextSmall",
      italic: true,
    };
  }

  return {
    table: {
      widths: ["*", "auto", "auto"],
      headerRows: 1,
      body: [
        [
          { text: "TIPO DE GANHO", style: "tableHeader" },
          { text: "VALOR", style: "tableHeader", alignment: "right" },
          { text: "UNIDADE", style: "tableHeader" },
        ],
        ...gains.tangible.map((t) => [
          { text: t.type || "---", style: "tableCell" },
          {
            text: t.value?.toString() || "0",
            style: "tableCell",
            alignment: "right",
            bold: true
          },
          { text: t.unit || "---", style: "tableCell" },
        ]),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };
};

// Set up pdfMake fonts
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if ((pdfFonts as any).vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).vfs;
}

const formatExpectedTangibleGains = (gains: GainsStructure | undefined): string => {
  if (!gains || !gains.tangible || gains.tangible.length === 0) return '';
  return gains.tangible.map(t => `${t.type || ''}: ${t.unit || ''} ${t.value ?? ''}`).filter(Boolean).join(' | ');
};

const formatExpectedIntangibleGains = (gains: GainsStructure | undefined): string => {
  if (!gains || !gains.intangible || gains.intangible.length === 0) return '';
  return gains.intangible.map(i => `${i.type || ''} (${i.impactLevel || ''})${i.description ? ` - ${i.description}` : ''}`).filter(Boolean).join(' | ');
};

const formatRealGainsStr = (gains: GainsStructure | undefined): string => {
  if (!gains) return '';
  const tangible = (gains.tangible || []).map(t => `${t.type || ''}: ${t.unit || ''} ${t.value ?? ''}`).filter(Boolean).join(' | ');
  const intangible = (gains.intangible || []).map(i => `${i.type || ''} (${i.impactLevel || ''})${i.description ? ` - ${i.description}` : ''}`).filter(Boolean).join(' | ');
  if (!tangible && !intangible) return '';
  return [tangible, intangible].filter(Boolean).join(' || ');
};

const getRootCausa = (cycle: any): string => {
  const rca = cycle.plan?.rootCauseAnalysis;
  if (!rca) return '';
  if (rca.identifiedRootCause && rca.identifiedRootCause.trim() !== '') {
    return rca.identifiedRootCause;
  }
  if (rca.priorityCauses && rca.priorityCauses.length > 0) {
    return rca.priorityCauses.filter(Boolean).join(' | ');
  }
  return '';
};

const formatCsvDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, 'dd/MM/yyyy');
  } catch (error) {
    return dateStr;
  }
};

const HEADERS_PDCA = [
  "ID do Processo",
  "Nome do Problema",
  "PLAN - Descrição do Problema",
  "PLAN - Causa Raiz",
  "PLAN - Impacto - Descrição",
  "PLAN - Impacto - Valor Atual",
  "PLAN - Meta (%)",
  "PLAN - Impacto - Ganhos Esperados Tangíveis",
  "PLAN - Impacto - Ganhos Esperados Intangíveis",
  "ODS",
  "ODS (Descrição)",
  "ESG",
  "ESG (Descrição)",
  "Plano de ação - What (O que será feito)",
  "Plano de ação - Why (Por que será feito)",
  "Plano de ação - Where (Onde)",
  "Plano de ação - When (Quando)",
  "Plano de ação - Who (Responsável)",
  "Plano de ação - How (Como será feito)",
  "Plano de ação - How Much (Custo)",
  "Plano de ação - Tipo de Plano (Processual / Operacional / Inovação)",
  "DO - Status",
  "DO - Data de Início",
  "DO - Data de Conclusão",
  "CHECK - Modo Acompanhamento",
  "CHECK - Período",
  "CHECK - Observações do período de acompanhamento",
  "CHECK - Funcionou",
  "CHECK - Ganho real obtido",
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

// import { PDF_LOGO_PNG_BASE64 } from '../constants/pdfLogo';

const SYSTEM_LOGO_PRIMARY_COLOR = '#003489';

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
  const [completeReportCollaboratorId, setCompleteReportCollaboratorId] = useState<string>('');
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
      const logoBase64 = await getBase64ImageFromUrl(SYSTEM_LOGO_PATH);
      
      if (reportType === 'Relatório Completo') {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) throw new Error('Projeto não encontrado');

        setProgress(30);

        // Render subtasks SVGs before document definition is built
        const subtaskSVGs: Record<string, string> = {};
        const steps = (project.subtasks || []).filter(sub => !completeReportCollaboratorId || sub.responsibleId === completeReportCollaboratorId);
        const stepProgressDelta = 30 / (steps.length || 1);
        let currentProgress = 30;

        for (const sub of steps) {
          if (sub.mapping?.xml) {
            const svgStr = await getSubtaskSVG(sub.mapping.xml, sub.mapping.customData || {});
            if (svgStr) {
              subtaskSVGs[sub.id] = svgStr;
            }
          }
          currentProgress += stepProgressDelta;
          setProgress(Math.min(60, Math.round(currentProgress)));
        }
        
        setProgress(60);

        const docDefinition: any = {
          pageSize: 'A4',
          pageMargins: [40, 40, 40, 60],
          images: {
            logo: logoBase64
          },
          footer: (currentPage: number, pageCount: number) => {
            return {
              margin: [40, 10, 40, 0],
              stack: [
                {
                  canvas: [
                    {
                      type: 'line',
                      x1: 0,
                      y1: 0,
                      x2: 515,
                      y2: 0,
                      lineWidth: 0.5,
                      lineColor: '#D3D3D3'
                    }
                  ]
                },
                {
                  columns: [
                    { width: 100, text: '', style: 'footerText' },
                    {
                      width: '*',
                      text: `GIP FLOW – Melhoria Contínua`,
                      style: 'footerText',
                      alignment: 'center'
                    },
                    {
                      width: 100,
                      text: `Página ${currentPage} de ${pageCount}`,
                      alignment: 'right',
                      style: 'footerText'
                    }
                  ],
                  margin: [0, 10, 0, 0]
                }
              ]
            };
          },
          content: [
            // CABEÇALHO PADRONIZADO (LOGO, TITULO, METADADOS)
            {
              image: 'logo',
              width: 220,
              alignment: 'left',
              margin: [0, 0, 0, 24]
            },
            {
              text: 'RELATÓRIO TÉCNICO DE MELHORIA',
              style: 'mainTitle',
              alignment: 'center',
              margin: [0, 0, 0, 15]
            },
            {
              table: {
                widths: ['*', '*'],
                body: [
                  [
                    {
                      stack: [
                        { text: `PROJETO: ${project.name.toUpperCase()}`, style: 'metadataText' },
                        { text: `RESPONSÁVEL PELO PROJETO: ${(users.find(u => u.id === project.assignedTo)?.name || 'NÃO ATRIBUÍDO').toUpperCase()}`, style: 'metadataText', margin: [0, 4, 0, 0] }
                      ],
                      margin: [8, 4, 8, 4]
                    },
                    {
                      stack: [
                        { text: `EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}`, style: 'metadataText', alignment: 'right' },
                        { text: `PERÍODO: ${project.scope?.startDate ? format(parseISO(project.scope.startDate), 'dd/MM/yyyy') : 'N/A'} a ${project.scope?.forecastCompletion ? format(parseISO(project.scope.forecastCompletion), 'dd/MM/yyyy') : 'N/A'}`, style: 'metadataText', alignment: 'right', margin: [0, 4, 0, 0] }
                      ],
                      margin: [8, 4, 8, 4]
                    }
                  ]
                ]
              },
              layout: {
                fillColor: () => '#f3f4f6',
                hLineWidth: () => 0,
                vLineWidth: () => 0
              },
              margin: [0, 0, 0, 20]
            },

            // 01. RESUMO EXECUTIVO E ESCOPO
            {
              table: {
                widths: ['*'],
                body: [
                  [{ text: '01. RESUMO EXECUTIVO E ESCOPO', style: 'sectionHeader' }]
                ]
              },
              layout: 'noBorders',
              margin: [0, 10, 0, 5]
            },
            {
              stack: [
                { text: 'DESCRIÇÃO DO PROBLEMA / PROJETO', style: 'fieldLabel', margin: [0, 8, 0, 4] },
                {
                  table: {
                    widths: ['*'],
                    body: [
                      [{ text: project.description || project.scope?.problemDescription || 'Nenhum detalhe adicional fornecido.', style: 'bodyHighlight', margin: [10, 8, 10, 8] }]
                    ]
                  },
                  layout: {
                    fillColor: () => '#f9fafb',
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#e2e8f0',
                    vLineColor: () => '#e2e8f0'
                  }
                }
              ],
              margin: [0, 0, 0, 16]
            },
            {
              stack: [
                { text: 'OBJETIVO MENSURÁVEL (META)', style: 'fieldLabel', margin: [0, 0, 0, 4] },
                { text: project.scope?.measurableObjective || 'Não definido', style: 'bodyHighlight', bold: true, color: '#003489', margin: [0, 0, 0, 12] },
                { text: 'SETOR(ES) IMPACTADO(S)', style: 'fieldLabel', margin: [0, 0, 0, 4] },
                { text: project.scope?.involvedSectors?.map(s => s.name).join(', ').toUpperCase() || 'GERAL / TRANSVERSAL', style: 'bodyHighlight' }
              ],
              margin: [0, 0, 0, 20]
            },
            {
              stack: [
                { text: 'SUSTENTABILIDADE (ODS & ESG)', style: 'fieldLabel', margin: [0, 10, 0, 4] },
                {
                  table: {
                    widths: ['*'],
                    body: [
                      [
                        {
                          stack: [
                            {
                              text: [
                                { text: 'ODS Selecionadas: ', bold: true, color: '#003489' },
                                { text: (project.scope?.odsSelecionadas && project.scope.odsSelecionadas.length > 0) ? project.scope.odsSelecionadas.map(n => `ODS ${n}`).join(', ') : 'Nenhuma selecionada' },
                                { text: '\nDescrição ODS: ', bold: true, color: '#003489' },
                                { text: project.scope?.odsDescricao || project.scope?.ods || 'Não descrita' },
                                { text: '\n\nESG Selecionado: ', bold: true, color: '#003489' },
                                { text: (project.scope?.esgSelecionado && project.scope.esgSelecionado.length > 0) ? project.scope.esgSelecionado.join(', ') : 'Nenhum selecionado' },
                                { text: '\nDescrição ESG: ', bold: true, color: '#003489' },
                                { text: project.scope?.esgDescricao || [
                                    project.scope?.esgEnvironmental ? `E: ${project.scope.esgEnvironmental}` : '',
                                    project.scope?.esgSocial ? `S: ${project.scope.esgSocial}` : '',
                                    project.scope?.esgGovernance ? `G: ${project.scope.esgGovernance}` : ''
                                  ].filter(Boolean).join(' | ') || 'Não descrita' }
                              ],
                              style: 'bodyTextSmall',
                              leadingHeight: 1.4
                            }
                          ],
                          margin: [12, 10, 12, 10]
                        }
                      ]
                    ]
                  },
                  layout: {
                    fillColor: () => '#f9fafb',
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#e2e8f0',
                    vLineColor: () => '#e2e8f0'
                  }
                }
              ],
              margin: [0, 0, 0, 24]
            },

            // 02. MAPEAMENTO DE PROCESSOS
            {
              table: {
                widths: ['*'],
                body: [
                  [{ text: '02. MAPEAMENTO DE PROCESSOS', style: 'sectionHeader' }]
                ]
              },
              layout: 'noBorders',
              pageBreak: 'before',
              margin: [0, 10, 0, 15]
            },
            {
              table: {
                headerRows: 1,
                widths: ['35%', '25%', '20%', '20%'],
                body: [
                  [
                    { text: 'ETAPA DO PROCESSO', style: 'tableHeader' },
                    { text: 'RESPONSÁVEL', style: 'tableHeader' },
                    { text: 'PRIORIDADE', style: 'tableHeader' },
                    { text: 'STATUS', style: 'tableHeader' }
                  ],
                  ...(steps && steps.length > 0 ? steps.map(sub => [
                    { text: sub.title.toUpperCase(), style: 'tableCell', bold: true },
                    { text: users.find(u => u.id === sub.responsibleId)?.name || 'N/A', style: 'tableCell' },
                    { text: (sub.priority || 'N/A').toUpperCase(), style: 'tableCell' },
                    { text: sub.status.toUpperCase(), style: 'tableCell', color: sub.status === 'Concluído' ? '#059669' : '#d97706', bold: true }
                  ]) : [
                    [{ text: 'Nenhuma etapa de processo registrada.', colSpan: 4, style: 'tableCell', italic: true }, {}, {}, {}]
                  ])
                ]
              },
              layout: {
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                hLineColor: () => '#D3D3D3',
                vLineColor: () => '#D3D3D3',
                paddingLeft: () => 8,
                paddingRight: () => 8,
                paddingTop: () => 8,
                paddingBottom: () => 8
              },
              margin: [0, 0, 0, 20]
            },

            // Fluxograma(s)
            ...(() => {
              const diagramContent: any[] = [];
              const validSubtasksWithMapping = steps.filter(sub => subtaskSVGs[sub.id]);

              if (validSubtasksWithMapping.length > 0) {
                diagramContent.push({ text: 'FLUXOGRAMAS DE PROCESSOS (ANEXO)', style: 'fieldLabel', margin: [0, 10, 0, 8] });
                validSubtasksWithMapping.forEach(sub => {
                  const svgString = subtaskSVGs[sub.id];
                  diagramContent.push({
                    stack: [
                      { text: `FLUXO DA ETAPA: ${sub.title.toUpperCase()}`, style: 'fieldLabel', fontSize: 7, color: '#003489', margin: [0, 5, 0, 4] },
                      {
                        svg: svgString,
                        width: 480,
                        alignment: 'center'
                      }
                    ],
                    margin: [0, 5, 0, 20],
                    unbreakable: true
                  });
                });
              }
              return diagramContent;
            })(),

            {
              stack: [
                { text: 'GARGALOS IDENTIFICADOS NO MAPEAMENTO', style: 'fieldLabel', margin: [0, 10, 0, 4] },
                {
                  table: {
                    widths: ['*'],
                    body: [
                      [
                        {
                          stack: (() => {
                            const bottlenecks = steps.flatMap(sub => {
                              const customData = sub.mapping?.customData || {};
                              return Object.entries(customData)
                                .filter(([nodeId, nodeData]: [string, any]) => !!nodeData?.isProblemStep)
                                .map(([nodeId, nodeData]: [string, any]) => {
                                  const matchingCycles = (sub.pdcaCycles || []).filter(c => c.taskId === nodeId);
                                  const cycleNames = matchingCycles.map(c => c.nomePdca || c.title).join(', ');
                                  const cycleDisplay = cycleNames ? cycleNames : 'Não associado';
                                  const nodeName = nodeData?.description || 'Ponto crítico';
                                  
                                  return {
                                    text: `Gargalo: [${sub.title.toUpperCase()}${nodeName ? ` - ${nodeName.toUpperCase()}` : ''}] - Ciclo PDCA: [${cycleDisplay.toUpperCase()}]`,
                                    style: 'bodyHighlight',
                                    color: '#e11d48'
                                  };
                                });
                            });
                            if (bottlenecks.length > 0) return bottlenecks;
                            return [{ text: 'Nenhum gargalo identificado no mapeamento atual.', style: 'bodyTextSmall', italic: true }];
                          })(),
                          margin: [12, 10, 12, 10]
                        }
                      ]
                    ]
                  },
                  layout: {
                    fillColor: () => '#f9fafb',
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#e2e8f0',
                    vLineColor: () => '#e2e8f0'
                  }
                }
              ],
              unbreakable: true,
              margin: [0, 0, 0, 24]
            },

            // 03. CICLOS DE MELHORIA (PDCA)
            {
              table: {
                widths: ['*'],
                body: [
                  [{ text: '03. CICLOS DE MELHORIA (PDCA)', style: 'sectionHeader' }]
                ]
              },
              layout: 'noBorders',
              pageBreak: 'before',
              margin: [0, 10, 0, 15]
            },
            ...(() => {
              const cycles = Array.from(new Map((steps.flatMap(s => s.pdcaCycles || []) || []).map(c => [c.id, c])).values());
              if (cycles.length === 0) {
                return [{ text: 'Nenhum ciclo PDCA registrado para este projeto.', style: 'bodyHighlight', italic: true, margin: [0, 10, 0, 20] }];
              }

              return cycles.flatMap((cycle, idx) => {
                const validActions = (cycle.plan.actionPlan || []).filter(
                  (item: any) => item.status !== "Cancelado" && item.ativo !== false,
                );

                const mappedActions = validActions.map((action: any) => ({
                  ...action,
                  displayStatus: translateStatus(action.status),
                  effectiveStatus: action.status,
                }));

                const totalActions = mappedActions.length;
                const doneActions = mappedActions.filter(
                  (item: any) => item.effectiveStatus === "Concluído",
                ).length;
                const pendingActions = totalActions - doneActions;
                const completionRate =
                  totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;

                const cycleContent: any[] = [];

                // Header do Ciclo
                cycleContent.push({
                  text: `CICLO ${idx + 1}: ${(cycle.nomePdca || cycle.title).toUpperCase()}`,
                  style: 'subSectionHeading',
                  margin: [0, 15, 0, 10]
                });

                // --- PLAN (PLANEJAMENTO) ---
                const planItems: any[] = [];
                planItems.push({ text: 'PLAN (PLANEJAMENTO)', style: 'fieldLabel', color: '#003489', margin: [0, 10, 0, 4] });
                planItems.push({
                  table: {
                    widths: ['35%', '65%'],
                    body: [
                      [
                        { text: 'DESCRIÇÃO DO PROBLEMA', style: 'tableHeaderTiny', alignment: 'left' },
                        { text: cycle.plan.problemDescription || 'N/A', style: 'tableCellTiny', alignment: 'left' }
                      ],
                      [
                        { text: 'CAUSA RAIZ IDENTIFICADA', style: 'tableHeaderTiny', alignment: 'left' },
                        { text: cycle.plan.rootCauseAnalysis.identifiedRootCause || 'Pendente', style: 'tableCellTiny', alignment: 'left', bold: true, color: '#e11d48' }
                      ],
                      [
                        { text: 'MÉTODO DE ANÁLISE', style: 'tableHeaderTiny', alignment: 'left' },
                        { 
                          text: (() => {
                            const rcaType = cycle.plan?.rootCauseAnalysis?.type;
                            if (!rcaType) return "Não informado";
                            const normalized = rcaType.toLowerCase().trim();
                            if (normalized === "5whys" || normalized === "5_whys" || normalized === "5 porquês") return "5 Porquês";
                            if (normalized === "list" || normalized === "lista_causas" || normalized === "lista de causas") return "Lista de causas";
                            if (normalized === "ishikawa") return "Ishikawa";
                            return "Não informado";
                          })(), 
                          style: 'tableCellTiny', 
                          alignment: 'left' 
                        }
                      ],
                      [
                        { text: 'IMPACTO GERAL', style: 'tableHeaderTiny', alignment: 'left' },
                        { text: cycle.plan.impact?.description || 'N/A', style: 'tableCellTiny', alignment: 'left' }
                      ],
                      // Subitem correspondente ao Impacto Atual, exibindo seu valor financeiro corrente e a melhoria esperada
                      [
                        { text: 'IMPACTO ATUAL', style: 'tableHeaderTiny', alignment: 'left' },
                        { text: `Valor Atual: ${formatValueBrl(cycle.plan.impact?.value)} | Melhoria Esperada: ${cycle.plan.impact?.improvementPercentage || 0}%`, style: 'tableCellTiny', alignment: 'left', bold: true, color: '#003489' }
                      ]
                    ]
                  },
                  layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#e2e8f0',
                    vLineColor: () => '#e2e8f0',
                    paddingLeft: () => 8,
                    paddingRight: () => 8,
                    paddingTop: () => 6,
                    paddingBottom: () => 6
                  },
                  margin: [0, 0, 0, 10]
                });

                // Ganhos Esperados (PLAN)
                if (cycle.plan.impact?.expectedGains && (cycle.plan.impact.expectedGains.tangible?.length > 0 || cycle.plan.impact.expectedGains.intangible?.length > 0)) {
                  planItems.push({ text: 'GANHOS ESPERADOS (PLAN)', style: 'fieldLabel', margin: [0, 5, 0, 2] });
                  if (cycle.plan.impact.expectedGains.tangible?.length > 0) {
                    planItems.push(renderGainsTable(cycle.plan.impact.expectedGains));
                  }
                  if (cycle.plan.impact.expectedGains.intangible?.length > 0) {
                    planItems.push({
                      ul: cycle.plan.impact.expectedGains.intangible.map((ig: any) => ({
                        text: `${ig.type}: ${ig.description} (Impacto: ${ig.impactLevel})`,
                        fontSize: 7
                      })),
                      margin: [10, 4, 0, 8]
                    });
                  }
                }

                // Plano de Ação (5W2H)
                if (mappedActions.length > 0) {
                  planItems.push({ text: 'PLANO DE AÇÃO (5W2H)', style: 'fieldLabel', margin: [0, 8, 0, 4] });
                  planItems.push({
                    table: {
                      headerRows: 1,
                      widths: ['15%', '15%', '14%', '14%', '14%', '14%', '14%'],
                      body: [
                        [
                          { text: 'O QUÊ', style: 'tableHeaderTiny' },
                          { text: 'POR QUÊ', style: 'tableHeaderTiny' },
                          { text: 'ONDE', style: 'tableHeaderTiny' },
                          { text: 'QUANDO', style: 'tableHeaderTiny' },
                          { text: 'QUEM', style: 'tableHeaderTiny' },
                          { text: 'COMO', style: 'tableHeaderTiny' },
                          { text: 'QUANTO', style: 'tableHeaderTiny' }
                        ],
                        ...mappedActions.map((action: any) => [
                          { text: action.what || '---', style: 'tableCellTiny' },
                          { text: action.why || '---', style: 'tableCellTiny' },
                          { text: action.where || '---', style: 'tableCellTiny' },
                          { text: action.when || '---', style: 'tableCellTiny' },
                          { text: action.who || '---', style: 'tableCellTiny' },
                          { text: action.how || '---', style: 'tableCellTiny' },
                          { text: action.howMuch || '---', style: 'tableCellTiny' }
                        ])
                      ]
                    },
                    layout: {
                      hLineWidth: () => 1,
                      vLineWidth: () => 1,
                      hLineColor: () => '#D3D3D3',
                      vLineColor: () => '#D3D3D3',
                      paddingLeft: () => 4,
                      paddingRight: () => 4,
                      paddingTop: () => 6,
                      paddingBottom: () => 6
                    },
                    margin: [0, 4, 0, 15]
                  });
                }

                cycleContent.push({
                  stack: planItems,
                  unbreakable: true,
                  margin: [0, 0, 0, 15]
                });

                 // --- DO (EXECUÇÃO) ---
                 const doItems: any[] = [];
                 doItems.push({ text: 'DO (EXECUÇÃO)', style: 'fieldLabel', color: '#d97706', margin: [0, 10, 0, 4] });
 
                 // Mapeamento das ações agrupadas com seu respectivo histórico de logs de execução associados de forma sequencial
                 const actionBlocks = mappedActions.map((action: any, aIdx: number) => {
                   const sortedLogs = (action.executionLogs || [])
                     .filter((log: any) => log.observation && log.observation.trim() !== "")
                     .map((log: any) => ({
                       ...log,
                       timeMs: log.timestamp ? new Date(log.timestamp).getTime() : 0
                     }))
                     .sort((a: any, b: any) => b.timeMs - a.timeMs);
 
                   // Geração das linhas correspondentes a cada atualização de histórico da referida ação
                   const logItems = sortedLogs.map((log: any) => {
                     const formattedTime = log.timestamp 
                       ? format(new Date(log.timestamp), "dd/MM/yy HH:mm") 
                       : "---";
                     return {
                       text: `${formattedTime} — ${log.observation}`,
                       fontSize: 8,
                       margin: [0, 2, 0, 2],
                       color: '#475569'
                     };
                   });
 
                   return {
                     stack: [
                       {
                         text: `📌 AÇÃO: ${action.what || 'Sem descrição'}`,
                         fontSize: 9,
                         bold: true,
                         color: '#003489',
                         margin: [0, 8, 0, 4]
                       },
                       {
                         text: `Responsável: ${action.who || 'Não informado'} | Início: ${action.startDate ? format(parseISO(action.startDate), "dd/MM/yyyy") : '---'} | Término: ${action.endDate ? format(parseISO(action.endDate), "dd/MM/yyyy") : '---'}\nStatus: ${action.displayStatus || '---'}`,
                         fontSize: 8,
                         lineHeight: 1.3,
                         margin: [0, 0, 0, 6]
                       },
                       {
                         text: 'Histórico da ação:',
                         fontSize: 8,
                         bold: true,
                         color: '#64748b',
                         margin: [0, 2, 0, 2]
                       },
                       logItems.length > 0 
                         ? {
                             stack: logItems,
                             margin: [10, 0, 0, 8]
                           }
                         : {
                             text: 'Nenhuma atualização de histórico registrada.',
                             fontSize: 8,
                             italic: true,
                             color: '#94a3b8',
                             margin: [10, 0, 0, 8]
                           },
                       {
                         canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: '#cbd5e1' }],
                         margin: [0, 4, 0, 8]
                       }
                     ],
                     unbreakable: true // Garante consistência visual no fluxo de quebras de página do PDF
                   };
                 });
 
                 if (actionBlocks.length > 0) {
                   doItems.push({
                     stack: actionBlocks,
                     margin: [0, 4, 0, 10]
                   });
                 } else {
                   doItems.push({
                     text: 'Nenhuma ação registrada para este ciclo.',
                     fontSize: 8,
                     italic: true,
                     color: '#64748b',
                     margin: [0, 4, 0, 10]
                   });
                 }
 
                 cycleContent.push({
                   stack: doItems,
                   unbreakable: true,
                   margin: [0, 0, 0, 15]
                 });

                // --- CHECK (VERIFICAÇÃO) ---
                const checkItems: any[] = [];
                checkItems.push({ text: 'CHECK (VERIFICAÇÃO)', style: 'fieldLabel', color: '#059669', margin: [0, 10, 0, 4] });
                checkItems.push({
                  columns: [
                    {
                      width: '40%',
                      stack: [
                        { text: 'INDICADORES DE DESEMPENHO (KPIs)', style: 'fieldLabel', fontSize: 7, color: '#94a3b8', margin: [0, 0, 0, 4] },
                        {
                          table: {
                            widths: ['*', 'auto'],
                            body: [
                              [
                                { text: "Ações Totais", style: "tableCellTiny", alignment: 'left' },
                                { text: totalActions.toString(), style: "tableCellTiny", bold: true }
                              ],
                              [
                                { text: "Ações Concluídas", style: "tableCellTiny", alignment: 'left' },
                                { text: doneActions.toString(), style: "tableCellTiny", bold: true }
                              ],
                              [
                                { text: "% de Conclusão", style: "tableCellTiny", bold: true, alignment: 'left', color: '#003489' },
                                { text: `${completionRate}%`, style: "tableCellTiny", bold: true, color: '#003489' }
                              ]
                            ]
                          },
                          layout: {
                            hLineWidth: () => 0.5,
                            vLineWidth: () => 0.5,
                            hLineColor: () => '#cbd5e1',
                            vLineColor: () => '#cbd5e1'
                          }
                        }
                      ]
                    },
                    {
                      width: '60%',
                      stack: [
                        { text: 'PROBLEMAS IDENTIFICADOS NA EXECUÇÃO', style: 'fieldLabel', fontSize: 7, color: '#94a3b8', margin: [0, 0, 0, 4] },
                        {
                          ul: mappedActions
                            .filter((item: any) => item.worked === "Não" || item.worked === "Parcial")
                            .map((item: any) => ({
                              text: `${item.what}: ${item.failureReason || "Resultado insatisfatório."}`,
                              fontSize: 8
                            })),
                          margin: [10, 2, 0, 0]
                        },
                        mappedActions.filter((item: any) => item.worked === "Não" || item.worked === "Parcial").length === 0 
                          ? { text: 'Nenhum desvio ou falha foi registrado para as ações deste ciclo.', style: 'bodyTextSmall', fontSize: 8, italic: true }
                          : {}
                      ]
                    }
                  ],
                  columnGap: 15,
                  margin: [0, 4, 0, 10]
                });

                // Acompanhamento Detalhado
                checkItems.push({ text: 'ACOMPANHAMENTO E VERIFICAÇÃO DETALHADA POR AÇÃO', style: 'fieldLabel', margin: [0, 8, 0, 4] });
                checkItems.push({
                  table: {
                    headerRows: 1,
                    widths: ['30%', '35%', '20%', '15%'],
                    body: [
                      [
                        { text: 'AÇÃO', style: 'tableHeaderTiny' },
                        { text: 'OBSERVAÇÕES DO ACOMPANHAMENTO', style: 'tableHeaderTiny' },
                        { text: 'PERÍODO DE MONITORAMENTO', style: 'tableHeaderTiny' },
                        { text: 'FUNCIONOU?', style: 'tableHeaderTiny' }
                      ],
                      ...mappedActions.map((action: any) => [
                        { text: action.what || '---', style: 'tableCellTiny' },
                        { text: action.monitoringTool || '---', style: 'tableCellTiny' },
                        { text: action.monitoringMode && action.monitoringPeriod ? `${action.monitoringPeriod} ${translateMonitoringMode(action.monitoringMode)}` : '---', style: 'tableCellTiny' },
                        { text: action.worked || 'Em análise', style: 'tableCellTiny', bold: true, color: action.worked === 'Sim' ? '#059669' : action.worked === 'Não' ? '#dc2626' : '#d97706' }
                      ])
                    ]
                  },
                  layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#D3D3D3',
                    vLineColor: () => '#D3D3D3',
                    paddingLeft: () => 4,
                    paddingRight: () => 4,
                    paddingTop: () => 6,
                    paddingBottom: () => 6
                  },
                  margin: [0, 4, 0, 10]
                });

                // Ganhos Reais
                const actionsWithRealGains = mappedActions.filter(
                  (item: any) => item.realGains && (item.realGains.tangible?.length > 0 || item.realGains.intangible?.length > 0)
                );
                if (actionsWithRealGains.length > 0) {
                  checkItems.push({ text: 'GANHOS REAIS E RESULTADOS CONCRETOS OBTIDOS', style: 'fieldLabel', margin: [0, 8, 0, 4] });
                  actionsWithRealGains.forEach((item: any) => {
                    checkItems.push({ text: `Ação: ${item.what}`, fontSize: 8, bold: true, margin: [0, 4, 0, 2] });
                    if (item.realGains.tangible?.length > 0) {
                      checkItems.push(renderGainsTable(item.realGains));
                    }
                    if (item.realGains.intangible?.length > 0) {
                      checkItems.push({
                        ul: item.realGains.intangible.map((ig: any) => ({
                          text: `${ig.type}: ${ig.description} (Impacto: ${ig.impactLevel})`,
                          fontSize: 7
                        })),
                        margin: [10, 2, 0, 4]
                      });
                    }
                  });
                }

                cycleContent.push({
                  stack: checkItems,
                  unbreakable: true,
                  margin: [0, 0, 0, 15]
                });

                // --- ACT (PADRONIZAÇÃO) ---
                const actItems: any[] = [];
                actItems.push({ text: 'ACT (PADRONIZAÇÃO E ENCERRAMENTO)', style: 'fieldLabel', color: '#e11d48', margin: [0, 10, 0, 4] });
                actItems.push({
                  table: {
                    headerRows: 1,
                    widths: ['35%', '20%', '20%', '25%'],
                    body: [
                      [
                        { text: 'AÇÃO', style: 'tableHeaderTiny' },
                        { text: 'STATUS FINAL DO PROBLEMA', style: 'tableHeaderTiny' },
                        { text: 'AÇÃO FINAL TOMADA', style: 'tableHeaderTiny' },
                        { text: 'MODELO DE PADRONIZAÇÃO', style: 'tableHeaderTiny' }
                      ],
                      ...mappedActions.map((item: any) => [
                        { text: item.what || "---", style: "tableCellTiny" },
                        {
                          text: item.finalProblemStatus || "---",
                          style: "tableCellTiny",
                          bold: true,
                          color: item.finalProblemStatus === "Resolvido" ? "#059669" : "#DC2626"
                        },
                        { text: item.finalAction || "---", style: "tableCellTiny" },
                        { text: item.standardizationModels?.join(", ") || "Nenhum aplicado", style: "tableCellTiny" }
                      ])
                    ]
                  },
                  layout: 'lightHorizontalLines',
                  margin: [0, 4, 0, 20]
                });

                cycleContent.push({
                  stack: actItems,
                  unbreakable: true,
                  margin: [0, 0, 0, 15]
                });

                // Linha divisória
                cycleContent.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 15, 0, 15] });

                return cycleContent;
              });
            })(),

            // 04. HISTÓRICO DE INTERAÇÕES E AÇÕES
            {
              stack: [
                {
                  table: {
                    widths: ['*'],
                    body: [
                      [{ text: '04. HISTÓRICO DE INTERAÇÕES E AÇÕES', style: 'sectionHeader' }]
                    ]
                  },
                  layout: 'noBorders',
                  margin: [0, 10, 0, 15]
                },
                {
                  table: {
                    headerRows: 1,
                    widths: ['25%', '40%', '18%', '17%'],
                    body: [
                      [
                        { text: 'RESPONSÁVEL', style: 'tableHeader' },
                        { text: 'DESCRIÇÃO DA AÇÃO', style: 'tableHeader' },
                        { text: 'STATUS', style: 'tableHeader' },
                        { text: 'CONCLUSÃO', style: 'tableHeader' }
                      ],
                      ...(actions.filter(a => a.projectId === selectedProjectId).length > 0 ? actions.filter(a => a.projectId === selectedProjectId).map(a => [
                        { text: a.responsibleName || '---', style: 'tableCell' },
                        { text: a.action || '---', style: 'tableCell' },
                        { 
                          text: (STATUS_MAP[a.status] || a.status).toUpperCase(), 
                          style: 'tableCell', 
                          bold: true, 
                          color: a.status === 'Concluído' ? '#059669' : a.status === 'Em andamento' ? '#d97706' : '#64748b' 
                        },
                        { text: a.completionDate || '---', style: 'tableCell' }
                      ]) : [
                        [{ text: 'Nenhuma interação ou ação registrada.', colSpan: 4, style: 'tableCell', italic: true }, {}, {}, {}]
                      ])
                    ]
                  },
                  layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#D3D3D3',
                    vLineColor: () => '#D3D3D3',
                    paddingLeft: () => 8,
                    paddingRight: () => 8,
                    paddingTop: () => 8,
                    paddingBottom: () => 8
                  }
                }
              ],
              pageBreak: 'before',
              unbreakable: true,
              margin: [0, 5, 0, 24]
            }
          ],
          styles: {
            mainTitle: { fontSize: 18, bold: true, color: '#003489' },
            metadataText: { fontSize: 9, bold: true, color: '#4b5563' },
            sectionHeader: {
              fontSize: 12,
              bold: true,
              color: '#FFFFFF',
              fillColor: '#003489',
              margin: [8, 4, 8, 4]
            },
            subSectionHeading: { 
              fontSize: 11, 
              bold: true, 
              color: '#003489', 
              fillColor: '#f1f5f9', 
              margin: [0, 5, 0, 5] 
            },
            fieldLabel: { fontSize: 8, bold: true, color: '#64748b' },
            bodyHighlight: { fontSize: 10, color: '#1e293b' },
            bodyText: { fontSize: 11, color: '#334155', lineHeight: 1.4 },
            bodyTextSmall: { fontSize: 9, color: '#4b5563', lineHeight: 1.4 },
            tableHeader: {
              fontSize: 9,
              bold: true,
              color: '#FFFFFF',
              fillColor: '#003489',
              alignment: 'center'
            },
            tableHeaderTiny: {
              fontSize: 7,
              bold: true,
              color: '#FFFFFF',
              fillColor: '#003489',
              alignment: 'center'
            },
            tableCell: { fontSize: 9, color: '#334155' },
            tableCellTiny: { fontSize: 7, color: '#334155', alignment: 'center' },
            footerText: { fontSize: 8, bold: true, color: '#64748b' }
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

          logUserActivity({
            userId: user.uid,
            userName: user.displayName || user.email || 'Usuário',
            userEmail: user.email || '',
            actionType: 'report_download',
            actionName: 'Geração de Relatório PDF',
            details: 'Gerou o Relatório Completo em PDF'
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
                      "PLAN - Descrição do Problema": cycle.plan.problemDescription,
                      "PLAN - Causa Raiz": getRootCausa(cycle),
                      "PLAN - Impacto - Descrição": cycle.plan.impact.description || '',
                      "PLAN - Impacto - Valor Atual": cycle.plan.impact.value ?? '',
                      "PLAN - Meta (%)": cycle.plan.impact.improvementPercentage ?? cycle.plan.impact.goal ?? '',
                      "PLAN - Impacto - Ganhos Esperados Tangíveis": formatExpectedTangibleGains(cycle.plan.impact.expectedGains),
                      "PLAN - Impacto - Ganhos Esperados Intangíveis": formatExpectedIntangibleGains(cycle.plan.impact.expectedGains),
                      "ODS": (project.scope?.odsSelecionadas && project.scope.odsSelecionadas.length > 0) ? project.scope.odsSelecionadas.join(', ') : '',
                      "ODS (Descrição)": project.scope?.odsDescricao || project.scope?.ods || '',
                      "ESG": (project.scope?.esgSelecionado && project.scope.esgSelecionado.length > 0) ? project.scope.esgSelecionado.join(', ') : '',
                      "ESG (Descrição)": project.scope?.esgDescricao || [
                        project.scope?.esgEnvironmental ? `E: ${project.scope.esgEnvironmental}` : '',
                        project.scope?.esgSocial ? `S: ${project.scope.esgSocial}` : '',
                        project.scope?.esgGovernance ? `G: ${project.scope.esgGovernance}` : ''
                      ].filter(Boolean).join(' | ') || '',
                      "Plano de ação - What (O que será feito)": action.what || '',
                      "Plano de ação - Why (Por que será feito)": action.why || '',
                      "Plano de ação - Where (Onde)": action.where || '',
                      "Plano de ação - When (Quando)": action.when || '',
                      "Plano de ação - Who (Responsável)": users.find(u => u.id === action.who)?.name || action.who || '',
                      "Plano de ação - How (Como será feito)": action.how || '',
                      "Plano de ação - How Much (Custo)": action.howMuch || '',
                      "Plano de ação - Tipo de Plano (Processual / Operacional / Inovação)": action.actionType || '',
                      "DO - Status": translateStatus(action.status),
                      "DO - Data de Início": formatCsvDate(action.startDate),
                      "DO - Data de Conclusão": formatCsvDate(action.endDate),
                      "CHECK - Modo Acompanhamento": action.monitoringMode || '',
                      "CHECK - Período": action.monitoringPeriod || '',
                      "CHECK - Observações do período de acompanhamento": action.monitoringTool || '',
                      "CHECK - Funcionou": action.worked || '',
                      "CHECK - Ganho real obtido": formatRealGainsStr(action.realGains),
                      "ACT - Status Final": action.finalProblemStatus || '',
                      "ACT - Ação Final": action.finalAction || '',
                      "ACT - Padronização": action.standardizationModels?.join(', ') || ''
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
      logFeature('Filtros avançados na exportação de relatórios gerenciais', 'Relatórios', '📄');

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
              <>
                <div className="space-y-3 md:col-span-1 animate-in fade-in slide-in-from-top-2 duration-300">
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

                <div className="space-y-3 md:col-span-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">3. Selecione o Colaborador (Opcional)</label>
                  <div className="relative">
                    <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={completeReportCollaboratorId}
                      onChange={(e) => setCompleteReportCollaboratorId(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm appearance-none"
                    >
                      <option value="">Todos os colaboradores</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-400 italic ml-1">Refine as subtarefas e ciclos PDCA do relatório sob a responsabilidade deste colaborador.</p>
                </div>
              </>
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
                
                const filteredSubtasks = (project.subtasks || []).filter(sub => !completeReportCollaboratorId || sub.responsibleId === completeReportCollaboratorId);
                
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
                        {filteredSubtasks && filteredSubtasks.length > 0 ? (
                          <div className="space-y-4">
                            {filteredSubtasks.map((sub, idx) => (
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
                        {(() => {
                          const uniqueReportCycles = Array.from(new Map((filteredSubtasks || []).flatMap(s => s.pdcaCycles || []).map(c => [c.id, c])).values());
                          if (uniqueReportCycles.length === 0) {
                            return <p className="text-sm text-slate-400 italic">Nenhum ciclo PDCA registrado para este projeto.</p>;
                          }
                          return uniqueReportCycles.map((cycle, cIdx) => (
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
                                        <p className="font-black text-emerald-600">{cycle.plan.impact.improvementPercentage ?? cycle.plan.impact.goal ?? 0}% de redução</p>
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
                                        <p className="font-bold text-slate-700 italic">" {formatGains(action.realGains) } "</p>
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
                          ));
                        })()}
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
                          <p className="text-3xl font-black text-indigo-600">{filteredSubtasks.length}</p>
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[2rem] space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ciclos Ativos</p>
                          <p className="text-3xl font-black text-amber-600">
                            {Array.from(new Map((filteredSubtasks || []).flatMap(s => s.pdcaCycles || []).map(c => [c.id, c])).values()).filter(c => c.status === 'Ativo').length}
                          </p>
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[2rem] space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concluídos</p>
                          <p className="text-3xl font-black text-emerald-600">
                            {Array.from(new Map((filteredSubtasks || []).flatMap(s => s.pdcaCycles || []).map(c => [c.id, c])).values()).filter(c => c.status === 'Concluído').length}
                          </p>
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
