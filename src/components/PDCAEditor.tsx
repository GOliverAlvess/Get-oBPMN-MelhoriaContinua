import React, { useState, useMemo } from 'react';
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
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

import { Project, PDCACycle, ParetoItem, ActionPlanItem, PDCAStatus, PDCAPriority } from '../types';
import ParetoDiagram from './ParetoDiagram';
import { cn } from '../lib/utils';

export default function PDCAEditor({ project, setProjects, onBack }: { 
  project: Project, 
  setProjects: (p: Project) => void,
  onBack: () => void
}) {
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<'PLAN' | 'DO' | 'CHECK' | 'ACT'>('PLAN');
  const [showProblemsModal, setShowProblemsModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  const activeCycle = project.pdcaCycles.find(c => c.id === activeCycleId);

  // Problems from Mapping
  const problemsFromMapping = useMemo(() => {
    const customData = project.mapping.customData || {};
    return Object.entries(customData)
      .filter(([_, data]) => data.isProblemStep)
      .map(([id, data]) => ({
        id,
        label: data.description || data.label || 'Sem descrição',
        time: data.timeInMinutes || 0,
        role: data.responsibleRole || ''
      }));
  }, [project.mapping.customData]);

  const createNewCycle = (taskId: string, taskLabel: string) => {
    const newCycle: PDCACycle = {
      id: uuidv4(),
      taskId,
      title: `Ciclo PDCA - ${taskLabel}`,
      createdAt: new Date().toISOString(),
      status: 'Em planejamento',
      plan: {
        problemDescription: taskLabel,
        impact: '',
        priority: 'Média',
        goal: '',
        fiveWhys: { why1: '', why2: '', why3: '', why4: '', why5: '' },
        actionPlan: []
      },
      do: { observations: '' },
      check: { resultObtained: '', worked: 'Sim', evidence: '' },
      act: { finalAction: '', adjustments: '', finalStatus: 'Resolvido' }
    };

    setProjects({ ...project, pdcaCycles: [newCycle, ...project.pdcaCycles] });
    setActiveCycleId(newCycle.id);
    setActivePhase('PLAN');
    setShowDashboard(false);
    setShowProblemsModal(false);
  };

  const updateCycle = (newData: Partial<PDCACycle>) => {
    if (!activeCycleId) return;
    const newCycles = project.pdcaCycles.map(c => c.id === activeCycleId ? { ...c, ...newData } : c);
    setProjects({ ...project, pdcaCycles: newCycles });
  };

  const updatePlan = (newPlan: any) => {
    if (!activeCycle) return;
    updateCycle({ plan: { ...activeCycle.plan, ...newPlan } });
  };

  const dashboardStats = useMemo(() => {
    const total = project.pdcaCycles.length;
    const resolved = project.pdcaCycles.filter(c => c.act.finalStatus === 'Resolvido' && c.status === 'Concluído').length;
    const inProgress = project.pdcaCycles.filter(c => c.status !== 'Concluído').length;
    
    return { total, resolved, inProgress };
  }, [project.pdcaCycles]);

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
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Ciclos Ativos</h4>
            {project.pdcaCycles.length === 0 ? (
              <div className="py-20 bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
                <Target size={48} className="mb-4 opacity-20" />
                <p className="font-bold">Nenhum ciclo PDCA iniciado</p>
                <p className="text-sm">Clique em "Identificar Problemas" para começar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.pdcaCycles.map(cycle => (
                  <div 
                    key={cycle.id}
                    onClick={() => {
                      setActiveCycleId(cycle.id);
                      setShowDashboard(false);
                    }}
                    className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{cycle.title}</h5>
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
                    problemsFromMapping.map(p => (
                      <div 
                        key={p.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between group hover:border-indigo-300 transition-all"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{p.label}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                              <Clock size={10} /> {p.time} min
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.role}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => createNewCycle(p.id, p.label)}
                          className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm border border-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                        >
                          Iniciar PDCA
                        </button>
                      </div>
                    ))
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
                <StatusBadge status={activeCycle?.status || 'Não iniciado'} />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {activeCycle && format(new Date(activeCycle.createdAt), 'dd/MM/yyyy')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={activeCycle?.status}
            onChange={(e) => updateCycle({ status: e.target.value as any })}
            className="bg-slate-100 border-none text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Não iniciado">Não iniciado</option>
            <option value="Em planejamento">Em planejamento</option>
            <option value="Em execução">Em execução</option>
            <option value="Em validação">Em validação</option>
            <option value="Concluído">Concluído</option>
          </select>
          <button 
            onClick={() => setShowDashboard(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-md"
          >
            <Save size={16} />
            Salvar e Sair
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeCycle ? (
          <>
            {/* Phase Tabs */}
            <div className="bg-white border-b border-slate-200 px-8 flex gap-8">
              <PhaseTab active={activePhase === 'PLAN'} onClick={() => setActivePhase('PLAN')} label="PLAN (P)" color="indigo" />
              <PhaseTab active={activePhase === 'DO'} onClick={() => setActivePhase('DO')} label="DO (D)" color="amber" />
              <PhaseTab active={activePhase === 'CHECK'} onClick={() => setActivePhase('CHECK')} label="CHECK (C)" color="emerald" />
              <PhaseTab active={activePhase === 'ACT'} onClick={() => setActivePhase('ACT')} label="ACT (A)" color="rose" />
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
                            value={activeCycle.plan.problemDescription}
                            onChange={(e) => updatePlan({ problemDescription: e.target.value })}
                            className="w-full p-6 bg-white border border-slate-200 rounded-3xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[120px] text-slate-700 font-medium shadow-sm"
                          />
                        </section>

                        {/* 2. Causa Raiz */}
                        <section className="space-y-6">
                          <SectionHeader number="2" title="Análise de Causa Raiz (5 Porquês)" />
                          <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(num => (
                              <div key={num} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shadow-sm">
                                  {num}
                                </div>
                                <input 
                                  type="text" 
                                  placeholder={`Por quê ${num}?`}
                                  value={(activeCycle.plan.fiveWhys as any)[`why${num}`]}
                                  onChange={(e) => updatePlan({ fiveWhys: { ...activeCycle.plan.fiveWhys, [`why${num}`]: e.target.value } })}
                                  className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* 3. Plano de Ação */}
                        <section className="space-y-6">
                          <SectionHeader number="3" title="Plano de Ação" />
                          <div className="space-y-4">
                            {activeCycle.plan.actionPlan.map((item, idx) => (
                              <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 relative group">
                                <button 
                                  onClick={() => removeActionPlanItem(idx)}
                                  className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O que fazer?</label>
                                    <input 
                                      value={item.what} 
                                      onChange={(e) => updateActionPlan(idx, { what: e.target.value })}
                                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</label>
                                      <input 
                                        value={item.who} 
                                        onChange={(e) => updateActionPlan(idx, { who: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo</label>
                                      <input 
                                        type="date"
                                        value={item.when} 
                                        onChange={(e) => updateActionPlan(idx, { when: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button 
                              onClick={addActionPlanItem}
                              className="w-full py-6 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-black text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={20} />
                              Adicionar Nova Ação
                            </button>
                          </div>
                        </section>
                      </div>

                      <div className="space-y-8">
                        {/* Impacto & Prioridade */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Target size={14} className="text-indigo-500" />
                              Impacto do Problema
                            </label>
                            <textarea 
                              placeholder="Qual o prejuízo atual?"
                              value={activeCycle.plan.impact}
                              onChange={(e) => updatePlan({ impact: e.target.value })}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 min-h-[100px]"
                            />
                          </div>

                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Prioridade</label>
                            <div className="grid grid-cols-2 gap-2">
                              {['Baixa', 'Média', 'Alta', 'Crítica'].map(p => (
                                <button 
                                  key={p}
                                  onClick={() => updatePlan({ priority: p })}
                                  className={cn(
                                    "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                    activeCycle.plan.priority === p 
                                      ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                  )}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <TrendingUp size={14} className="text-emerald-500" />
                              Meta de Melhoria
                            </label>
                            <input 
                              placeholder="Ex: Reduzir tempo em 20%"
                              value={activeCycle.plan.goal}
                              onChange={(e) => updatePlan({ goal: e.target.value })}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePhase === 'DO' && (
                  <motion.div key="do" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">Execução do Plano de Ação</h4>
                        <p className="text-slate-500 text-sm mt-1">Acompanhe o status de cada ação planejada.</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {activeCycle.plan.actionPlan.length === 0 ? (
                          <div className="p-20 text-center text-slate-400 italic">
                            Nenhuma ação planejada no PLAN.
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan.map((item, idx) => (
                            <div key={item.id} className="p-8 flex flex-col md:flex-row md:items-center gap-8 hover:bg-slate-50/50 transition-all">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">
                                    {idx + 1}
                                  </span>
                                  <h5 className="font-bold text-slate-800 text-lg">{item.what}</h5>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-400 font-bold uppercase tracking-wider ml-11">
                                  <span>Resp: {item.who}</span>
                                  <span>Prazo: {item.when ? format(new Date(item.when), 'dd/MM/yyyy') : '-'}</span>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Status</label>
                                  <select 
                                    value={item.status}
                                    onChange={(e) => updateActionPlan(idx, { status: e.target.value as any })}
                                    className={cn(
                                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-none",
                                      item.status === 'Concluído' ? "bg-emerald-100 text-emerald-700" :
                                      item.status === 'Em andamento' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                                    )}
                                  >
                                    <option value="Pendente">Pendente</option>
                                    <option value="Em andamento">Em andamento</option>
                                    <option value="Concluído">Concluído</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Executado em</label>
                                  <input 
                                    type="date"
                                    value={item.executionDate}
                                    onChange={(e) => updateActionPlan(idx, { executionDate: e.target.value })}
                                    className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold outline-none border-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <section className="space-y-4">
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText size={14} />
                        Observações da Execução
                      </h4>
                      <textarea 
                        value={activeCycle.do.observations}
                        onChange={(e) => updateCycle({ do: { observations: e.target.value } })}
                        className="w-full p-6 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[150px] text-slate-700 font-medium shadow-sm"
                        placeholder="Registre aqui detalhes importantes da execução..."
                      />
                    </section>
                  </motion.div>
                )}

                {activePhase === 'CHECK' && (
                  <motion.div key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-12">
                    <section className="space-y-6">
                      <SectionHeader number="1" title="Verificação de Resultados" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Resultado Obtido</label>
                          <textarea 
                            value={activeCycle.check.resultObtained}
                            onChange={(e) => updateCycle({ check: { ...activeCycle.check, resultObtained: e.target.value } })}
                            className="w-full p-6 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[150px] text-slate-700 font-medium shadow-sm"
                            placeholder="Descreva os indicadores após a execução..."
                          />
                        </div>
                        <div className="space-y-8">
                          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <h5 className="font-bold text-slate-800">Funcionou?</h5>
                            <div className="flex gap-2">
                              {['Sim', 'Não', 'Parcial'].map(v => (
                                <button 
                                  key={v}
                                  onClick={() => updateCycle({ check: { ...activeCycle.check, worked: v as any } })}
                                  className={cn(
                                    "flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all",
                                    activeCycle.check.worked === v 
                                      ? (v === 'Sim' ? "bg-emerald-500 border-emerald-500 text-white shadow-lg" : 
                                         v === 'Não' ? "bg-rose-500 border-rose-500 text-white shadow-lg" : 
                                         "bg-amber-500 border-amber-500 text-white shadow-lg")
                                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                  )}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Evidências</label>
                            <input 
                              type="text"
                              placeholder="Links ou referências de evidências"
                              value={activeCycle.check.evidence}
                              onChange={(e) => updateCycle({ check: { ...activeCycle.check, evidence: e.target.value } })}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  </motion.div>
                )}

                {activePhase === 'ACT' && (
                  <motion.div key="act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-12">
                    <section className="space-y-8">
                      <SectionHeader number="1" title="Ação de Melhoria Contínua" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Ação Final / Padronização</label>
                          <textarea 
                            value={activeCycle.act.finalAction}
                            onChange={(e) => updateCycle({ act: { ...activeCycle.act, finalAction: e.target.value } })}
                            className="w-full p-6 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[150px] text-slate-700 font-medium shadow-sm"
                            placeholder="Se funcionou, como padronizar? Se não, o que ajustar?"
                          />
                        </div>
                        <div className="space-y-8">
                          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <h5 className="font-bold text-slate-800">Status Final do Problema</h5>
                            <div className="flex gap-2">
                              {['Resolvido', 'Em nova análise'].map(v => (
                                <button 
                                  key={v}
                                  onClick={() => updateCycle({ act: { ...activeCycle.act, finalStatus: v as any } })}
                                  className={cn(
                                    "flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all",
                                    activeCycle.act.finalStatus === v 
                                      ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                  )}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Ajustes Necessários</label>
                            <input 
                              type="text"
                              value={activeCycle.act.adjustments}
                              onChange={(e) => updateCycle({ act: { ...activeCycle.act, adjustments: e.target.value } })}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </section>
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
    const newItem: ActionPlanItem = { id: uuidv4(), what: '', who: '', when: '', status: 'Pendente' };
    updatePlan({ actionPlan: [...activeCycle.plan.actionPlan, newItem] });
  }

  function removeActionPlanItem(idx: number) {
    if (!activeCycle) return;
    const newPlan = activeCycle.plan.actionPlan.filter((_, i) => i !== idx);
    updatePlan({ actionPlan: newPlan });
  }

  function getProgress(status: PDCAStatus) {
    switch (status) {
      case 'Não iniciado': return 0;
      case 'Em planejamento': return 25;
      case 'Em execução': return 50;
      case 'Em validação': return 75;
      case 'Concluído': return 100;
      default: return 0;
    }
  }
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

function StatusBadge({ status }: { status: PDCAStatus }) {
  const styles: any = {
    'Não iniciado': "bg-slate-100 text-slate-500",
    'Em planejamento': "bg-indigo-100 text-indigo-700",
    'Em execução': "bg-amber-100 text-amber-700",
    'Em validação': "bg-emerald-100 text-emerald-700",
    'Concluído': "bg-slate-900 text-white"
  };

  return (
    <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider", styles[status])}>
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
