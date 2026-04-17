import React, { useState, useMemo, useRef } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  ChevronRight, 
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
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import html2pdf from 'html2pdf.js';

import { Project, Subtask, PDCACycle, ParetoItem, ActionPlanItem, PDCAStatus, PDCAPriority } from '../types';
import ParetoDiagram from './ParetoDiagram';
import { cn } from '../lib/utils';

export default function PDCAEditor({ 
  project, 
  subtask, 
  onUpdateSubtask, 
  onBack, 
  defaultTaskId 
}: { 
  project: Project, 
  subtask: Subtask,
  onUpdateSubtask: (s: Subtask) => void,
  onBack: () => void,
  defaultTaskId?: string
}) {
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<'PLAN' | 'DO' | 'CHECK' | 'ACT' | 'REPORT'>('PLAN');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showProblemsModal, setShowProblemsModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Filter cycles if defaultTaskId is provided
  const cycles = useMemo(() => {
    if (defaultTaskId) {
      return subtask.pdcaCycles.filter(c => c.taskId === defaultTaskId);
    }
    return subtask.pdcaCycles;
  }, [subtask.pdcaCycles, defaultTaskId]);

  const activeCycle = subtask.pdcaCycles.find(c => c.id === activeCycleId);

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
      .filter(([_, data]) => data.isProblemStep)
      .map(([id, data]) => ({
        id,
        label: data.description || data.label || 'Sem descrição',
        time: data.timeInMinutes || 0,
        role: data.responsibleRole || ''
      }));
  }, [subtask.mapping.customData]);

  const relatedCycles = useMemo(() => {
    if (!activeCycle) return [];
    return subtask.pdcaCycles
      .filter(c => c.taskId === activeCycle.taskId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [subtask.pdcaCycles, activeCycle?.taskId]);

  const handlePhaseChange = (newPhase: typeof activePhase) => {
    if (activePhase === 'PLAN' && newPhase !== 'PLAN' && activeCycle) {
      const { rootCauseAnalysis } = activeCycle.plan;
      let isValid = true;

      if (rootCauseAnalysis.type === 'ishikawa') {
        if (!rootCauseAnalysis.priorityCauses || rootCauseAnalysis.priorityCauses.length === 0) {
          isValid = false;
        }
      } else if (rootCauseAnalysis.type === '5whys' || rootCauseAnalysis.type === 'list') {
        if (!rootCauseAnalysis.identifiedRootCause?.trim()) {
          isValid = false;
        }
      }

      if (!isValid) {
        setShowValidationErrors(true);
        setSaveFeedback("Preencha a causa raiz antes de avançar para o plano de ação.");
        return;
      }
    }
    
    setShowValidationErrors(false);
    setActivePhase(newPhase);
  };

  const createNewCycle = (taskId: string, taskLabel: string) => {
    const cycleCount = subtask.pdcaCycles.filter(c => c.taskId === taskId).length;
    const newCycle: PDCACycle = {
      id: uuidv4(),
      taskId,
      title: cycleCount > 0 ? `Ciclo PDCA ${cycleCount + 1} - ${taskLabel}` : `Ciclo PDCA - ${taskLabel}`,
      createdAt: new Date().toISOString(),
      status: 'Ativo',
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
      'Ciclo',
      'ID do Processo',
      'Nome do Problema',
      'Descricao do Problema',
      'PLAN - Causa Raiz',
      'PLAN - Impacto Descricao',
      'PLAN - Impacto Valor Atual',
      'PLAN - Meta (%)',
      'DO - Acao (What)',
      'DO - Responsavel',
      'DO - Setor',
      'DO - Status',
      'DO - Data Inicio',
      'DO - Data Conclusao',
      'CHECK - Modo Acompanhamento',
      'CHECK - Periodo',
      'CHECK - Como Acompanha',
      'CHECK - Funcionou',
      'CHECK - Evidencias',
      'CHECK - Impacto de Ganho',
      'ACT - Status Final',
      'ACT - Acao Final',
      'ACT - Padronizacao'
    ];

    const csvRows = [headers.join(',')];

    relatedCycles.forEach((cycle, cycleIdx) => {
      cycle.plan.actionPlan.forEach((item) => {
        const row = [
          cycleIdx + 1,
          cycle.id,
          `"${cycle.title.replace(/"/g, '""')}"`,
          `"${cycle.plan.problemDescription.replace(/"/g, '""')}"`,
          `"${(cycle.plan.rootCauseAnalysis.identifiedRootCause || '').replace(/"/g, '""')}"`,
          `"${cycle.plan.impact.description.replace(/"/g, '""')}"`,
          cycle.plan.impact.value,
          cycle.plan.impact.goal,
          `"${item.what.replace(/"/g, '""')}"`,
          `"${item.who.replace(/"/g, '""')}"`,
          `"${(item.sector || '').replace(/"/g, '""')}"`,
          item.status,
          item.startDate ? format(new Date(item.startDate), 'dd/MM/yyyy') : 'N/A',
          item.endDate ? format(new Date(item.endDate), 'dd/MM/yyyy') : 'N/A',
          item.monitoringMode,
          item.monitoringPeriod,
          `"${(item.monitoringTool || '').replace(/"/g, '""')}"`,
          item.worked,
          `"${(item.evidence || '').replace(/"/g, '""')}"`,
          item.gainImpact || 0,
          item.finalProblemStatus,
          item.finalAction,
          `"${(item.standardizationModels || []).join('; ')}"`
        ];
        csvRows.push(row.join(','));
      });
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pdca_historico_export_${activeCycle?.taskId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const normalizeColors = (element: HTMLElement) => {
    const all = element.querySelectorAll("*");
    all.forEach(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      
      // Check for oklab or oklch in color, backgroundColor or borderColor
      // These are not supported by html2canvas/jsPDF
      if (style.color.includes("oklab") || style.color.includes("oklch")) {
        htmlEl.style.color = "#1e293b"; // slate-800 fallback
      }
      
      const bg = style.backgroundColor;
      if (bg.includes("oklab") || bg.includes("oklch")) {
        htmlEl.style.backgroundColor = "#ffffff"; // white fallback
      }

      const bc = style.borderColor;
      if (bc.includes("oklab") || bc.includes("oklch")) {
        htmlEl.style.borderColor = "#e2e8f0"; // slate-200 fallback
      }
    });
  };

  const exportToPDF = async () => {
    if (isExportingPDF) return;
    
    const element = document.getElementById('pdca-report-content');
    if (!element) {
      console.error('Elemento do relatório não encontrado');
      return;
    }

    try {
      setIsExportingPDF(true);
      
      // Normalizar cores para evitar erro de oklab/oklch no html2canvas
      normalizeColors(element);
      
      // Pequeno delay para garantir que o DOM está estável
      await new Promise(resolve => setTimeout(resolve, 300));

      const opt = {
        margin: 10,
        filename: `relatorio_pdca_${activeCycle?.taskId || 'export'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          letterRendering: true,
          allowTaint: false
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.');
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
                        <span>{getProgress(cycle.status)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500" 
                          style={{ width: `${getProgress(cycle.status)}%` }}
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
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-md"
          >
            <Save size={16} />
            Salvar
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeCycle ? (
          <>
            {/* Phase Tabs */}
            <div className="bg-white border-b border-slate-200 px-8 flex gap-8">
              <PhaseTab active={activePhase === 'PLAN'} onClick={() => handlePhaseChange('PLAN')} label="PLAN (P)" color="indigo" />
              <PhaseTab active={activePhase === 'DO'} onClick={() => handlePhaseChange('DO')} label="DO (D)" color="amber" />
              <PhaseTab active={activePhase === 'CHECK'} onClick={() => handlePhaseChange('CHECK')} label="CHECK (C)" color="emerald" />
              <PhaseTab active={activePhase === 'ACT'} onClick={() => handlePhaseChange('ACT')} label="ACT (A)" color="rose" />
              <PhaseTab active={activePhase === 'REPORT'} onClick={() => handlePhaseChange('REPORT')} label="RELATÓRIO PDCA" color="slate" />
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
                            {activeCycle.plan.actionPlan.map((item, idx) => (
                              <div key={item.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6 relative group">
                                <button 
                                  onClick={() => removeActionPlanItem(idx)}
                                  className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 size={20} />
                                </button>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
                                  <div className="space-y-1 min-w-0">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">What (O que será feito?)</label>
                                    <input 
                                      value={item.what || ''} 
                                      placeholder="O que será feito?"
                                      onChange={(e) => updateActionPlan(idx, { what: e.target.value })}
                                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">Why (Por que será feito?)</label>
                                    <input 
                                      value={item.why || ''} 
                                      placeholder="Por que essa ação é necessária?"
                                      onChange={(e) => updateActionPlan(idx, { why: e.target.value })}
                                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">Where (Onde?)</label>
                                    <input 
                                      value={item.where || ''} 
                                      placeholder="Onde será executada?"
                                      onChange={(e) => updateActionPlan(idx, { where: e.target.value })}
                                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 min-w-0">
                                    <div className="space-y-1 min-w-0">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">When (Quando?)</label>
                                      <input 
                                        type="date"
                                        value={item.when || ''} 
                                        placeholder="Quando será realizada?"
                                        onChange={(e) => updateActionPlan(idx, { when: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                      />
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">Who (Responsável)</label>
                                      <input 
                                        value={item.who || ''} 
                                        placeholder="Quem é o responsável?"
                                        onChange={(e) => updateActionPlan(idx, { who: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                      />
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">Setor</label>
                                      <input 
                                        value={item.sector || ''} 
                                        placeholder="Qual o setor?"
                                        onChange={(e) => updateActionPlan(idx, { sector: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">How (Como será feito?)</label>
                                    <input 
                                      value={item.how || ''} 
                                      placeholder="Como será executada?"
                                      onChange={(e) => updateActionPlan(idx, { how: e.target.value })}
                                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate block">How much (Custo ou esforço)</label>
                                    <input 
                                      value={item.howMuch || ''} 
                                      placeholder="Qual o custo ou esforço estimado?"
                                      onChange={(e) => updateActionPlan(idx, { howMuch: e.target.value })}
                                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button 
                              onClick={addActionPlanItem}
                              className="w-full py-8 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 font-black text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={24} />
                              Adicionar Nova Ação 5W2H
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
                            Nenhuma ação planejada no PLAN.
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan.map((item, idx) => (
                            <div key={item.id} className="p-8 space-y-6 hover:bg-slate-50/50 transition-all">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <h5 className="font-bold text-slate-800 text-lg">{item.what || 'Ação sem descrição'}</h5>
                                    <p className="text-xs text-slate-400">Responsável: <span className="font-bold text-slate-600">{item.who}</span></p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                                    item.status === 'Concluído' ? "bg-emerald-100 text-emerald-700" :
                                    item.status === 'Em andamento' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                                  )}>
                                    {item.status}
                                  </span>
                                </div>
                              </div>

                              {/* History Log */}
                              <div className="space-y-4">
                                <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico de Atualizações</h6>
                                <div className="space-y-3">
                                  {(item.executionLogs || []).map((log) => (
                                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
                                      <div className={cn(
                                        "w-2 h-2 rounded-full mt-2 shrink-0",
                                        log.status === 'Concluído' ? "bg-emerald-500" :
                                        log.status === 'Em andamento' ? "bg-amber-500" : "bg-slate-300"
                                      )} />
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{log.status}</span>
                                          <span className="text-[10px] text-slate-400 font-medium">{format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">{log.observation}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-bold">{log.responsible}</span>
                                          {log.sector && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-bold">{log.sector}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Add Log Form */}
                                {item.status !== 'Concluído' ? (
                                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Nova Atualização</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novo Status</label>
                                        <select 
                                          id={`status-${item.id}`}
                                          className="w-full bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold outline-none"
                                        >
                                          <option value="Pendente">Pendente</option>
                                          <option value="Em andamento">Em andamento</option>
                                          <option value="Concluído">Concluído</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setor</label>
                                        <input 
                                          id={`sector-${item.id}`}
                                          type="text"
                                          placeholder="Setor do responsável"
                                          className="w-full bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold outline-none"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observação</label>
                                        <input 
                                          id={`obs-${item.id}`}
                                          type="text"
                                          placeholder="O que foi feito nesta etapa?"
                                          className="w-full bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold outline-none"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex justify-end">
                                      <button 
                                        onClick={() => {
                                          const statusSelect = document.getElementById(`status-${item.id}`) as HTMLSelectElement;
                                          const sectorInput = document.getElementById(`sector-${item.id}`) as HTMLInputElement;
                                          const obsInput = document.getElementById(`obs-${item.id}`) as HTMLInputElement;
                                          
                                          if (!obsInput.value) return;

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
                                          if (statusSelect.value === 'Concluído') {
                                            updates.endDate = new Date().toISOString();
                                          }

                                          updateActionPlan(idx, updates);
                                          obsInput.value = '';
                                        }}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                                      >
                                        Registrar Atualização
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                      <CheckCircle2 size={20} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Ação Concluída</p>
                                      <p className="text-[10px] text-emerald-600 font-medium">Esta ação foi finalizada e não permite novos registros.</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
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
                            Nenhuma ação planejada no PLAN.
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan.map((item, idx) => (
                            <div key={item.id} className="p-8 space-y-6 hover:bg-slate-50/50 transition-all">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                                  {idx + 1}
                                </span>
                                <h5 className="font-bold text-slate-800 text-lg">{item.what || 'Ação sem descrição'}</h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Modo de Acompanhamento</label>
                                  <select 
                                    value={item.monitoringMode || 'Dias'}
                                    onChange={(e) => updateActionPlan(idx, { monitoringMode: e.target.value as any })}
                                    className="w-full bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
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
                                    onChange={(e) => updateActionPlan(idx, { monitoringPeriod: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
                                  />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Como está sendo feito o acompanhamento?</label>
                                  <input 
                                    type="text"
                                    value={item.monitoringTool || ''}
                                    onChange={(e) => updateActionPlan(idx, { monitoringTool: e.target.value })}
                                    placeholder="Ex: Power BI, Excel, E-mail, WhatsApp..."
                                    className="w-full bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Funcionou?</label>
                                  <select 
                                    value={item.worked || 'Sim'}
                                    onChange={(e) => updateActionPlan(idx, { worked: e.target.value as any })}
                                    className={cn(
                                      "w-full px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-none",
                                      item.worked === 'Sim' ? "bg-emerald-100 text-emerald-700" :
                                      item.worked === 'Não' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                    )}
                                  >
                                    <option value="Sim">Sim</option>
                                    <option value="Não">Não</option>
                                    <option value="Parcial">Parcial</option>
                                  </select>
                                </div>
                                <div className="md:col-span-3 space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Evidências</label>
                                  <input 
                                    type="text"
                                    value={item.evidence || ''}
                                    onChange={(e) => updateActionPlan(idx, { evidence: e.target.value })}
                                    placeholder="Link ou descrição..."
                                    className="w-full bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Impacto de ganho</label>
                                  <input 
                                    type="number"
                                    value={item.gainImpact || 0}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => updateActionPlan(idx, { gainImpact: parseFloat(e.target.value) || 0 })}
                                    placeholder="Informe o custo atual após o plano de ação"
                                    className="w-full bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))
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
                            Nenhuma ação planejada no PLAN.
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan.map((item, idx) => (
                            <div key={item.id} className="p-8 space-y-6 hover:bg-slate-50/50 transition-all">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                                  {idx + 1}
                                </span>
                                <h5 className="font-bold text-slate-800 text-lg">{item.what || 'Ação sem descrição'}</h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Status Final do Problema</label>
                                    <select 
                                      value={item.finalProblemStatus || 'Resolvido'}
                                      onChange={(e) => updateActionPlan(idx, { finalProblemStatus: e.target.value as any })}
                                      className="w-full bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
                                    >
                                      <option value="Resolvido">Resolvido</option>
                                      <option value="Não resolvido">Não resolvido</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ação Final</label>
                                    <select 
                                      value={item.finalAction || 'Padronizar processo'}
                                      onChange={(e) => updateActionPlan(idx, { finalAction: e.target.value as any })}
                                      className="w-full bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
                                    >
                                      <option value="Padronizar processo">Padronizar processo</option>
                                      <option value="Fazer nova análise">Fazer nova análise</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {item.finalAction === 'Padronizar processo' && (
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Modelo de Padronização</label>
                                      <div className="flex flex-wrap gap-2">
                                        {['POP', 'ITO', 'Painel de controle'].map(model => (
                                          <button 
                                            key={model}
                                            onClick={() => {
                                              const current = item.standardizationModels || [];
                                              const next = current.includes(model as any)
                                                ? current.filter(m => m !== model)
                                                : [...current, model as any];
                                              updateActionPlan(idx, { standardizationModels: next });
                                            }}
                                            className={cn(
                                              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                              item.standardizationModels?.includes(model as any)
                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
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
                                    <div className="pt-4">
                                      <button 
                                        onClick={() => {
                                          createNewCycle(activeCycle.taskId, activeCycle.plan.problemDescription);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                      >
                                        <RefreshCw size={16} />
                                        Refazer PDCA
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
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
                        <div key={cycle.id} className="space-y-8 border-b-4 border-slate-100 pb-12 last:border-0 last:pb-0">
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
                            <ReportField label="Descrição do Problema" value={cycle.plan.problemDescription} />
                            <ReportField label="Causa Raiz Identificada" value={cycle.plan.rootCauseAnalysis.identifiedRootCause || 'Não informada'} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <ReportField label="Impacto: Descrição" value={cycle.plan.impact.description} />
                              <ReportField label="Impacto: Valor Atual" value={`R$ ${cycle.plan.impact.value}`} />
                              <ReportField label="Impacto: Meta (%)" value={`${cycle.plan.impact.goal}%`} />
                            </div>
                            <ReportField label="Método Utilizado" value={cycle.plan.rootCauseAnalysis.type.toUpperCase()} />
                            
                            <div className="mt-6 pt-6 border-t border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Plano de Ação (5W2H)</p>
                              <div className="space-y-4">
                                {cycle.plan.actionPlan.map((item) => (
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
                              {cycle.plan.actionPlan.map((item, idx) => (
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
                              {cycle.plan.actionPlan.map((item, idx) => (
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
                                    <div>
                                      <p className="font-black text-slate-400 uppercase">Impacto de Ganho</p>
                                      <p className="font-bold text-emerald-600">R$ {item.gainImpact || 0}</p>
                                    </div>
                                  </div>
                                  <ReportField label="Evidências" value={item.evidence || 'N/A'} />
                                </div>
                              ))}
                            </div>
                          </ReportSection>

                          {/* ACT */}
                          <ReportSection title="ACT (Agir)" color="rose">
                            <div className="space-y-4">
                              {cycle.plan.actionPlan.map((item, idx) => (
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
    </div>
  );

  function updateActionPlan(idx: number, data: Partial<ActionPlanItem>) {
    if (!activeCycle) return;
    const newPlan = [...activeCycle.plan.actionPlan];
    newPlan[idx] = { ...newPlan[idx], ...data };
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

  function removeActionPlanItem(idx: number) {
    if (!activeCycle) return;
    const newPlan = activeCycle.plan.actionPlan.filter((_, i) => i !== idx);
    updatePlan({ actionPlan: newPlan });
  }

  function getProgress(status: PDCAStatus) {
    switch (status) {
      case 'Ativo': return 50;
      case 'Concluído': return 100;
      default: return 0;
    }
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
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-slate-700">{value || 'N/A'}</p>
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

function PhaseTab({ active, onClick, label, color }: { active: boolean, onClick: () => void, label: string, color: string }) {
  const colors: any = {
    indigo: "border-indigo-600 text-indigo-600",
    amber: "border-amber-500 text-amber-500",
    emerald: "border-emerald-500 text-emerald-500",
    rose: "border-rose-500 text-rose-500"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "py-4 px-2 border-b-4 transition-all font-black text-xs tracking-widest",
        active ? colors[color] : "border-transparent text-slate-400 hover:text-slate-600"
      )}
    >
      {label}
    </button>
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
