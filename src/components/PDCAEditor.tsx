import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown,
  Users,
  Plus, 
  Trash2, 
  CheckCircle2, 
  Target, 
  FileText, 
  ArrowRight,
  TrendingUp,
  HelpCircle,
  Save,
  Search,
  Clock,
  Download,
  ExternalLink,
  GitBranch,
  Layers,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import html2pdf from 'html2pdf.js';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

import { Project, Subtask, PDCACycle, ParetoItem, ActionPlanItem, PDCAStatus, PDCAPriority, InnovationProject, ActionPlanType } from '../types';
import ParetoDiagram from './ParetoDiagram';
import { cn, isValidUrl, formatUrl, exportarCSVPadrao } from '../lib/utils';

const STATUS_MAP: Record<string, string> = {
  'pending': 'Pendente',
  'in_progress': 'Em andamento',
  'done': 'Concluído'
};


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

const translateStatus = (status: string) => STATUS_MAP[status] || status;

// Set up pdfMake fonts
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if ((pdfFonts as any).vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).vfs;
}

export default function PDCAEditor({ 
  project, 
  subtask, 
  onUpdateSubtask, 
  onBack, 
  defaultTaskId,
  onAddInnovationProject,
  onUpdateInnovationProject,
  innovationProjects = []
}: { 
  project: Project, 
  subtask: Subtask,
  onUpdateSubtask: (s: Subtask) => void,
  onBack: () => void,
  defaultTaskId?: string,
  onAddInnovationProject?: (data: any) => Promise<string>,
  onUpdateInnovationProject?: (id: string, updates: Partial<InnovationProject>) => Promise<void>,
  innovationProjects?: InnovationProject[]
}) {
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<'PLAN' | 'DO' | 'CHECK' | 'ACT' | 'REPORT'>('PLAN');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showProblemsModal, setShowProblemsModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showActConfirmation, setShowActConfirmation] = useState(false);

  const [confirmingLog, setConfirmingLog] = useState<{ id: string, updates: any, obsInputId: string } | null>(null);

  // Filter cycles if defaultTaskId is provided
  const cycles = useMemo(() => {
    if (defaultTaskId) {
      return subtask.pdcaCycles.filter(c => c.taskId === defaultTaskId);
    }
    return subtask.pdcaCycles;
  }, [subtask.pdcaCycles, defaultTaskId]);

  const activeCycle = subtask.pdcaCycles.find(c => c.id === activeCycleId);

  const isPlanPhaseValid = useMemo(() => {
    if (!activeCycle) return false;
    const { rootCauseAnalysis } = activeCycle.plan;
    if (rootCauseAnalysis.type === 'ishikawa') {
      return (rootCauseAnalysis.priorityCauses || []).length > 0;
    }
    return !!rootCauseAnalysis.identifiedRootCause?.trim();
  }, [activeCycle]);

  const isDoPhaseValid = useMemo(() => {
    if (!activeCycle || activeCycle.plan.actionPlan.length === 0) return false;
    return activeCycle.plan.actionPlan.every(item => {
      if (item.actionType === 'Inovação') {
        const innovationProject = innovationProjects.find(ip => ip.id === item.innovationProjectId);
        return innovationProject?.status === 'entregue';
      }
      return item.status === 'Concluído';
    });
  }, [activeCycle, innovationProjects]);

  const isCheckPhaseValid = useMemo(() => {
    if (!activeCycle || !isDoPhaseValid) return false;
    return activeCycle.plan.actionPlan.every(item => {
      const hasMonitoring = !!item.monitoringTool?.trim();
      const hasEvidence = !!item.evidence?.trim();
      const hasWorked = !!item.worked;
      const hasFailureReason = (item.worked === 'Sim' || !item.worked) || !!item.failureReason?.trim();
      
      return hasMonitoring && hasEvidence && hasWorked && hasFailureReason;
    });
  }, [activeCycle, isDoPhaseValid]);

  const isActPhaseValid = useMemo(() => {
    if (!activeCycle || !isCheckPhaseValid) return false;
    return activeCycle.plan.actionPlan.every(item => {
      const hasFinalStatus = !!item.finalProblemStatus;
      const hasFinalAction = !!item.finalAction;
      if (item.finalAction === 'Padronizar processo') {
        return hasFinalStatus && hasFinalAction && (item.standardizationModels || []).length > 0;
      }
      return hasFinalStatus && hasFinalAction;
    });
  }, [activeCycle, isCheckPhaseValid]);

  const cycleProgress = useMemo(() => {
    if (!activeCycle) return 0;
    let progress = 0;
    if (isPlanPhaseValid) progress += 25;
    if (isDoPhaseValid) progress += 25;
    if (isCheckPhaseValid) progress += 25;
    if (isActPhaseValid) progress += 25;
    return progress;
  }, [activeCycle, isPlanPhaseValid, isDoPhaseValid, isCheckPhaseValid, isActPhaseValid]);

  // Sync progress with subtask overall progress
  useEffect(() => {
    if (activeCycle) {
      const newCycles = subtask.pdcaCycles.map(c => 
        c.id === activeCycle.id ? { ...c, progress: cycleProgress } : c
      );
      
      // Calculate overall subtask progress
      // As per rule: "Se houver mais de uma subtarefa no card, deverá ser dividida para considerar o progresso total no kanban."
      // I assume this PDCAEditor is for a single subtask. I should update that subtask's progress.
      // If there are multiple cycles for the same taskId, we take the best one or average?
      // "Cards concluídos não estão chegando a 100%" implies we want the card progress to reflect PDCA completion.
      
      const totalPDCAProgress = newCycles.reduce((acc, c) => acc + (c.progress || 0), 0) / (newCycles.length || 1);
      
      if (subtask.progress !== Math.round(totalPDCAProgress)) {
        onUpdateSubtask({ 
          ...subtask, 
          pdcaCycles: newCycles,
          progress: Math.round(totalPDCAProgress),
          status: totalPDCAProgress === 100 ? 'Concluído' : totalPDCAProgress > 0 ? 'Em andamento' : 'Pendente'
        });
      }
    }
  }, [cycleProgress, activeCycle?.id]);

  const ishikawaDefaultCategories = useMemo(() => [
    { id: uuidv4(), name: 'Método' as const, description: 'Procedimentos, fluxos e formas de trabalho.', entries: [] },
    { id: uuidv4(), name: 'Máquina' as const, description: 'Equipamentos, ferramentas e tecnologia.', entries: [] },
    { id: uuidv4(), name: 'Mão de obra' as const, description: 'Pessoas, competências e treinamento.', entries: [] },
    { id: uuidv4(), name: 'Material' as const, description: 'Insumos, peças e qualidade da matéria-prima.', entries: [] },
    { id: uuidv4(), name: 'Meio ambiente' as const, description: 'Local de trabalho, clima e condições externas.', entries: [] },
    { id: uuidv4(), name: 'Medida' as const, description: 'Indicadores, métricas e calibração.', entries: [] },
  ], []);

  const allIshikawaCauses = useMemo(() => {
    if (activeCycle?.plan.rootCauseAnalysis.type !== 'ishikawa') return [];
    const categories = activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories;
    const causes = categories.flatMap(cat => cat.entries.map(e => e.text.trim())).filter(t => t !== '');
    return Array.from(new Set(causes));
  }, [activeCycle?.plan.rootCauseAnalysis.ishikawa, ishikawaDefaultCategories]);

  // Problems from Mapping
  const problemsFromMapping = useMemo(() => {
    const customData = subtask.mapping.customData || {};
    return Object.entries(customData)
      .filter(([id, data]) => {
        if (!data.isProblemStep) return false;
        // Check if task already has a cycle
        const hasCycle = subtask.pdcaCycles.some(c => c.taskId === id);
        // User requested: "Se o ciclo estiver concluído, a task NÃO deve aparecer novamente em Identificar Problemas"
        const hasFinishedCycle = subtask.pdcaCycles.some(c => c.taskId === id && c.status === 'Concluído');
        const hasActiveCycle = subtask.pdcaCycles.some(c => c.taskId === id && c.status === 'Ativo');
        
        // Only show if it doesn't have an active cycle and doesn't have a finished cycle
        // Rule: Only allow new cycle if there is explicit user action (the modal IS the explicit action here, 
        // but the rule says hide finished ones from Identify Problems)
        return !hasActiveCycle && !hasFinishedCycle;
      })
      .map(([id, data]) => ({
        id,
        label: data.description || 'Sem descrição',
        time: data.timeInMinutes || 0,
        role: data.responsibleRole || ''
      }));
  }, [subtask.mapping.customData, subtask.pdcaCycles]);

  const relatedCycles = useMemo(() => {
    if (!activeCycle) return [];
    return subtask.pdcaCycles
      .filter(c => c.taskId === activeCycle.taskId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [subtask.pdcaCycles, activeCycle?.taskId]);

  const isIshikawaValid = useMemo(() => {
    if (!activeCycle || activeCycle.plan.rootCauseAnalysis.type !== 'ishikawa') return true;
    const { priorityCauses } = activeCycle.plan.rootCauseAnalysis;
    return priorityCauses && priorityCauses.length > 0;
  }, [activeCycle]);

  const isInnovationBlocked = useMemo(() => {
    if (!activeCycle) return false;
    // We only block if there is AT LEAST ONE innovation action that is not 'entregue'
    const innovationActions = activeCycle.plan.actionPlan.filter(item => item.actionType === 'Inovação');
    if (innovationActions.length === 0) return false;
    
    return innovationActions.some(item => {
      const innovationProject = innovationProjects.find(ip => ip.id === item.innovationProjectId);
      return !innovationProject || innovationProject.status !== 'entregue';
    });
  }, [activeCycle, innovationProjects]);

  const handlePhaseChange = (newPhase: typeof activePhase) => {
    const phases: (typeof activePhase)[] = ['PLAN', 'DO', 'CHECK', 'ACT', 'REPORT'];
    const currentIdx = phases.indexOf(activePhase);
    const newIdx = phases.indexOf(newPhase);

    // Permite voltar a qualquer etapa anterior ou permanecer na mesma
    if (newIdx <= currentIdx) {
      setShowValidationErrors(false);
      setActivePhase(newPhase);
      return;
    }

    // Rules for blocking:
    // DO: Bloqueado até PLAN = concluído
    if (newPhase === 'DO' && !isPlanPhaseValid) {
      setShowValidationErrors(true);
      setSaveFeedback("Finalize a etapa PLAN para desbloquear o DO.");
      return;
    }

    // CHECK: Bloqueado até DO = concluído
    if (newPhase === 'CHECK' && !isDoPhaseValid) {
      setSaveFeedback("Finalize a etapa DO para desbloquear o CHECK.");
      return;
    }

    // ACT: Bloqueado até CHECK = concluído
    if (newPhase === 'ACT' && !isCheckPhaseValid) {
      setSaveFeedback("Finalize a etapa CHECK para desbloquear o ACT.");
      return;
    }

    if (newPhase === 'REPORT' && !isActPhaseValid && activeCycle?.status !== 'Concluído') {
      setSaveFeedback("Finalize o ciclo (ACT) para visualizar o relatório completo.");
      return;
    }

    setShowValidationErrors(false);
    setActivePhase(newPhase);
    // Update cycle's own phase state if it exists
    if (activeCycle) {
      updateCycle({ etapaAtual: newPhase });
    }
  };

  const createNewCycle = (taskId: string, taskLabel: string) => {
    // Check if any cycle already exists for this task to avoid automatic duplicates
    const existingActiveCycle = subtask.pdcaCycles.find(c => c.taskId === taskId && c.status === 'Ativo');
    if (existingActiveCycle) {
      setActiveCycleId(existingActiveCycle.id);
      setActivePhase(existingActiveCycle.etapaAtual || 'PLAN');
      setShowDashboard(false);
      setShowProblemsModal(false);
      setSaveFeedback('Já existe um ciclo ativo para esta etapa.');
      return;
    }

    const existingFinishedCycle = subtask.pdcaCycles.find(c => c.taskId === taskId && c.status === 'Concluído');
    if (existingFinishedCycle && !confirm('Já existe um ciclo concluído para esta etapa. Deseja iniciar um NOVO ciclo de melhoria?')) {
      return;
    }
    
    const cycleCount = subtask.pdcaCycles.filter(c => c.taskId === taskId).length;
    const newCycle: PDCACycle = {
      id: uuidv4(),
      taskId,
      title: cycleCount > 0 ? `Ciclo PDCA ${cycleCount + 1} - ${taskLabel}` : `Ciclo PDCA - ${taskLabel}`,
      createdAt: new Date().toISOString(),
      status: 'Ativo',
      etapaAtual: 'PLAN',
      plan: {
        problemDescription: taskLabel,
        rootCauseAnalysis: {
          type: '5whys',
          entries: [
            { id: uuidv4(), text: '' },
            { id: uuidv4(), text: '' },
            { id: uuidv4(), text: '' },
            { id: uuidv4(), text: '' },
            { id: uuidv4(), text: '' }
          ]
        },
        impact: {
          description: '',
          value: 0,
          goal: 0
        },
        actionPlan: []
      }
    };

    onUpdateSubtask({ ...subtask, pdcaCycles: [newCycle, ...subtask.pdcaCycles] });
    setActiveCycleId(newCycle.id);
    setActivePhase('PLAN');
    setShowDashboard(false);
    setShowProblemsModal(false);
  };

  const updateCycle = (newData: Partial<PDCACycle>) => {
    if (!activeCycleId) return;
    const newCycles = subtask.pdcaCycles.map(c => c.id === activeCycleId ? { ...c, ...newData } : c);
    onUpdateSubtask({ ...subtask, pdcaCycles: newCycles });
  };

  const handleSave = () => {
    setSaveFeedback('Dados salvos com sucesso!');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const exportToCSV = () => {
    if (relatedCycles.length === 0) return;
    
    const headers = [
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

    const rows: any[][] = [];

    relatedCycles.forEach((cycle) => {
      cycle.plan.actionPlan.forEach((item) => {
        rows.push([
          cycle.id,
          cycle.title,
          cycle.plan.problemDescription,
          cycle.plan.rootCauseAnalysis.identifiedRootCause || '',
          cycle.plan.impact.description,
          cycle.plan.impact.value || '',
          cycle.plan.impact.goal || '',
          item.what,
          item.who,
          item.sector || '',
          translateStatus(item.status),
          item.startDate ? format(new Date(item.startDate), 'dd/MM/yyyy') : 'N/A',
          item.endDate ? format(new Date(item.endDate), 'dd/MM/yyyy') : 'N/A',
          item.monitoringMode || '',
          item.monitoringPeriod || '',
          item.monitoringTool || '',
          item.worked || '',
          item.evidence || '',
          item.gainImpact || '0',
          item.finalProblemStatus || '',
          item.finalAction || '',
          (item.standardizationModels || []).join('; ')
        ]);
      });
    });

    const fileName = `Relatorio_PDCA_${activeCycle?.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    exportarCSVPadrao(headers, rows, fileName);
  };

  const normalizeColors = (element: HTMLElement) => {
    // Force a temporary class for PDF specific overrides
    element.classList.add('pdf-mode');
    
    const all = element.querySelectorAll("*");
    all.forEach(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      
      // Extensive list of properties to check
      ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'].forEach(prop => {
        const val = (style as any)[prop];
        if (val && (val.includes("oklab") || val.includes("oklch"))) {
          // Robust fallback strategy
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

  const PDFHeader = ({ projectName, cycleTitle }: { projectName: string, cycleTitle?: string }) => (
    <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">FP</div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-indigo-600 tracking-wider">GESTÃO PRO</span>
          <span className="text-[8px] text-slate-400 font-bold uppercase">PDCA Expert Analysis</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[300px]">{projectName}</p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{cycleTitle || 'Relatório PDCA'}</p>
      </div>
    </div>
  );

  const exportToPDF = async () => {
    if (!activeCycle) return;
    setIsExportingPDF(true);
    
    try {
      const logoBase64 = await svgToPngBase64(SYSTEM_LOGO_SVG);
      
      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [40, 80, 40, 60],
        header: (currentPage: number, pageCount: number) => {
          if (currentPage === 1) return null; // Primeira página é a capa
          return {
            margin: [40, 20, 40, 0],
            stack: [
              {
                image: logoBase64,
                fit: [120, 40],
                alignment: 'left',
                margin: [0, 0, 0, 5]
              },
              {
                columns: [
                  {
                    width: '*',
                    stack: [
                      { text: 'RELATÓRIO TÉCNICO PDCA', style: 'headerLabel' },
                      { text: activeCycle.title.toUpperCase(), style: 'headerValue' }
                    ]
                  },
                  {
                    width: 'auto',
                    stack: [
                      { text: 'EMISSÃO', style: 'headerLabel', alignment: 'right' },
                      { text: format(new Date(), "dd/MM/yyyy"), style: 'headerValue', alignment: 'right' }
                    ]
                  }
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
                image: logoBase64,
                fit: [100, 30],
                alignment: 'center',
                margin: [0, 5, 0, 5]
              },
              {
                columns: [
                  { width: '*', text: `FLOWPROCESS - Melhoria Contínua`, style: 'footerText' },
                  { width: 'auto', text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', style: 'footerText' }
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
                text: activeCycle.title.toUpperCase(),
                style: 'capaTitle',
                alignment: 'center',
                margin: [0, 10, 0, 60]
              },
              {
                columns: [
                  {
                    width: '*',
                    stack: [
                      { text: 'PROJETO MÃE', style: 'label' },
                      { text: project.name.toUpperCase(), style: 'capaValue' },
                      { text: 'ETAPA VINCULADA', style: 'label', margin: [0, 20, 0, 2] },
                      { text: subtask.title.toUpperCase(), style: 'capaValue' }
                    ]
                  },
                  {
                    width: '*',
                    stack: [
                      { text: 'RESPONSÁVEL', style: 'label' },
                      { text: project.assignedTo || '---', style: 'capaValue' },
                      { text: 'STATUS DO CICLO', style: 'label', margin: [0, 20, 0, 2] },
                      { 
                        text: activeCycle.status === 'Concluído' ? 'FINALIZADO' : 'EM ANDAMENTO', 
                        style: 'capaValue', 
                        color: activeCycle.status === 'Concluído' ? '#059669' : '#003489' 
                      }
                    ]
                  }
                ],
                margin: [40, 0, 40, 0]
              }
            ],
            pageBreak: 'after'
          },
          // RESUMO EXECUTIVO
          { text: '01. RESUMO EXECUTIVO', style: 'sectionHeading' },
          {
            canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: SYSTEM_LOGO_PRIMARY_COLOR }],
            margin: [0, 0, 0, 20]
          },
          {
            columns: [
              {
                width: '60%',
                stack: [
                  { text: 'DEFINIÇÃO DO PROBLEMA', style: 'label' },
                  { text: activeCycle.plan.problemDescription, style: 'bodyText', margin: [0, 0, 0, 15] },
                  { text: 'CAUSA RAIZ PRIORITÁRIA', style: 'label' },
                  { text: activeCycle.plan.rootCauseAnalysis.identifiedRootCause || 'Pendente de análise profunda', style: 'bodyText', bold: true, color: '#e11d48' }
                ]
              },
              {
                width: '40%',
                stack: [
                  {
                    canvas: [{ type: 'rect', x: 0, y: 0, w: 180, h: 90, r: 10, color: '#f8fafc', lineColor: '#e2e8f0' }]
                  },
                  {
                    stack: [
                      { text: 'INDICADOR DE IMPACTO', style: 'label', margin: [15, -80, 0, 2] },
                      { text: activeCycle.plan.impact.description || 'Não definido', style: 'value', margin: [15, 0, 0, 10] },
                      { text: 'META DE MELHORIA', style: 'label', margin: [15, 0, 0, 2] },
                      { text: `${activeCycle.plan.impact.goal}% de redução`, style: 'bodyText', margin: [15, 0, 0, 0], bold: true, color: '#059669' }
                    ]
                  }
                ]
              }
            ],
            margin: [0, 0, 0, 30]
          },
          // ANALISES
          { text: '02. ANÁLISES E DIAGNÓSTICO', style: 'sectionHeading' },
          {
            canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: SYSTEM_LOGO_PRIMARY_COLOR }],
            margin: [0, 0, 0, 20]
          },
          {
            stack: [
              ...(activeCycle.plan.rootCauseAnalysis.type === '5whys' ? [
                { text: 'MÉTODO APLICADO: 5 PORQUÊS (5 WHYS)', style: 'stepHeading', color: SYSTEM_LOGO_PRIMARY_COLOR, margin: [0, 0, 0, 10] },
                {
                  table: {
                    widths: ['20%', '80%'],
                    body: [
                      ...activeCycle.plan.rootCauseAnalysis.entries.map((e, i) => [
                        { text: `${i + 1}º PORQUÊ`, style: 'tableHeaderSmall', alignment: 'center' },
                        { text: e.text, style: 'bodyTextSmall' }
                      ])
                    ]
                  },
                  layout: 'lightHorizontalLines',
                  margin: [0, 0, 0, 20]
                }
              ] : activeCycle.plan.rootCauseAnalysis.type === 'ishikawa' && activeCycle.plan.rootCauseAnalysis.ishikawa ? [
                { text: 'MÉTODO APLICADO: DIAGRAMA DE ISHIKAWA (6M)', style: 'stepHeading', color: SYSTEM_LOGO_PRIMARY_COLOR, margin: [0, 0, 0, 10] },
                {
                  table: {
                    widths: ['30%', '70%'],
                    body: [
                      [{ text: 'CATEGORIA', style: 'tableHeader' }, { text: 'CAUSAS IDENTIFICADAS', style: 'tableHeader' }],
                      ...activeCycle.plan.rootCauseAnalysis.ishikawa.map(cat => [
                        { text: cat.name, style: 'tableCell', bold: true },
                        { text: cat.entries.map(e => e.text).join(', ') || 'Sem causas registradas', style: 'tableCell' }
                      ])
                    ]
                  },
                  layout: 'lightHorizontalLines',
                  margin: [0, 0, 0, 20]
                }
              ] : [
                { text: 'Nenhuma ferramenta de análise de causa raiz foi detalhada para este ciclo.', style: 'bodyText', italic: true, margin: [0, 0, 0, 20] }
              ])
            ]
          },
          // PDCA
          { text: '03. DETALHAMENTO DO CICLO PDCA (5W2H)', style: 'sectionHeading' },
          {
            canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: SYSTEM_LOGO_PRIMARY_COLOR }],
            margin: [0, 0, 0, 20]
          },
          {
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
                ...(activeCycle.plan.actionPlan || []).map(action => [
                  { text: action.what, style: 'tableCellTiny' },
                  { text: action.why, style: 'tableCellTiny' },
                  { text: action.where, style: 'tableCellTiny' },
                  { text: action.when, style: 'tableCellTiny' },
                  { text: action.who, style: 'tableCellTiny' },
                  { text: action.how, style: 'tableCellTiny' },
                  { text: action.howMuch, style: 'tableCellTiny' }
                ])
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 20]
          },
          {
            columns: [
              {
                width: '50%',
                stack: [
                  { text: 'DO - EXECUÇÃO', style: 'stepHeading', color: '#d97706', margin: [0, 10, 0, 5] },
                  { text: 'Evidências/Resultados:', style: 'labelTiny' },
                  { text: activeCycle.plan.actionPlan?.[0]?.evidence || 'Pendente de verificação final.', style: 'bodyTextSmall' }
                ],
                margin: [0, 0, 10, 0]
              },
              {
                width: '50%',
                stack: [
                  { text: 'CHECK - VERIFICAÇÃO', style: 'stepHeading', color: '#059669', margin: [0, 10, 0, 5] },
                  { text: 'O Plano Funcionou?', style: 'labelTiny' },
                  { text: activeCycle.plan.actionPlan?.[0]?.worked || 'Aguardando encerramento.', style: 'bodyTextSmall' }
                ],
                margin: [10, 0, 0, 0]
              }
            ],
            margin: [0, 0, 0, 20]
          },
          {
            stack: [
              { text: 'ACT - AGIR / PADRONIZAÇÃO', style: 'stepHeading', color: '#e11d48', margin: [0, 10, 0, 5] },
              { text: 'Conclusão e Padronização:', style: 'labelTiny' },
              { text: activeCycle.plan.actionPlan?.[0]?.finalAction || 'Ciclo ainda em fase de execução.', style: 'bodyTextSmall' },
              { text: 'Modelos adotados:', style: 'labelTiny', margin: [0, 5, 0, 0] },
              { text: activeCycle.plan.actionPlan?.[0]?.standardizationModels?.join(', ') || 'Nenhum modelo aplicado.', style: 'bodyTextSmall' }
            ]
          }
        ],
        styles: {
          headerLabel: { fontSize: 7, bold: true, color: '#94a3b8', letterSpacing: 1 },
          headerValue: { fontSize: 10, bold: true, color: '#1e293b' },
          capaTitle: { fontSize: 32, bold: true, color: '#0f172a' },
          capaSubtitle: { fontSize: 10, bold: true, color: '#4f46e9', letterSpacing: 4 },
          capaValue: { fontSize: 14, bold: true, color: '#1e293b' },
          sectionHeading: { fontSize: 18, bold: true, color: SYSTEM_LOGO_PRIMARY_COLOR, margin: [0, 10, 0, 5] },
          stepHeading: { fontSize: 11, bold: true, margin: [0, 5, 0, 5] },
          label: { fontSize: 8, bold: true, color: '#94a3b8', margin: [0, 0, 0, 2] },
          labelTiny: { fontSize: 7, bold: true, color: '#94a3b8' },
          value: { fontSize: 12, bold: true, color: '#1e293b' },
          bodyText: { fontSize: 11, color: '#334155', lineHeight: 1.4 },
          bodyTextSmall: { fontSize: 9, color: '#475569', lineHeight: 1.3 },
          tableHeader: { fontSize: 10, bold: true, color: '#64748b', fillColor: '#f8fafc' },
          tableHeaderSmall: { fontSize: 8, bold: true, color: '#0f172a', fillColor: '#f1f5f9' },
          tableCell: { fontSize: 9, color: '#475569', margin: [0, 5, 0, 5] },
          tableCellTiny: { fontSize: 7, color: '#44546a' },
          footerText: { fontSize: 8, color: '#94a3b8' }
        },
        defaultStyle: {
          font: 'Roboto'
        }
      };

      pdfMake.createPdf(docDefinition).download(`PDCA_${activeCycle.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setSaveFeedback("PDF gerado com sucesso!");
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setSaveFeedback("Erro na geração do PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const updatePlan = (newPlan: any) => {
    if (!activeCycle) return;
    updateCycle({ plan: { ...activeCycle.plan, ...newPlan } });
  };

  const dashboardStats = useMemo(() => {
    const total = cycles.length;
    const resolved = cycles.filter(c => c.status === 'Concluído').length;
    const inProgress = cycles.filter(c => c.status === 'Ativo').length;
    
    return { total, resolved, inProgress };
  }, [cycles]);

  if (showDashboard) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
              <ChevronRight size={24} className="rotate-180" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <RefreshCw size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Dashboard PDCA</h3>
                <p className="text-sm text-slate-400 font-medium">Melhoria Contínua Integrada</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowProblemsModal(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Search size={20} />
            Identificar Problemas
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Total de Problemas" value={dashboardStats.total} icon={<AlertCircle />} color="indigo" />
            <StatCard title="Em Andamento" value={dashboardStats.inProgress} icon={<Clock />} color="amber" />
            <StatCard title="Resolvidos" value={dashboardStats.resolved} icon={<CheckCircle2 />} color="emerald" />
          </div>

          {/* Cycles List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Acompanhamento de Ciclos</h4>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-1.5 text-indigo-600">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  Ativos
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  Concluídos
                </div>
              </div>
            </div>
            {cycles.length === 0 ? (
              <div className="py-20 bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
                <Target size={48} className="mb-4 opacity-20" />
                <p className="font-bold">Nenhum ciclo PDCA iniciado</p>
                <p className="text-sm">Clique em "Identificar Problemas" para começar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cycles.map(cycle => (
                  <div 
                    key={cycle.id}
                    onClick={() => {
                      setActiveCycleId(cycle.id);
                      setActivePhase(cycle.etapaAtual || 'PLAN');
                      setShowDashboard(false);
                    }}
                    className={cn(
                      "bg-white p-6 rounded-2xl border transition-all cursor-pointer group shadow-sm",
                      cycle.status === 'Concluído' ? "border-slate-100 opacity-75 grayscale-[0.5]" : "border-slate-200 hover:border-indigo-300"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className={cn(
                          "font-bold transition-colors",
                          cycle.status === 'Concluído' ? "text-slate-500" : "text-slate-800 group-hover:text-indigo-600"
                        )}>{cycle.title}</h5>
                        <p className="text-xs text-slate-400 mt-1">Iniciado em {format(new Date(cycle.createdAt), 'dd/MM/yyyy')}</p>
                      </div>
                      <StatusBadge status={cycle.status} />
                    </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Progresso</span>
                          <span>{getProgress(cycle.status, cycle)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-500" 
                            style={{ width: `${getProgress(cycle.status, cycle)}%` }}
                          />
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Problems Modal */}
        <AnimatePresence>
          {showProblemsModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800">Identificar Problemas do Fluxo</h3>
                  <button onClick={() => setShowProblemsModal(false)} className="text-slate-400 hover:text-slate-600">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                  {problemsFromMapping.length === 0 ? (
                    <div className="py-12 text-center space-y-4">
                      <AlertCircle size={48} className="mx-auto text-slate-200" />
                      <p className="text-slate-500 font-medium">Nenhuma "Etapa Problema" identificada no mapeamento.</p>
                      <p className="text-xs text-slate-400">Marque as etapas críticas no fluxograma para que elas apareçam aqui.</p>
                    </div>
                  ) : (
                    problemsFromMapping.map(p => {
                      const hasActiveCycle = subtask.pdcaCycles.some(c => c.taskId === p.id && c.status === 'Ativo');
                      const completedCycles = subtask.pdcaCycles.filter(c => c.taskId === p.id && c.status === 'Concluído');
                      const isCompleted = completedCycles.length > 0 && !hasActiveCycle;

                      return (
                        <div 
                          key={p.id}
                          className={cn(
                            "p-4 border rounded-2xl flex items-center justify-between group transition-all",
                            hasActiveCycle ? "bg-indigo-50 border-indigo-200" : 
                            isCompleted ? "bg-slate-50 border-slate-200 opacity-80" : "bg-slate-50 border-slate-200 hover:border-indigo-300"
                          )}
                        >
                          <div>
                            <p className="font-bold text-slate-800">{p.label}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-black bg-[#FF6B6B] text-white px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                <AlertCircle size={10} /> Problema
                              </span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full" />
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                <Clock size={10} /> {p.time} min
                              </span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.role}</span>
                              {hasActiveCycle && (
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                                  <RefreshCw size={10} className="animate-spin-slow" /> Ciclo Ativo
                                </span>
                              )}
                              {isCompleted && !hasActiveCycle && (
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Histórico Concluído
                                </span>
                              )}
                            </div>
                          </div>
                          {!hasActiveCycle && (
                            <button 
                              onClick={() => createNewCycle(p.id, p.label)}
                              className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm border border-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                            >
                              {isCompleted ? 'Iniciar Novo Ciclo' : 'Iniciar PDCA'}
                            </button>
                          )}
                          {hasActiveCycle && (
                            <button 
                              onClick={() => {
                                const activeCycle = subtask.pdcaCycles.find(c => c.taskId === p.id && c.status === 'Ativo');
                                if (activeCycle) {
                                  setActiveCycleId(activeCycle.id);
                                  setActivePhase(activeCycle.etapaAtual || 'PLAN');
                                  setShowDashboard(false);
                                  setShowProblemsModal(false);
                                }
                              }}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-indigo-700 transition-all"
                            >
                              Ver Ciclo
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowDashboard(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ChevronRight size={24} className="rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <RefreshCw size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 truncate max-w-[300px]">{activeCycle?.title}</h3>
              <div className="flex items-center gap-2">
                <StatusBadge status={activeCycle?.status || 'Ativo'} />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {activeCycle && format(new Date(activeCycle.createdAt), 'dd/MM/yyyy')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveFeedback && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 size={16} />
              {saveFeedback}
            </motion.div>
          )}
          <select 
            value={activeCycle?.status}
            onChange={(e) => updateCycle({ status: e.target.value as any })}
            className="bg-slate-100 border-none text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Ativo">Ativo</option>
            <option value="Concluído">Concluído</option>
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeCycle ? (
          <>
            {/* Phase Tabs */}
            <div className="bg-white border-b border-slate-200 px-8 flex gap-8">
              <PhaseTab active={activePhase === 'PLAN'} onClick={() => handlePhaseChange('PLAN')} label="PLAN (P)" color="indigo" />
              <PhaseTab 
                active={activePhase === 'DO'} 
                onClick={() => handlePhaseChange('DO')} 
                label="DO (D)" 
                color="amber" 
                disabled={!isPlanPhaseValid}
                icon={!isPlanPhaseValid ? <Lock size={12} /> : undefined}
                lockTooltip={!isPlanPhaseValid ? "Finalize a etapa PLAN para desbloquear" : undefined}
              />
              <PhaseTab 
                active={activePhase === 'CHECK'} 
                onClick={() => handlePhaseChange('CHECK')} 
                label="CHECK (C)" 
                color="emerald" 
                disabled={!isDoPhaseValid}
                icon={!isDoPhaseValid ? <Lock size={12} /> : undefined}
                lockTooltip={!isDoPhaseValid ? "Finalize a etapa DO para desbloquear" : undefined}
              />
              <PhaseTab 
                active={activePhase === 'ACT'} 
                onClick={() => handlePhaseChange('ACT')} 
                label="ACT (A)" 
                color="rose" 
                disabled={!isCheckPhaseValid}
                icon={!isCheckPhaseValid ? <Lock size={12} /> : undefined}
                lockTooltip={!isCheckPhaseValid ? "Finalize a etapa CHECK para desbloquear" : undefined}
              />
              <PhaseTab 
                active={activePhase === 'REPORT'} 
                onClick={() => handlePhaseChange('REPORT')} 
                label="RELATÓRIO PDCA" 
                color="slate" 
              />
            </div>

            {/* Phase Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <AnimatePresence mode="wait">
                {activePhase === 'PLAN' && (
                  <motion.div 
                    key="plan"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-5xl mx-auto space-y-12"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                      <div className="lg:col-span-2 space-y-12">
                        {/* 1. Descrição */}
                        <section className="space-y-4">
                          <SectionHeader number="1" title="Descrição do Problema" />
                          <textarea 
                            placeholder="Descreva o problema de forma clara..."
                            value={activeCycle.plan.problemDescription || ''}
                            onChange={(e) => updatePlan({ problemDescription: e.target.value })}
                            className="w-full p-6 bg-white border border-slate-200 rounded-3xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[120px] text-slate-700 font-medium shadow-sm"
                          />
                        </section>
                        
                        {/* 2. Causa Raiz */}
                        <section className="space-y-6">
                          <div className="flex items-center justify-between">
                            <SectionHeader number="2" title="Análise de Causa Raiz" />
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                              <button 
                                onClick={() => updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, type: '5whys' } })}
                                className={cn(
                                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  activeCycle.plan.rootCauseAnalysis.type === '5whys' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                                )}
                              >
                                5 Porquês
                              </button>
                              <button 
                                onClick={() => updatePlan({ 
                                  rootCauseAnalysis: { 
                                    ...activeCycle.plan.rootCauseAnalysis, 
                                    type: 'ishikawa',
                                    ishikawa: activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories
                                  } 
                                })}
                                className={cn(
                                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  activeCycle.plan.rootCauseAnalysis.type === 'ishikawa' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                                )}
                              >
                                Ishikawa
                              </button>
                              <button 
                                onClick={() => updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, type: 'list' } })}
                                className={cn(
                                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  activeCycle.plan.rootCauseAnalysis.type === 'list' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                                )}
                              >
                                Lista de Causas
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {activeCycle.plan.rootCauseAnalysis.type === 'ishikawa' ? (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories).map((cat, catIdx) => (
                                  <div key={cat.id} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 min-w-0">
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                      <div className="min-w-0 flex-1">
                                        <h5 className="font-black text-slate-800 text-xs uppercase tracking-widest truncate">{cat.name}</h5>
                                        <p className="text-[10px] text-slate-400 font-medium truncate">{cat.description}</p>
                                      </div>
                                      <button 
                                        disabled={(cat.entries?.length || 0) >= 3}
                                        onClick={() => {
                                          const currentIshikawa = activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories;
                                          const newIshikawa = currentIshikawa.map((c, i) => {
                                            if (i === catIdx) {
                                              return {
                                                ...c,
                                                entries: [...(c.entries || []), { id: uuidv4(), text: '' }]
                                              };
                                            }
                                            return c;
                                          });
                                          updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, ishikawa: newIshikawa } });
                                        }}
                                        className={cn(
                                          "p-2 rounded-lg transition-all",
                                          (cat.entries?.length || 0) >= 3 
                                            ? "bg-slate-100 text-slate-300 cursor-not-allowed" 
                                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                                        )}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                    <div className="space-y-2">
                                      {cat.entries.map((entry, entryIdx) => (
                                        <div key={entry.id} className="flex gap-2">
                                          <div className="flex-1 min-w-0 flex gap-2">
                                            <input 
                                              type="text"
                                              placeholder="Descreva a causa..."
                                              value={entry.text || ''}
                                              onChange={(e) => {
                                                const currentIshikawa = activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories;
                                                const newIshikawa = [...currentIshikawa];
                                                const newEntries = [...newIshikawa[catIdx].entries];
                                                newEntries[entryIdx] = { ...newEntries[entryIdx], text: e.target.value };
                                                newIshikawa[catIdx] = { ...newIshikawa[catIdx], entries: newEntries };
                                                updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, ishikawa: newIshikawa } });
                                              }}
                                              className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                                            />
                                            <button 
                                              onClick={() => {
                                                const currentIshikawa = activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories;
                                                const newIshikawa = [...currentIshikawa];
                                                newIshikawa[catIdx] = {
                                                  ...newIshikawa[catIdx],
                                                  entries: newIshikawa[catIdx].entries.filter((_, i) => i !== entryIdx)
                                                };
                                                updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, ishikawa: newIshikawa } });
                                              }}
                                              className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {activeCycle.plan.rootCauseAnalysis.type === 'ishikawa' && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: 20 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="mt-8 bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                                          <Target size={24} />
                                        </div>
                                        <div>
                                          <h4 className="text-lg font-black tracking-tight">Causas Prioritárias</h4>
                                          <p className="text-slate-400 text-xs font-medium">Selecione até 3 causas principais para focar no plano de ação.</p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {allIshikawaCauses.length === 0 ? (
                                          <p className="text-slate-500 text-xs italic">Preencha as causas no diagrama acima para priorizar.</p>
                                        ) : (
                                          allIshikawaCauses.map(cause => {
                                            const isSelected = (activeCycle.plan.rootCauseAnalysis.priorityCauses || []).includes(cause);
                                            return (
                                              <button
                                                key={cause}
                                                onClick={() => {
                                                  const current = activeCycle.plan.rootCauseAnalysis.priorityCauses || [];
                                                  if (isSelected) {
                                                    updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, priorityCauses: current.filter(c => c !== cause) } });
                                                  } else if (current.length < 3) {
                                                    updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, priorityCauses: [...current, cause] } });
                                                  }
                                                }}
                                                className={cn(
                                                  "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                                                  isSelected 
                                                    ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/20" 
                                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                                                )}
                                              >
                                                <div className={cn(
                                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                                  isSelected ? "border-white bg-white text-indigo-600" : "border-slate-600"
                                                )}>
                                                  {isSelected && <CheckCircle2 size={12} />}
                                                </div>
                                                <span className="text-xs font-bold">{cause}</span>
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                      
                                      {(activeCycle.plan.rootCauseAnalysis.priorityCauses || []).length > 0 && (
                                        <div className="pt-4 border-t border-slate-800">
                                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Causas Selecionadas ({activeCycle.plan.rootCauseAnalysis.priorityCauses?.length}/3)</p>
                                          <div className="flex flex-wrap gap-2">
                                            {activeCycle.plan.rootCauseAnalysis.priorityCauses?.map(cause => (
                                              <span key={cause} className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {cause}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                  {activeCycle.plan.rootCauseAnalysis.type === 'ishikawa' && (!activeCycle.plan.rootCauseAnalysis.priorityCauses || activeCycle.plan.rootCauseAnalysis.priorityCauses.length === 0) && showValidationErrors && (
                                    <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 animate-pulse">
                                      <AlertCircle size={20} />
                                      <p className="text-xs font-black uppercase tracking-widest">Selecione as causas prioritárias para avançar</p>
                                    </div>
                                  )}
                                </>
                              ) : activeCycle.plan.rootCauseAnalysis.entries.map((entry, idx) => (
                              <div key={entry.id} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shadow-sm shrink-0">
                                  {activeCycle.plan.rootCauseAnalysis.type === '5whys' ? idx + 1 : <AlertCircle size={16} />}
                                </div>
                                <div className="flex-1 min-w-0 flex gap-2">
                                  <input 
                                    type="text" 
                                    placeholder={activeCycle.plan.rootCauseAnalysis.type === '5whys' ? `Por quê ${idx + 1}?` : "Descreva a causa..."}
                                    value={entry.text || ''}
                                    onChange={(e) => {
                                      const newEntries = [...activeCycle.plan.rootCauseAnalysis.entries];
                                      newEntries[idx].text = e.target.value;
                                      updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, entries: newEntries } });
                                    }}
                                    className="flex-1 min-w-0 p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm"
                                  />
                                  {activeCycle.plan.rootCauseAnalysis.type === 'list' && (
                                    <button 
                                      onClick={() => {
                                        const newEntries = activeCycle.plan.rootCauseAnalysis.entries.filter((_, i) => i !== idx);
                                        updatePlan({ rootCauseAnalysis: { ...activeCycle.plan.rootCauseAnalysis, entries: newEntries } });
                                      }}
                                      className="p-4 text-slate-300 hover:text-rose-500 transition-colors"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                              
                              {/* Root Cause Conclusion for 5 Whys and List */}
                              {(activeCycle.plan.rootCauseAnalysis.type === '5whys' || activeCycle.plan.rootCauseAnalysis.type === 'list') && (
                                <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
                                  <div className="flex items-center gap-2 text-indigo-600">
                                    <Target size={18} />
                                    <h5 className="font-black text-xs uppercase tracking-widest">Causa raiz identificada</h5>
                                  </div>
                                  <textarea 
                                    placeholder="Descreva aqui a causa raiz final identificada após a análise..."
                                    value={activeCycle.plan.rootCauseAnalysis.identifiedRootCause || ''}
                                    onChange={(e) => updatePlan({ 
                                      rootCauseAnalysis: { 
                                        ...activeCycle.plan.rootCauseAnalysis, 
                                        identifiedRootCause: e.target.value 
                                      } 
                                    })}
                                    className={cn(
                                      "w-full p-4 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm min-h-[100px] transition-all",
                                      showValidationErrors && !activeCycle.plan.rootCauseAnalysis.identifiedRootCause?.trim() 
                                        ? "border-rose-300 bg-rose-50/30" 
                                        : "border-indigo-100"
                                    )}
                                  />
                                  <p className="text-[10px] text-indigo-400 font-bold italic">* Campo obrigatório para conclusão do PLAN</p>
                                  {!activeCycle.plan.rootCauseAnalysis.identifiedRootCause && (
                                    <div className="flex items-center gap-1.5 text-rose-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                      <AlertCircle size={12} />
                                      Atenção: Identifique a causa raiz para prosseguir
                                    </div>
                                  )}
                                </div>
                              )}

                              {activeCycle.plan.rootCauseAnalysis.type === 'list' && (
                              <button 
                                onClick={() => {
                                  updatePlan({ 
                                    rootCauseAnalysis: { 
                                      ...activeCycle.plan.rootCauseAnalysis, 
                                      entries: [...activeCycle.plan.rootCauseAnalysis.entries, { id: uuidv4(), text: '' }] 
                                    } 
                                  });
                                }}
                                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                              >
                                <Plus size={16} />
                                Adicionar Causa
                              </button>
                            )}
                          </div>
                        </section>

                        {/* 4. Plano de Ação (5W2H) */}
                        <section className="space-y-6">
                          <SectionHeader number="4" title="Plano de Ação (5W2H)" />
                          <div className="space-y-6">
                            {activeCycle.plan.actionPlan.map((item, index) => (
                              <div key={item.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6 relative group transition-all hover:shadow-md">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
                                      {index + 1}
                                    </div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação #{index + 1}</h5>
                                  </div>
                                  <button 
                                    onClick={() => removeActionPlanItem(item.id)}
                                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                    title="Remover Ação"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tipo do Plano de Ação (OBRIGATÓRIO)</label>
                                    <select 
                                      value={item.actionType || ''} 
                                      onChange={(e) => updateActionPlan(item.id, { actionType: e.target.value as any })}
                                      className={cn(
                                        "w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all",
                                        !item.actionType ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-100 text-slate-700"
                                      )}
                                    >
                                      <option value="">Selecione o tipo...</option>
                                      <option value="Processual">Processual</option>
                                      <option value="Operacional">Operacional</option>
                                      <option value="Inovação">Inovação</option>
                                    </select>
                                  </div>

                                  {item.actionType === 'Inovação' && (
                                    <motion.div 
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-3 rounded-xl border border-emerald-100 h-[46px]"
                                    >
                                      <GitBranch size={16} className="shrink-0" />
                                      <span className="text-[10px] font-black uppercase tracking-widest italic">Encaminhado para Inovação</span>
                                    </motion.div>
                                  )}
                                </div>

                                {/* 5W2H Section - Hidden until type is selected */}
                                {item.actionType ? (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-6 pt-6 border-t border-slate-100 overflow-hidden"
                                  >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">What (O que será feito?)</label>
                                        <input 
                                          value={item.what || ''} 
                                          placeholder="O que será feito?"
                                          onChange={(e) => updateActionPlan(item.id, { what: e.target.value })}
                                          className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Why (Por que será feito?)</label>
                                        <input 
                                          value={item.why || ''} 
                                          placeholder="Por que essa ação é necessária?"
                                          onChange={(e) => updateActionPlan(item.id, { why: e.target.value })}
                                          className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Where (Onde?)</label>
                                        <input 
                                          value={item.where || ''} 
                                          placeholder="Onde será executada?"
                                          onChange={(e) => updateActionPlan(item.id, { where: e.target.value })}
                                          className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">When (Quando?)</label>
                                          <input 
                                            type="date"
                                            value={item.when || ''} 
                                            onChange={(e) => updateActionPlan(item.id, { when: e.target.value })}
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Who (Quem)</label>
                                          <input 
                                            value={item.who || ''} 
                                            placeholder="Nome do responsável"
                                            onChange={(e) => updateActionPlan(item.id, { who: e.target.value })}
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">How (Como será feito?)</label>
                                        <input 
                                          value={item.how || ''} 
                                          placeholder="Como será executada?"
                                          onChange={(e) => updateActionPlan(item.id, { how: e.target.value })}
                                          className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">How much (Custo)</label>
                                          <input 
                                            value={item.howMuch || ''} 
                                            placeholder="Qual o custo?"
                                            onChange={(e) => updateActionPlan(item.id, { howMuch: e.target.value })}
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Setor</label>
                                          <input 
                                            value={item.sector || ''} 
                                            placeholder="Setor responsável"
                                            onChange={(e) => updateActionPlan(item.id, { sector: e.target.value })}
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                ) : (
                                  <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 text-center">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                      Defina o Tipo do Plano acima para liberar o preenchimento do 5W2H
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}

                            <button 
                              onClick={addActionPlanItem}
                              className="w-full py-8 border-2 border-dashed border-indigo-100 rounded-[2.5rem] font-black text-xs uppercase tracking-widest text-indigo-400 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={20} />
                              Nova Ação no Plano
                            </button>
                          </div>
                        </section>
                      </div>

                      <div className="space-y-8">
                        {/* 3. Impacto do Problema */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                          <SectionHeader number="3" title="Impacto" />
                          
                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Target size={14} className="text-indigo-500" />
                              Descrição do Impacto
                            </label>
                            <textarea 
                              placeholder="Qual o prejuízo atual?"
                              value={activeCycle.plan.impact.description || ''}
                              onChange={(e) => updatePlan({ impact: { ...activeCycle.plan.impact, description: e.target.value } })}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 min-h-[100px]"
                            />
                          </div>

                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <RefreshCw size={14} className="text-amber-500" />
                              Valor do Impacto Atual
                            </label>
                            <input 
                              type="number"
                              placeholder="Ex: 5000"
                              value={activeCycle.plan.impact.value || 0}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updatePlan({ impact: { ...activeCycle.plan.impact, value: parseFloat(e.target.value) || 0 } })}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                            />
                          </div>

                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <TrendingUp size={14} className="text-emerald-500" />
                              Meta de Melhoria (%)
                            </label>
                            <div className="relative">
                              <input 
                                type="number"
                                placeholder="Ex: 20"
                                value={activeCycle.plan.impact.goal || 0}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updatePlan({ impact: { ...activeCycle.plan.impact, goal: parseFloat(e.target.value) || 0 } })}
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 pr-12"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-8 border-t border-slate-200">
                        <button 
                          onClick={() => handlePhaseChange('DO')}
                          className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all group"
                        >
                          Próxima Etapa: DO (Execução)
                          <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
                                {activePhase === 'DO' && (
                  <motion.div 
                    key="do" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">Execução e Histórico</h4>
                        <p className="text-slate-500 text-sm mt-1">Registre cada atualização das ações planejadas.</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {activeCycle.plan.actionPlan.length === 0 ? (
                          <div className="p-20 text-center text-slate-400 italic">
                            Nenhuma ação planejada (PLAN).
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan
                            .map((item) => {
                              const isExpanded = expandedActionId === item.id;
                              
                              const idx = activeCycle.plan.actionPlan.findIndex(i => i.id === item.id);
                            
                            return (
                              <div key={item.id} className={cn(
                                "border-b border-slate-100 last:border-0 transition-all",
                                isExpanded ? "bg-white" : "hover:bg-slate-50/50"
                              )}>
                                {/* Accordion Header */}
                                <button 
                                  onClick={() => setExpandedActionId(isExpanded ? null : item.id)}
                                  className="w-full p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left group"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <span className={cn(
                                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 shadow-sm",
                                      isExpanded ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                                    )}>
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <h5 className="font-bold text-slate-800 text-lg truncate group-hover:text-indigo-600 transition-colors">
                                        {item.what || 'Ação sem descrição'}
                                      </h5>
                                      <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                          <Users size={12} className="text-slate-400" />
                                          <span className="text-slate-600 font-black">{item.who}</span>
                                        </p>
                                        {item.when && (
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <Clock size={12} className="text-slate-400" />
                                            <span>{format(new Date(item.when), 'dd/MM/yyyy')}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-6">
                                    <div className="hidden sm:block">
                                      {item.actionType === 'Inovação' ? (
                                        (() => {
                                          const innovationProject = innovationProjects.find(ip => ip.id === item.innovationProjectId);
                                          const statusLabel = innovationProject ? innovationProject.status : 'Pendente';
                                          return (
                                            <div className="flex flex-col items-end">
                                              <span className={cn(
                                                "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                                                statusLabel === 'entregue' ? "bg-emerald-100 text-emerald-700" :
                                                statusLabel === 'backlog' ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                                              )}>
                                                {statusLabel === 'entregue' ? 'Concluído' : statusLabel === 'backlog' ? 'Pendente' : 'Em andamento'}
                                              </span>
                                              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter mt-1 italic">Vínculo: Inovação</span>
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <span className={cn(
                                          "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                                          item.status === 'Concluído' ? "bg-emerald-100 text-emerald-700" :
                                          item.status === 'Em andamento' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                                        )}>
                                          {item.status}
                                        </span>
                                      )}
                                    </div>
                                    <div className={cn(
                                      "w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 transition-transform duration-300 group-hover:border-indigo-200 group-hover:text-indigo-500",
                                      isExpanded && "rotate-180 bg-indigo-50 border-indigo-200 text-indigo-600"
                                    )}>
                                      <ChevronDown size={18} />
                                    </div>
                                  </div>
                                </button>

                                {/* Accordion Content */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-8 pb-8 space-y-8 animate-in fade-in slide-in-from-top-1 duration-300">
                                        {/* History Log */}
                                        <div className="space-y-4 pt-4 border-t border-slate-50">
                                          {(item.actionType || 'Processual') !== 'Inovação' && (
                                            <>
                                              <div className="flex items-center justify-between">
                                                <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                  <Clock size={14} />
                                                  Histórico de Atualizações
                                                </h6>
                                                <span className="text-[10px] font-black text-slate-300">
                                                  {(item.executionLogs || []).length} registros
                                                </span>
                                              </div>
                                              
                                              <div className="space-y-3">
                                                {(item.executionLogs || []).length === 0 ? (
                                                  <div className="py-8 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2">
                                                    <AlertCircle size={24} className="opacity-20" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest">Sem movimentações registradas</p>
                                                  </div>
                                                ) : (
                                                  [...(item.executionLogs || [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((log) => (
                                                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4 hover:border-slate-200 transition-colors">
                                                      <div className={cn(
                                                        "w-2 h-2 rounded-full mt-2 shrink-0 shadow-sm",
                                                        log.status === 'Concluído' ? "bg-emerald-500" :
                                                        log.status === 'Em andamento' ? "bg-amber-500" : "bg-slate-300"
                                                      )} />
                                                      <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{log.status}</span>
                                                          <span className="text-[10px] text-slate-400 font-medium">{format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{log.observation}</p>
                                                        <div className="mt-3 flex items-center gap-2">
                                                          <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500 font-bold flex items-center gap-1">
                                                            <Users size={10} />
                                                            {log.responsible}
                                                          </span>
                                                          {log.sector && (
                                                            <span className="text-[10px] bg-indigo-50 px-2.5 py-1 rounded-lg text-indigo-600 font-bold">
                                                              {log.sector}
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))
                                                )}
                                              </div>
                                            </>
                                          )}

                                          {/* Innovation Logs (Automatic) */}
                                          {(item.actionType || 'Processual') === 'Inovação' && (
                                            <div className="space-y-4">
                                              <div className="flex items-center justify-between">
                                                <h6 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                                  <Target size={14} />
                                                  Histórico da Execução (Inovação)
                                                </h6>
                                                <span className="text-[10px] font-black text-indigo-300">
                                                  {(item.innovationLogs || []).length} registros automáticos
                                                </span>
                                              </div>
                                              
                                              <div className="space-y-3">
                                                {(item.innovationLogs || []).length === 0 ? (
                                                  <div className="py-8 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-100 flex flex-col items-center justify-center text-indigo-400 gap-2">
                                                    <GitBranch size={24} className="opacity-20" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest">Aguardando início pela Inovação</p>
                                                  </div>
                                                ) : (
                                                  [...(item.innovationLogs || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((log) => (
                                                    <div key={log.id} className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 flex items-start gap-4">
                                                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                                      <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                          <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.previousStatus || 'Início'}</span>
                                                            <ArrowRight size={10} className="text-slate-300" />
                                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{log.newStatus}</span>
                                                          </div>
                                                          <span className="text-[10px] text-slate-400 font-medium">{format(new Date(log.date), 'dd/MM/yyyy HH:mm')}</span>
                                                        </div>
                                                        <div className="mt-2 flex items-center gap-2">
                                                          <span className="text-[10px] bg-white px-2.5 py-1 rounded-lg text-indigo-500 font-bold border border-indigo-100 flex items-center gap-1">
                                                            <Users size={10} />
                                                            {log.responsible}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {/* Add Log Form */}
                                          <div className="mt-8">
                                            {item.actionType === 'Inovação' ? (
                                              <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex flex-col items-center justify-center text-center space-y-3">
                                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                                                  <GitBranch size={24} />
                                                </div>
                                                <div>
                                                  <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">Execução Gerenciada pela Inovação</p>
                                                  <p className="text-xs text-indigo-600 font-medium mt-1">Este status é atualizado automaticamente via Pipeline de Inovação.</p>
                                                </div>
                                              </div>
                                            ) : item.status !== 'Concluído' ? (
                                              <div className="bg-slate-900 p-6 rounded-[2rem] text-white space-y-6 shadow-xl shadow-slate-200">
                                                <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                                                    <Plus size={18} />
                                                  </div>
                                                  <h6 className="text-[10px] font-black uppercase tracking-widest">Nova Atualização</h6>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                  <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novo Status</label>
                                                    <select 
                                                      id={`status-${item.id}`}
                                                      className="w-full bg-slate-800 border-none px-4 py-3 rounded-xl text-xs font-bold outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                                    >
                                                      <option value="Pendente" className="bg-slate-900">Pendente</option>
                                                      <option value="Em andamento" className="bg-slate-900">Em andamento</option>
                                                      <option value="Concluído" className="bg-slate-900">Concluído</option>
                                                    </select>
                                                  </div>
                                                  <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setor</label>
                                                    <input 
                                                      id={`sector-${item.id}`}
                                                      type="text"
                                                      placeholder="Setor do responsável"
                                                      className="w-full bg-slate-800 border-none px-4 py-3 rounded-xl text-xs font-bold outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observação</label>
                                                    <input 
                                                      id={`obs-${item.id}`}
                                                      type="text"
                                                      placeholder="O que foi feito nesta etapa?"
                                                      className="w-full bg-slate-800 border-none px-4 py-3 rounded-xl text-xs font-bold outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                                                    />
                                                  </div>
                                                </div>
                                                <div className="flex justify-end pr-1">
                                                  <button 
                                                    onClick={() => {
                                                      const statusSelect = document.getElementById(`status-${item.id}`) as HTMLSelectElement;
                                                      const sectorInput = document.getElementById(`sector-${item.id}`) as HTMLInputElement;
                                                      const obsInput = document.getElementById(`obs-${item.id}`) as HTMLInputElement;
                                                      
                                                      if (!obsInput.value) return;

                                                      if (statusSelect.value === 'Concluído') {
                                                        const updates: any = { 
                                                          executionLogs: [...(item.executionLogs || []), {
                                                            id: uuidv4(),
                                                            timestamp: new Date().toISOString(),
                                                            status: 'Concluído' as any,
                                                            responsible: item.who,
                                                            sector: sectorInput.value,
                                                            observation: obsInput.value,
                                                            type: 'completion'
                                                          }],
                                                          status: 'Concluído' as any,
                                                          endDate: new Date().toISOString()
                                                        };

                                                        if (!item.startDate) {
                                                          updates.startDate = new Date().toISOString();
                                                        }
                                                        
                                                        setConfirmingLog({ id: item.id, updates, obsInputId: `obs-${item.id}` });
                                                        return;
                                                      }

                                                      const newLog = {
                                                        id: uuidv4(),
                                                        timestamp: new Date().toISOString(),
                                                        status: statusSelect.value as any,
                                                        responsible: item.who,
                                                        sector: sectorInput.value,
                                                        observation: obsInput.value,
                                                        type: statusSelect.value === 'Concluído' ? 'completion' : 'update'
                                                      };

                                                      const newLogs = [...(item.executionLogs || []), newLog];
                                                      const updates: any = { 
                                                        executionLogs: newLogs,
                                                        status: statusSelect.value as any
                                                      };

                                                      if (statusSelect.value === 'Em andamento' && !item.startDate) {
                                                        updates.startDate = new Date().toISOString();
                                                      }

                                                      updateActionPlan(item.id, updates);
                                                      obsInput.value = '';
                                                    }}
                                                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
                                                  >
                                                    Registrar Atualização
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-sm">
                                                  <CheckCircle2 size={32} />
                                                </div>
                                                <div className="flex-1">
                                                  <h6 className="text-sm font-black text-emerald-900 uppercase tracking-widest mb-1">Ação Concluída com Sucesso!</h6>
                                                  <p className="text-xs text-emerald-600 font-medium">Todos os registros para este plano de ação foram finalizados. Verifique agora os resultados na etapa <strong>CHECK</strong>.</p>
                                                </div>
                                                <button 
                                                  onClick={() => handlePhaseChange('CHECK')}
                                                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shrink-0"
                                                >
                                                  Verificar Resultados <ChevronRight size={14} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePhase === 'CHECK' && (
                  <motion.div 
                    key="check" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">Verificação de Resultados</h4>
                        <p className="text-slate-500 text-sm mt-1">Acompanhamento e validação de cada ação.</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {activeCycle.plan.actionPlan.length === 0 ? (
                          <div className="p-20 text-center text-slate-400 italic">
                            Nenhuma ação para verificação (CHECK).
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan
                            .map((item) => {
                              const isExpanded = expandedActionId === item.id;
                              
                              const idx = activeCycle.plan.actionPlan.findIndex(i => i.id === item.id);
                            
                            return (
                              <div key={item.id} className={cn(
                                "border-b border-slate-100 last:border-0 transition-all",
                                isExpanded ? "bg-white" : "hover:bg-slate-50/50"
                              )}>
                                {/* Accordion Header */}
                                <button 
                                  onClick={() => setExpandedActionId(isExpanded ? null : item.id)}
                                  className="w-full p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left group"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <span className={cn(
                                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 shadow-sm",
                                      isExpanded ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                                    )}>
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <h5 className="font-bold text-slate-800 text-lg truncate group-hover:text-indigo-600 transition-colors">
                                        {item.what || 'Ação sem descrição'}
                                      </h5>
                                      <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                          <TrendingUp size={12} className="text-slate-400" />
                                          Modo: <span className="text-slate-600 font-black">{item.monitoringMode || 'Dias'}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                          <Target size={12} className="text-slate-400" />
                                          Período: <span className="text-slate-600 font-black">{item.monitoringPeriod || 0}</span>
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-6">
                                    <div className="hidden sm:block">
                                      <span className={cn(
                                        "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                                        item.worked === 'Sim' ? "bg-emerald-100 text-emerald-700" :
                                        item.worked === 'Não' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                      )}>
                                        Funcionou? {item.worked || 'Pendente'}
                                      </span>
                                    </div>
                                    <div className={cn(
                                      "w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 transition-transform duration-300 group-hover:border-indigo-200 group-hover:text-indigo-500",
                                      isExpanded && "rotate-180 bg-indigo-50 border-indigo-200 text-indigo-600"
                                    )}>
                                      <ChevronDown size={18} />
                                    </div>
                                  </div>
                                </button>

                                {/* Accordion Content */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-8 pb-8 space-y-8 animate-in fade-in slide-in-from-top-1 duration-300 pt-4 border-t border-slate-50">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          {/* Linha 1 */}
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Modo de Acompanhamento</label>
                                            <select 
                                              value={item.monitoringMode || 'Dias'}
                                              onChange={(e) => updateActionPlan(item.id, { monitoringMode: e.target.value as any })}
                                              className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            >
                                              <option value="Dias">Dias</option>
                                              <option value="Semanas">Semanas</option>
                                              <option value="Meses">Meses</option>
                                            </select>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Período</label>
                                            <input 
                                              type="number"
                                              value={item.monitoringPeriod || 0}
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => updateActionPlan(item.id, { monitoringPeriod: parseInt(e.target.value) || 0 })}
                                              className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            />
                                          </div>

                                          {/* Linha 2 */}
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Como está sendo feito o acompanhamento?</label>
                                            <input 
                                              type="text"
                                              value={item.monitoringTool || ''}
                                              onChange={(e) => updateActionPlan(item.id, { monitoringTool: e.target.value })}
                                              placeholder="Ex: Power BI, Excel, E-mail, WhatsApp..."
                                              className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Link evidência do acompanhamento</label>
                                            <div className="space-y-2">
                                              <input 
                                                type="text"
                                                value={item.evidence || ''}
                                                onChange={(e) => updateActionPlan(item.id, { evidence: e.target.value })}
                                                placeholder="Link das evidências..."
                                                className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                              />
                                              {item.evidence && isValidUrl(item.evidence) && (
                                                <a 
                                                  href={formatUrl(item.evidence)} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors ml-1"
                                                >
                                                  <ExternalLink size={14} />
                                                  Abrir link
                                                </a>
                                              )}
                                            </div>
                                          </div>

                                          {/* Linha 3 */}
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Funcionou?</label>
                                            <select 
                                              value={item.worked || 'Sim'}
                                              onChange={(e) => updateActionPlan(item.id, { worked: e.target.value as any })}
                                              className={cn(
                                                "w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all",
                                                item.worked === 'Sim' ? "bg-emerald-100 text-emerald-700" :
                                                item.worked === 'Não' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                              )}
                                            >
                                              <option value="Sim">Sim</option>
                                              <option value="Não">Não</option>
                                              <option value="Parcial">Parcial</option>
                                            </select>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Impacto de ganho</label>
                                            <input 
                                              type="number"
                                              value={item.gainImpact || 0}
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => updateActionPlan(item.id, { gainImpact: parseFloat(e.target.value) || 0 })}
                                              placeholder="Impacto financeiro ou de tempo"
                                              className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            />
                                          </div>

                                          {/* Campo Condicional: Motivo */}
                                          {(item.worked === 'Não' || item.worked === 'Parcial') && (
                                            <div className="md:col-span-2 space-y-1 block animate-in slide-in-from-top-2 duration-300">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
                                                Motivo <span className="text-rose-500 font-bold">(Obrigatório)</span>
                                              </label>
                                              <textarea 
                                                value={item.failureReason || ''}
                                                onChange={(e) => updateActionPlan(item.id, { failureReason: e.target.value })}
                                                placeholder={item.worked === 'Não' ? "Descreva detalhadamente por que a ação não funcionou..." : "Descreva por que a ação funcionou apenas parcialmente..."}
                                                className={cn(
                                                  "w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px] resize-none",
                                                  showValidationErrors && !item.failureReason && "ring-2 ring-rose-500 bg-rose-50"
                                                )}
                                              />
                                            </div>
                                          )}
                                        </div>

                                        {item.worked === 'Sim' && (
                                          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4 animate-in zoom-in-95 duration-300">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                                              <CheckCircle2 size={24} />
                                            </div>
                                            <div>
                                              <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Resultado Positivo!</p>
                                              <p className="text-[10px] text-emerald-600 font-medium leading-tight">A ação foi eficaz. Siga para a etapa <strong>ACT</strong> para padronizar este novo processo.</p>
                                            </div>
                                          </div>
                                        )}

                                        {/* Botão Avançar para ACT Individual */}
                                        <div className="flex justify-end pt-4 border-t border-slate-100">
                                          {(() => {
                                            const isItemValid = !!item.monitoringTool?.trim() && 
                                                              !!item.evidence?.trim() && 
                                                              !!item.worked && 
                                                              (item.worked === 'Sim' || !!item.failureReason?.trim());
                                            return (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (!isItemValid) {
                                                    setSaveFeedback("Preencha todos os campos obrigatórios (Verificação, Evidência e Resultado) antes de avançar.");
                                                    setShowValidationErrors(true);
                                                    return;
                                                  }
                                                  
                                                  const newActionPlan = [...activeCycle.plan.actionPlan];
                                                  const itemIdx = newActionPlan.findIndex(i => i.id === item.id);
                                                  if (itemIdx !== -1) {
                                                    newActionPlan[itemIdx] = { ...newActionPlan[itemIdx], currentPhase: 'ACT' };
                                                    updateCycle({ 
                                                      plan: { ...activeCycle.plan, actionPlan: newActionPlan },
                                                      etapaAtual: 'ACT'
                                                    });
                                                    setActivePhase('ACT');
                                                  }
                                                }}
                                                className={cn(
                                                  "flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg",
                                                  isItemValid 
                                                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100" 
                                                    : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                                                )}
                                              >
                                                Avançar para ACT
                                                <ArrowRight size={14} />
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePhase === 'ACT' && (
                  <motion.div 
                    key="act" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">Ação de Melhoria Contínua</h4>
                        <p className="text-slate-500 text-sm mt-1">Padronização ou novos ajustes para cada ação.</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {activeCycle.plan.actionPlan.length === 0 ? (
                          <div className="p-20 text-center text-slate-400 italic">
                            Nenhuma ação para agir (ACT).
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan
                            .map((item) => {
                              const isExpanded = expandedActionId === item.id;
                              
                              const idx = activeCycle.plan.actionPlan.findIndex(i => i.id === item.id);
                            
                            return (
                              <div key={item.id} className={cn(
                                "border-b border-slate-100 last:border-0 transition-all",
                                isExpanded ? "bg-white" : "hover:bg-slate-50/50"
                              )}>
                                {/* Accordion Header */}
                                <button 
                                  onClick={() => setExpandedActionId(isExpanded ? null : item.id)}
                                  className="w-full p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left group"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <span className={cn(
                                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 shadow-sm",
                                      isExpanded ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                                    )}>
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <h5 className="font-bold text-slate-800 text-lg truncate group-hover:text-indigo-600 transition-colors">
                                        {item.what || 'Ação sem descrição'}
                                      </h5>
                                      <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                          <CheckCircle2 size={12} className="text-slate-400" />
                                          Status Final: <span className="text-slate-600 font-black">{item.finalProblemStatus || 'Resolvido'}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                          <Target size={12} className="text-slate-400" />
                                          Ação Final: <span className="text-slate-600 font-black">{item.finalAction || 'Padronizar'}</span>
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 transition-transform duration-300 group-hover:border-indigo-200 group-hover:text-indigo-500",
                                      isExpanded && "rotate-180 bg-indigo-50 border-indigo-200 text-indigo-600"
                                    )}>
                                      <ChevronDown size={18} />
                                    </div>
                                  </div>
                                </button>

                                {/* Accordion Content */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-8 pb-8 space-y-8 animate-in fade-in slide-in-from-top-1 duration-300 pt-4 border-t border-slate-50">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                          <div className="space-y-4">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Status Final do Problema</label>
                                              <select 
                                                value={item.finalProblemStatus || 'Resolvido'}
                                                onChange={(e) => updateActionPlan(item.id, { finalProblemStatus: e.target.value as any })}
                                                className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                              >
                                                <option value="Resolvido">Resolvido</option>
                                                <option value="Não resolvido">Não resolvido</option>
                                              </select>
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ação Final</label>
                                              <select 
                                                value={item.finalAction || 'Padronizar processo'}
                                                onChange={(e) => updateActionPlan(item.id, { finalAction: e.target.value as any })}
                                                className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                              >
                                                <option value="Padronizar processo">Padronizar processo</option>
                                                <option value="Fazer nova análise">Fazer nova análise</option>
                                              </select>
                                            </div>
                                          </div>

                                          <div className="space-y-4">
                                            {item.finalAction === 'Padronizar processo' && (
                                              <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Modelo de Padronização Sugerido</label>
                                                <div className="flex flex-wrap gap-2">
                                                  {['POP', 'ITO', 'Painel de controle'].map(model => (
                                                    <button 
                                                      key={model}
                                                      onClick={() => {
                                                        const current = item.standardizationModels || [];
                                                        const next = current.includes(model as any)
                                                          ? current.filter(m => m !== model)
                                                          : [...current, model as any];
                                                        updateActionPlan(item.id, { standardizationModels: next });
                                                      }}
                                                      className={cn(
                                                        "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                        item.standardizationModels?.includes(model as any)
                                                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg"
                                                          : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300"
                                                      )}
                                                    >
                                                      {model}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {item.finalProblemStatus === 'Não resolvido' && item.finalAction === 'Fazer nova análise' && (
                                              <div className="pt-2">
                                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3 mb-4">
                                                  <AlertCircle size={20} className="text-amber-500 shrink-0" />
                                                  <p className="text-[10px] text-amber-700 font-medium leading-tight">O problema persiste. Recomendamos iniciar um novo ciclo PDCA para aprofundar a análise.</p>
                                                </div>
                                                <button 
                                                  onClick={() => {
                                                    createNewCycle(activeCycle.taskId, activeCycle.plan.problemDescription);
                                                  }}
                                                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                                                >
                                                  <RefreshCw size={18} />
                                                  Refazer Ciclo PDCA
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Finalize Cycle Button */}
                      {activeCycle.status === 'Ativo' && (
                        <div className="pt-12 border-t border-slate-200">
                          <div className={cn(
                            "p-8 rounded-[2.5rem] bg-white border-2 border-dashed transition-all flex flex-col items-center text-center gap-6",
                            isActPhaseValid ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 opacity-60"
                          )}>
                            <div className={cn(
                              "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                              isActPhaseValid ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"
                            )}>
                              <CheckCircle2 size={32} />
                            </div>
                            <div className="max-w-md">
                              <h4 className="text-xl font-black text-slate-800 tracking-tight">Finalizar Ciclo PDCA</h4>
                              <p className="text-slate-500 text-sm mt-2">
                                {isActPhaseValid 
                                  ? "Todas as informações foram preenchidas. Você já pode concluir este ciclo e visualizar o relatório final."
                                  : "Preencha todas as informações da fase de ACT (Padronização ou Reanálise) para concluir o ciclo."}
                              </p>
                            </div>
                            <button 
                              onClick={() => {
                                updateCycle({ status: 'Concluído' });
                                setSaveFeedback("Ciclo PDCA concluído com sucesso! 🚀");
                                setActivePhase('REPORT');
                              }}
                              disabled={!isActPhaseValid}
                              className={cn(
                                "px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl",
                                isActPhaseValid 
                                  ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100 active:scale-95" 
                                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              )}
                            >
                              Concluir Ciclo e Gerar Relatório
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activePhase === 'REPORT' && (
                  <motion.div 
                    key="report" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="flex justify-between items-center no-print">
                      <div>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight">Relatório PDCA</h4>
                        <p className="text-slate-500 text-sm mt-1">Resumo executivo do ciclo de melhoria.</p>
                      </div>
                                  <div className="flex items-center gap-4">
                                    <button 
                                      onClick={exportToCSV}
                                      className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                    >
                                      <Download size={20} />
                                      Exportar CSV
                                    </button>
                                    <button 
                                      onClick={exportToPDF}
                                      disabled={isExportingPDF}
                                      className={cn(
                                        "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg",
                                        isExportingPDF 
                                          ? "bg-slate-400 text-white cursor-not-allowed" 
                                          : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                                      )}
                                    >
                                      {isExportingPDF ? (
                                        <>
                                          <RefreshCw size={20} className="animate-spin" />
                                          Gerando...
                                        </>
                                      ) : (
                                        <>
                                          <FileText size={20} />
                                          Exportar PDF
                                        </>
                                      )}
                                    </button>
                                  </div>
                    </div>

                    <div id="pdca-report-content" className="space-y-12 pb-12 print-container bg-white p-8 rounded-[2.5rem]">
                      {relatedCycles.map((cycle, cycleIdx) => (
                        <div key={cycle.id} className="space-y-8 border-b-4 border-slate-100 pb-12 last:border-0 last:pb-0 min-h-[260mm]">
                          <PDFHeader projectName={project.name} cycleTitle={cycle.title} />
                          <div className="flex items-center gap-4 bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-900/20">
                              {cycleIdx + 1}
                            </div>
                            <div>
                              <h5 className="text-xl font-black tracking-tight uppercase">Ciclo {cycleIdx + 1}</h5>
                              <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">
                                {cycleIdx === 0 ? 'Primeira Tentativa' : 'Reanálise de Melhoria'} • Iniciado em {format(new Date(cycle.createdAt), 'dd/MM/yyyy')}
                              </p>
                            </div>
                          </div>

                          {/* PLAN */}
                          <ReportSection title="PLAN (Planejar)" color="indigo">
                            <ReportField label="Descrição do Problema" value={cycle.plan?.problemDescription} />
                            <ReportField label="Causa Raiz Identificada" value={cycle.plan?.rootCauseAnalysis?.identifiedRootCause || 'Não informada'} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <ReportField label="Impacto: Descrição" value={cycle.plan?.impact?.description} />
                              <ReportField label="Impacto: Valor Atual" value={`R$ ${cycle.plan?.impact?.value || 0}`} />
                              <ReportField label="Impacto: Meta (%)" value={`${cycle.plan?.impact?.goal || 0}%`} />
                            </div>
                            <ReportField label="Método Utilizado" value={cycle.plan?.rootCauseAnalysis?.type?.toUpperCase() || 'N/A'} />
                            
                            <div className="mt-6 pt-6 border-t border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Plano de Ação (5W2H)</p>
                              <div className="space-y-4">
                                {(cycle.plan?.actionPlan || []).map((item) => (
                                  <div key={item.id} className="grid grid-cols-2 md:grid-cols-6 gap-4 text-[10px] p-3 bg-slate-50 rounded-xl">
                                    <div><p className="font-black text-slate-400 uppercase">O que</p><p className="font-bold text-slate-700">{item.what}</p></div>
                                    <div><p className="font-black text-slate-400 uppercase">Por que</p><p className="font-bold text-slate-700">{item.why}</p></div>
                                    <div><p className="font-black text-slate-400 uppercase">Onde</p><p className="font-bold text-slate-700">{item.where}</p></div>
                                    <div><p className="font-black text-slate-400 uppercase">Quando</p><p className="font-bold text-slate-700">{item.when}</p></div>
                                    <div><p className="font-black text-slate-400 uppercase">Quem</p><p className="font-bold text-slate-700">{item.who}</p></div>
                                    <div><p className="font-black text-slate-400 uppercase">Como</p><p className="font-bold text-slate-700">{item.how}</p></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </ReportSection>

                          {/* DO */}
                          <ReportSection title="DO (Executar)" color="amber">
                            <div className="space-y-4">
                              {(cycle.plan?.actionPlan || []).map((item, idx) => (
                                <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <p className="font-bold text-slate-800">{idx + 1}. {item.what}</p>
                                    <StatusBadge status={item.status as any} />
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px]">
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Responsável</p>
                                      <p className="font-bold text-slate-600">{item.who}</p>
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Setor</p>
                                      <p className="font-bold text-slate-600">{item.sector || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Início</p>
                                      <p className="font-bold text-slate-600">{item.startDate ? format(new Date(item.startDate), 'dd/MM/yyyy') : 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Conclusão</p>
                                      <p className="font-bold text-slate-600">{item.endDate ? format(new Date(item.endDate), 'dd/MM/yyyy') : 'N/A'}</p>
                                    </div>
                                  </div>
                                  {item.executionLogs.length > 0 && (
                                    <div className="pt-2 border-t border-slate-200">
                                      <p className="font-black text-slate-400 uppercase text-[8px] mb-1">Última Atualização</p>
                                      <p className="text-[10px] text-slate-500 italic">"{item.executionLogs[item.executionLogs.length - 1].observation}"</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ReportSection>

                          {/* CHECK */}
                          <ReportSection title="CHECK (Verificar)" color="emerald">
                            <div className="space-y-4">
                              {(cycle.plan?.actionPlan || []).map((item, idx) => (
                                <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                  <p className="font-bold text-slate-800">{idx + 1}. {item.what}</p>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px]">
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Acompanhamento</p>
                                      <p className="font-bold text-slate-600">{item.monitoringPeriod} {item.monitoringMode} via {item.monitoringTool}</p>
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Funcionou?</p>
                                      <p className={cn("font-bold", item.worked === 'Sim' ? "text-emerald-600" : "text-rose-600")}>{item.worked}</p>
                                    </div>
                                    {(item.worked === 'Não' || item.worked === 'Parcial') && (
                                      <div className="col-span-2">
                                        <p className="font-black text-slate-400 uppercase">Motivo</p>
                                        <p className="font-bold text-slate-600">{item.failureReason || 'N/A'}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Impacto de Ganho</p>
                                      <p className="font-bold text-emerald-600">R$ {item.gainImpact || 0}</p>
                                    </div>
                                  </div>
                                  <ReportField label="Link evidência do acompanhamento" value={item.evidence || 'N/A'} />
                                </div>
                              ))}
                            </div>
                          </ReportSection>

                          {/* ACT */}
                          <ReportSection title="ACT (Agir)" color="rose">
                            <div className="space-y-4">
                              {(cycle.plan?.actionPlan || []).map((item, idx) => (
                                <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                  <p className="font-bold text-slate-800">{idx + 1}. {item.what}</p>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px]">
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Status Final</p>
                                      <p className={cn("font-bold", item.finalProblemStatus === 'Resolvido' ? "text-emerald-600" : "text-rose-600")}>{item.finalProblemStatus}</p>
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Ação Final</p>
                                      <p className="font-bold text-slate-600">{item.finalAction}</p>
                                    </div>
                                    {item.finalAction === 'Padronizar processo' && (
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">Padronização</p>
                                        <p className="font-bold text-indigo-600">{(item.standardizationModels || []).join(', ')}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ReportSection>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw size={64} className="mb-4 opacity-10" />
            <p className="text-xl font-bold">Nenhum ciclo selecionado</p>
            <p className="mt-2">Selecione um ciclo no Dashboard.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {confirmingLog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl space-y-8 border border-slate-100"
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle size={40} />
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Finalizar Plano de Ação?</h3>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Tem certeza que deseja marcar este plano de ação como concluído? 
                  <span className="block mt-2 font-bold text-rose-500 italic">Após essa ação, não será mais possível editar este registro no histórico.</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => setConfirmingLog(null)}
                  className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (confirmingLog) {
                      updateActionPlan(confirmingLog.id, confirmingLog.updates);
                      const obsInput = document.getElementById(confirmingLog.obsInputId) as HTMLInputElement;
                      if (obsInput) obsInput.value = '';
                      setConfirmingLog(null);
                    }
                  }}
                  className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );

  async function updateActionPlan(id: string, data: Partial<ActionPlanItem>) {
    if (!activeCycle) return;
    const newPlan = [...activeCycle.plan.actionPlan];
    const idx = newPlan.findIndex(i => i.id === id);
    if (idx === -1) return;
    
    const oldItem = newPlan[idx];
    let newItem = { ...oldItem, ...data };

    // Handle Innovation Project Creation
    const isNewInnovationType = data.actionType === 'Inovação' && oldItem.actionType !== 'Inovação';
    const isWhatChangingOnInnovation = data.what !== undefined && newItem.actionType === 'Inovação';
    
    // Create new innovation project if it's the first time it's selected as Innovation OR if what changes and none exists
    if ((isNewInnovationType || isWhatChangingOnInnovation) && !newItem.innovationProjectId && newItem.what?.trim().length > 3) {
      if (onAddInnovationProject) {
        try {
          const innovationProjectId = await onAddInnovationProject({
            projectId: project.id,
            projectName: project.name,
            pdcaId: activeCycle.id,
            actionId: id,
            actionTitle: newItem.what,
            processName: subtask.title,
            title: newItem.what,
            status: 'backlog',
            complexity: 'Baixa',
            startDate: new Date().toISOString(),
            responsibleId: newItem.who || '',
            responsibleName: '' 
          });
          newItem.innovationProjectId = innovationProjectId;
          newItem.status = 'Pendente';
        } catch (err) {
          console.error("Erro ao criar projeto de inovação:", err);
        }
      }
    }

    // Sync title to innovation project if it changes and project already exists
    if (data.what !== undefined && newItem.innovationProjectId) {
      if (onUpdateInnovationProject) {
        // Use a small delay or check to avoid excessive updates if needed, 
        // but for requirements we sync the title.
        onUpdateInnovationProject(newItem.innovationProjectId, { title: newItem.what });
      }
    }

    // Auto-transition from DO to CHECK when status is Concluído
    if (data.status === 'Concluído' && (!oldItem.currentPhase || oldItem.currentPhase === 'DO')) {
      newItem.currentPhase = 'CHECK';
    }

    newPlan[idx] = newItem;
    updatePlan({ actionPlan: newPlan });
  }

  function addActionPlanItem() {
    if (!activeCycle) return;
    const newItem: ActionPlanItem = { 
      id: uuidv4(), 
      what: '', 
      why: '',
      where: '',
      when: '', 
      who: '',
      sector: '',
      how: '',
      howMuch: '',
      status: 'Pendente',
      currentPhase: 'DO',
      executionLogs: [],
      monitoringMode: 'Dias',
      monitoringPeriod: 1,
      worked: 'Sim',
      finalProblemStatus: 'Resolvido',
      finalAction: 'Padronizar processo',
      standardizationModels: []
    };
    updatePlan({ actionPlan: [...activeCycle.plan.actionPlan, newItem] });
  }

  function removeActionPlanItem(id: string) {
    if (!activeCycle) return;
    const newPlan = activeCycle.plan.actionPlan.filter(i => i.id !== id);
    updatePlan({ actionPlan: newPlan });
  }

  function getProgress(status: PDCAStatus, cycle?: PDCACycle) {
    if (status === 'Concluído') return 100;
    if (!cycle) return 0;
    
    // Calculate based on phases
    let progress = 0;
    
    // PLAN completion
    const { rootCauseAnalysis } = cycle.plan;
    const isPlanComplete = rootCauseAnalysis.type === 'ishikawa' 
      ? (rootCauseAnalysis.priorityCauses || []).length > 0
      : !!rootCauseAnalysis.identifiedRootCause?.trim();
    
    if (isPlanComplete) progress += 25;

    // DO completion
    const isDoComplete = (cycle.plan.actionPlan || []).length > 0 && cycle.plan.actionPlan.every(item => {
      if (item.actionType === 'Inovação') {
        const innovationProject = innovationProjects.find(ip => ip.id === item.innovationProjectId);
        return innovationProject?.status === 'entregue';
      }
      return item.status === 'Concluído';
    });
    if (isDoComplete) progress += 25;

    // CHECK completion
    const isCheckComplete = isDoComplete && cycle.plan.actionPlan.every(item => 
      !!item.monitoringTool?.trim() && !!item.evidence?.trim() && !!item.worked && (item.worked === 'Sim' || !!item.failureReason?.trim())
    );
    if (isCheckComplete) progress += 25;

    // ACT completion
    const isActComplete = isCheckComplete && cycle.plan.actionPlan.every(item => 
      !!item.finalProblemStatus && !!item.finalAction && (item.finalAction !== 'Padronizar processo' || (item.standardizationModels || []).length > 0)
    );
    if (isActComplete) progress += 25;

    return progress;
  }
}

function ReportSection({ title, color, children }: { title: string, color: string, children: React.ReactNode }) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
    rose: "bg-rose-50 border-rose-100 text-rose-800",
    slate: "bg-slate-50 border-slate-100 text-slate-800"
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={cn("px-6 py-4 border-b font-black text-xs uppercase tracking-widest", colorClasses[color])}>
        {title}
      </div>
      <div className="p-6 space-y-6">
        {children}
      </div>
    </div>
  );
}

function ReportField({ label, value }: { label: string, value: any }) {
  const isLink = value && typeof value === 'string' && isValidUrl(value);
  
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      {isLink ? (
        <a 
          href={formatUrl(value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline flex items-center gap-1.5 transition-colors"
        >
          {value}
          <ExternalLink size={12} />
        </a>
      ) : (
        <p className="text-sm font-bold text-slate-700">{value || 'N/A'}</p>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600"
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", colors[color])}>
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    'Ativo': "bg-indigo-100 text-indigo-700",
    'Concluído': "bg-emerald-100 text-emerald-700 border border-emerald-200",
    'Em andamento': "bg-amber-100 text-amber-700",
    'Pendente': "bg-slate-100 text-slate-600"
  };

  return (
    <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider", styles[status] || "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

function PhaseTab({ active, onClick, label, color, disabled, icon, lockTooltip }: { active: boolean, onClick: () => void, label: string, color: string, disabled?: boolean, icon?: React.ReactNode, lockTooltip?: string }) {
  const colors: any = {
    indigo: "border-indigo-600 text-indigo-600",
    amber: "border-amber-500 text-amber-500",
    emerald: "border-emerald-500 text-emerald-500",
    rose: "border-rose-500 text-rose-500",
    slate: "border-slate-500 text-slate-500"
  };

  return (
    <div className="relative group/tab">
      <button 
        onClick={!disabled ? onClick : undefined}
        className={cn(
          "py-4 px-2 border-b-4 transition-all font-black text-xs tracking-widest flex items-center gap-2 outline-none",
          active ? colors[color] : "border-transparent text-slate-400 hover:text-slate-600",
          disabled && "opacity-50 cursor-not-allowed grayscale"
        )}
      >
        {icon}
        {label}
      </button>
      
      {disabled && lockTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tab:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
          <div className="relative">
            {lockTooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ number, title }: { number: string, title: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black shadow-lg">
        {number}
      </div>
      <h4 className="text-xl font-black text-slate-800 tracking-tight">{title}</h4>
    </div>
  );
}

function ParetoInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function PhaseSection({ title, value, onChange }: { title: string, value: string, onChange: (v: string) => void }) {
  return (
    <section className="space-y-4">
      <h4 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
        <div className="w-2 h-6 bg-indigo-500 rounded-full" />
        {title}
      </h4>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-6 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[150px] text-slate-700 font-medium shadow-sm"
        placeholder={`Descreva aqui a fase de ${title.toLowerCase()}...`}
      />
    </section>
  );
}
