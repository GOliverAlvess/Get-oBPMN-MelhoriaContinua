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
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

import { Project, PDCACycle, ParetoItem, ActionPlanItem } from '../types';
import ParetoDiagram from './ParetoDiagram';
import { cn } from '../lib/utils';

export default function PDCAEditor({ project, setProjects, onBack }: { 
  project: Project, 
  setProjects: (p: Project) => void,
  onBack: () => void
}) {
  const [activeCycleId, setActiveCycleId] = useState<string | null>(project.pdcaCycles[0]?.id || null);
  const [activePhase, setActivePhase] = useState<'PLAN' | 'DO' | 'CHECK' | 'ACT'>('PLAN');

  const activeCycle = project.pdcaCycles.find(c => c.id === activeCycleId);

  // Problems from Mapping
  const problemsFromMapping = useMemo(() => {
    return project.mapping.nodes
      .filter(node => node.data.isProblemStep)
      .map(node => ({
        id: node.id,
        label: node.data.label,
        role: node.data.responsibleRole
      }));
  }, [project.mapping.nodes]);

  const createNewCycle = () => {
    const newCycle: PDCACycle = {
      id: uuidv4(),
      title: `Ciclo PDCA - ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      plan: {
        problemIdentification: '',
        paretoData: { items: [], period: '', area: '' },
        objective: '',
        meta: '',
        fiveWhys: { why1: '', why2: '', why3: '', why4: '', why5: '' },
        actionPlan: []
      },
      do: { training: '', execution: '', pilotTest: '', actionStatus: '' },
      check: { indicators: '', resultComparison: '', deviationEvaluation: '', goalMet: false },
      act: { standardization: '', documentation: '', correctiveAction: '', lessonsLearned: '' }
    };

    setProjects({ ...project, pdcaCycles: [newCycle, ...project.pdcaCycles] });
    setActiveCycleId(newCycle.id);
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

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ChevronRight size={24} className="rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <RefreshCw size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Editor PDCA Avançado</h3>
              <p className="text-xs text-slate-400 font-medium">Melhoria Contínua & Solução de Problemas</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={createNewCycle}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <Plus size={18} />
            Novo Ciclo
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Problems & Cycles */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-500" />
              Problemas Identificados
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {problemsFromMapping.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum problema marcado no mapeamento.</p>
              ) : (
                problemsFromMapping.map(p => (
                  <div key={p.id} className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                    <p className="text-xs font-bold text-rose-700 leading-tight">{p.label}</p>
                    <p className="text-[10px] text-rose-500 mt-1 uppercase font-bold">{p.role || 'Sem Cargo'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <RefreshCw size={14} className="text-indigo-500" />
              Histórico de Ciclos
            </h4>
            <div className="space-y-3">
              {project.pdcaCycles.map(cycle => (
                <button 
                  key={cycle.id}
                  onClick={() => setActiveCycleId(cycle.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all",
                    activeCycleId === cycle.id 
                      ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                      : "bg-white border-slate-100 hover:border-slate-200"
                  )}
                >
                  <p className={cn(
                    "text-sm font-bold truncate",
                    activeCycleId === cycle.id ? "text-indigo-700" : "text-slate-700"
                  )}>
                    {cycle.title}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">{format(new Date(cycle.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
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
                      {/* 1. Identificação */}
                      <section className="space-y-4">
                        <SectionHeader number="1" title="Identificação do Problema" />
                        <textarea 
                          placeholder="Descreva o problema de forma clara e objetiva..."
                          value={activeCycle.plan.problemIdentification}
                          onChange={(e) => updatePlan({ problemIdentification: e.target.value })}
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px] text-slate-700 font-medium"
                        />
                      </section>

                      {/* 2. Pareto */}
                      <section className="space-y-6">
                        <SectionHeader number="2" title="Situação Atual & Diagrama de Pareto" />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <div className="lg:col-span-1 space-y-4">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                              <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">Dados do Pareto</h5>
                              <div className="space-y-3">
                                <ParetoInput label="Período" value={activeCycle.plan.paretoData.period} onChange={(v) => updatePlan({ paretoData: { ...activeCycle.plan.paretoData, period: v } })} />
                                <ParetoInput label="Área/Processo" value={activeCycle.plan.paretoData.area} onChange={(v) => updatePlan({ paretoData: { ...activeCycle.plan.paretoData, area: v } })} />
                              </div>
                              <div className="h-px bg-slate-100 my-4" />
                              <div className="space-y-3">
                                {activeCycle.plan.paretoData.items.map((item, idx) => (
                                  <div key={item.id} className="flex gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="Causa"
                                      value={item.category}
                                      onChange={(e) => {
                                        const newItems = [...activeCycle.plan.paretoData.items];
                                        newItems[idx].category = e.target.value;
                                        updatePlan({ paretoData: { ...activeCycle.plan.paretoData, items: newItems } });
                                      }}
                                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                    <input 
                                      type="number" 
                                      placeholder="Qtd"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newItems = [...activeCycle.plan.paretoData.items];
                                        newItems[idx].quantity = parseInt(e.target.value) || 0;
                                        updatePlan({ paretoData: { ...activeCycle.plan.paretoData, items: newItems } });
                                      }}
                                      className="w-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                    <button 
                                      onClick={() => {
                                        const newItems = activeCycle.plan.paretoData.items.filter((_, i) => i !== idx);
                                        updatePlan({ paretoData: { ...activeCycle.plan.paretoData, items: newItems } });
                                      }}
                                      className="p-2 text-slate-300 hover:text-rose-500"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => {
                                    const newItems = [...activeCycle.plan.paretoData.items, { id: uuidv4(), category: '', quantity: 0 }];
                                    updatePlan({ paretoData: { ...activeCycle.plan.paretoData, items: newItems } });
                                  }}
                                  className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs font-bold hover:border-indigo-300 hover:text-indigo-500 transition-all"
                                >
                                  + Adicionar Categoria
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="lg:col-span-2">
                            {activeCycle.plan.paretoData.items.length > 0 ? (
                              <ParetoDiagram data={activeCycle.plan.paretoData.items} />
                            ) : (
                              <div className="h-[400px] bg-white border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                                <TrendingUp size={48} className="mb-4 opacity-20" />
                                <p className="font-bold">Adicione dados para gerar o Pareto</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* 3. Objetivo e Meta */}
                      <section className="space-y-4">
                        <SectionHeader number="3" title="Objetivo e Meta" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objetivo (O que?)</label>
                            <input 
                              type="text" 
                              value={activeCycle.plan.objective}
                              onChange={(e) => updatePlan({ objective: e.target.value })}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta (Quanto? Quando?)</label>
                            <input 
                              type="text" 
                              value={activeCycle.plan.meta}
                              onChange={(e) => updatePlan({ meta: e.target.value })}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                            />
                          </div>
                        </div>
                      </section>

                      {/* 4. Causa Raiz (5 Porquês) */}
                      <section className="space-y-6">
                        <SectionHeader number="4" title="Causa Raiz (5 Porquês)" />
                        <div className="space-y-4">
                          {[1, 2, 3, 4, 5].map(num => (
                            <div key={num} className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-lg shadow-sm">
                                {num}
                              </div>
                              <div className="flex-1 relative">
                                <input 
                                  type="text" 
                                  placeholder={`Por quê ${num}?`}
                                  value={(activeCycle.plan.fiveWhys as any)[`why${num}`]}
                                  onChange={(e) => updatePlan({ fiveWhys: { ...activeCycle.plan.fiveWhys, [`why${num}`]: e.target.value } })}
                                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                                />
                                {num < 5 && (
                                  <div className="absolute -bottom-4 left-6 w-0.5 h-4 bg-indigo-200" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* 5. Plano de Ação (5W2H) */}
                      <section className="space-y-6">
                        <SectionHeader number="5" title="Plano de Ação (5W2H)" />
                        <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">O que (What)</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Por que (Why)</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quem (Who)</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quando (When)</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quanto (Cost)</th>
                                <th className="p-4 w-10"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeCycle.plan.actionPlan.map((item, idx) => (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                  <td className="p-2"><input className="w-full p-2 bg-transparent outline-none text-sm font-medium" value={item.what} onChange={(e) => updateActionPlan(idx, { what: e.target.value })} /></td>
                                  <td className="p-2"><input className="w-full p-2 bg-transparent outline-none text-sm font-medium" value={item.why} onChange={(e) => updateActionPlan(idx, { why: e.target.value })} /></td>
                                  <td className="p-2"><input className="w-full p-2 bg-transparent outline-none text-sm font-medium" value={item.who} onChange={(e) => updateActionPlan(idx, { who: e.target.value })} /></td>
                                  <td className="p-2"><input className="w-full p-2 bg-transparent outline-none text-sm font-medium" type="date" value={item.when} onChange={(e) => updateActionPlan(idx, { when: e.target.value })} /></td>
                                  <td className="p-2"><input className="w-full p-2 bg-transparent outline-none text-sm font-medium" type="number" value={item.cost} onChange={(e) => updateActionPlan(idx, { cost: parseFloat(e.target.value) || 0 })} /></td>
                                  <td className="p-2">
                                    <button onClick={() => removeActionPlanItem(idx)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button 
                            onClick={addActionPlanItem}
                            className="w-full p-4 text-indigo-600 font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={18} />
                            Adicionar Ação
                          </button>
                        </div>
                      </section>
                    </motion.div>
                  )}

                  {activePhase === 'DO' && (
                    <motion.div key="do" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
                      <PhaseSection title="Capacitação" value={activeCycle.do.training} onChange={(v) => updateCycle({ do: { ...activeCycle.do, training: v } })} />
                      <PhaseSection title="Execução" value={activeCycle.do.execution} onChange={(v) => updateCycle({ do: { ...activeCycle.do, execution: v } })} />
                      <PhaseSection title="Teste Piloto" value={activeCycle.do.pilotTest} onChange={(v) => updateCycle({ do: { ...activeCycle.do, pilotTest: v } })} />
                      <PhaseSection title="Status das Ações" value={activeCycle.do.actionStatus} onChange={(v) => updateCycle({ do: { ...activeCycle.do, actionStatus: v } })} />
                    </motion.div>
                  )}

                  {activePhase === 'CHECK' && (
                    <motion.div key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
                      <PhaseSection title="Indicadores de Resultado" value={activeCycle.check.indicators} onChange={(v) => updateCycle({ check: { ...activeCycle.check, indicators: v } })} />
                      <PhaseSection title="Comparação de Resultados" value={activeCycle.check.resultComparison} onChange={(v) => updateCycle({ check: { ...activeCycle.check, resultComparison: v } })} />
                      <PhaseSection title="Avaliação de Desvios" value={activeCycle.check.deviationEvaluation} onChange={(v) => updateCycle({ check: { ...activeCycle.check, deviationEvaluation: v } })} />
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-slate-800">Meta Atingida?</h5>
                          <p className="text-sm text-slate-500">Avaliação final do ciclo.</p>
                        </div>
                        <button 
                          onClick={() => updateCycle({ check: { ...activeCycle.check, goalMet: !activeCycle.check.goalMet } })}
                          className={cn(
                            "px-8 py-3 rounded-xl font-bold transition-all",
                            activeCycle.check.goalMet ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {activeCycle.check.goalMet ? "SIM" : "NÃO"}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {activePhase === 'ACT' && (
                    <motion.div key="act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
                      <PhaseSection title="Padronização" value={activeCycle.act.standardization} onChange={(v) => updateCycle({ act: { ...activeCycle.act, standardization: v } })} />
                      <PhaseSection title="Documentação" value={activeCycle.act.documentation} onChange={(v) => updateCycle({ act: { ...activeCycle.act, documentation: v } })} />
                      <PhaseSection title="Ação Corretiva" value={activeCycle.act.correctiveAction} onChange={(v) => updateCycle({ act: { ...activeCycle.act, correctiveAction: v } })} />
                      <PhaseSection title="Lições Aprendidas" value={activeCycle.act.lessonsLearned} onChange={(v) => updateCycle({ act: { ...activeCycle.act, lessonsLearned: v } })} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw size={64} className="mb-4 opacity-10" />
              <p className="text-xl font-bold">Nenhum ciclo selecionado</p>
              <p className="mt-2">Crie ou selecione um ciclo PDCA para começar.</p>
            </div>
          )}
        </div>
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
    const newItem: ActionPlanItem = { id: uuidv4(), what: '', why: '', where: '', who: '', when: '', how: '', cost: 0 };
    updatePlan({ actionPlan: [...activeCycle.plan.actionPlan, newItem] });
  }

  function removeActionPlanItem(idx: number) {
    if (!activeCycle) return;
    const newPlan = activeCycle.plan.actionPlan.filter((_, i) => i !== idx);
    updatePlan({ actionPlan: newPlan });
  }
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
