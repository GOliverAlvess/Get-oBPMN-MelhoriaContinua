import React from 'react';
import { Plus, Trash2, TrendingUp, HelpCircle } from 'lucide-react';
import { GainsStructure, TangibleGain, IntangibleGain, GlobalConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';

interface GainsEditorProps {
  title?: string;
  gains: GainsStructure;
  onChange: (gains: GainsStructure) => void;
  variant?: 'plan' | 'production' | 'check';
  tangibleTypes?: string[];
  intangibleTypes?: string[];
  globalConfig?: GlobalConfig;
  inheritedGains?: GainsStructure;
  isReadOnly?: boolean;
}

export default function GainsEditor({ 
  title, 
  gains, 
  onChange, 
  variant = 'plan',
  tangibleTypes = [],
  intangibleTypes = [],
  globalConfig,
  inheritedGains,
  isReadOnly = false
}: GainsEditorProps) {
  const isProductionOverride = variant === 'production' && inheritedGains;

  // Use inherited gains if in production mode to define the structure
  const effectiveTangible = isProductionOverride 
    ? (inheritedGains?.tangible || []).map(inherited => {
        const existing = gains.tangible.find(t => t.type === inherited.type);
        return {
          ...inherited,
          value: existing?.value || 0,
          id: inherited.id // Keep inherited ID or existing? Inherited ID is safer for consistency
        };
      })
    : (gains.tangible || []);

  const effectiveIntangible = (isProductionOverride
    ? (inheritedGains?.intangible || []).map(inherited => {
        const existing = (gains.intangible || []).find(i => i.type === inherited.type);
        return {
          ...inherited,
          impactLevel: (existing?.impactLevel || '') as any,
          id: inherited.id
        };
      })
    : (gains.intangible || [])) as IntangibleGain[];

  const addTangible = () => {
    if (isProductionOverride) return;
    const newTangible: TangibleGain = {
      id: uuidv4(),
      type: '',
      value: 0,
      unit: ''
    };
    onChange({
      ...gains,
      tangible: [...(gains.tangible || []), newTangible]
    });
  };

  const updateTangible = (id: string, updates: Partial<TangibleGain>) => {
    let newTangible: TangibleGain[];
    if (isProductionOverride) {
      newTangible = effectiveTangible.map(t => t.id === id ? { ...t, ...updates } : t);
    } else {
      newTangible = (gains.tangible || []).map(t => {
        if (t.id === id) {
          const updated = { ...t, ...updates };
          
          // If type changed, check for units in configuration
          if (updates.type && globalConfig?.structuredTangibleGains) {
            const configGain = globalConfig.structuredTangibleGains.find(g => g.name === updates.type) as any;
            const availableUnits = configGain?.units || (configGain?.unit ? [configGain.unit] : []);
            
            if (availableUnits.length > 0) {
              if (availableUnits.length === 1) {
                updated.unit = availableUnits[0];
              } else {
                // If multiple units, clear if current unit is not in the new type's allowed units
                if (!availableUnits.includes(t.unit)) {
                  updated.unit = '';
                }
              }
            }
          }
          return updated;
        }
        return t;
      });
    }
    onChange({ ...gains, tangible: newTangible });
  };

  const removeTangible = (id: string) => {
    if (isProductionOverride) return;
    onChange({ ...gains, tangible: (gains.tangible || []).filter(t => t.id !== id) });
  };

  const addIntangible = () => {
    if (isProductionOverride) return;
    const newIntangible: IntangibleGain = {
      id: uuidv4(),
      type: '',
      description: '',
      impactLevel: ''
    };
    onChange({
      ...gains,
      intangible: [...(gains.intangible || []), newIntangible]
    });
  };

  const updateIntangible = (id: string, updates: Partial<IntangibleGain>) => {
    let newIntangible: IntangibleGain[];
    if (isProductionOverride) {
      newIntangible = effectiveIntangible.map(t => t.id === id ? { ...t, ...updates } : t);
    } else {
      newIntangible = (gains.intangible || []).map(t => t.id === id ? { ...t, ...updates } : t);
    }
    onChange({ ...gains, intangible: newIntangible });
  };

  const removeIntangible = (id: string) => {
    if (isProductionOverride) return;
    onChange({ ...gains, intangible: (gains.intangible || []).filter(i => i.id !== id) });
  };

  const labelColor = variant === 'check' ? 'text-emerald-600' : 'text-indigo-600';
  const bgColor = variant === 'check' ? 'bg-emerald-50/50' : 'bg-slate-50/50';
  const borderColor = variant === 'check' ? 'border-emerald-100' : 'border-slate-100';

  return (
    <div className="space-y-8">
      {title && (
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", variant === 'check' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600")}>
            <TrendingUp size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h3>
        </div>
      )}

      {/* Tangible Gains */}
      <div className={cn("p-6 rounded-[2rem] border transition-all", bgColor, borderColor)}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Ganhos Tangíveis</h4>
          </div>
          {!isProductionOverride && (
            <button 
              onClick={addTangible}
              disabled={isReadOnly}
              className={cn(
                "flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm",
                isReadOnly && "opacity-50 cursor-not-allowed"
              )}
            >
              <Plus size={14} />
              Adicionar Ganho
            </button>
          )}
        </div>

        <div className="space-y-4">
          {(effectiveTangible.length === 0) ? (
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
              Nenhum ganho tangível registrado
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {effectiveTangible.map((t) => (
                <div key={t.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm items-end relative group">
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tipo de Ganho</label>
                    <select 
                      disabled={isProductionOverride}
                      value={t.type}
                      onChange={(e) => updateTangible(t.id, { type: e.target.value as any })}
                      className={cn(
                        "w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none transition-all",
                        isProductionOverride ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-75" : "bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      )}
                    >
                      <option value="">Selecione...</option>
                      {((globalConfig?.structuredTangibleGains?.filter(g => g.active).map(g => g.name)) || tangibleTypes).length > 0 ? (
                        ((globalConfig?.structuredTangibleGains?.filter(g => g.active).map(g => g.name)) || tangibleTypes).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))
                      ) : (
                        <>
                          <option value="Redução de custo">Redução de custo</option>
                          <option value="Aumento de receita">Aumento de receita</option>
                          <option value="Economia de tempo">Economia de tempo</option>
                          <option value="Redução de retrabalho">Redução de retrabalho</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Valor {isProductionOverride ? 'Realizado' : ''}</label>
                    <input 
                      type="number"
                      value={t.value}
                      onChange={(e) => updateTangible(t.id, { value: parseFloat(e.target.value) || 0 })}
                      disabled={isReadOnly}
                      className={cn(
                        "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono",
                        isReadOnly && "opacity-50 cursor-not-allowed"
                      )}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Unidade</label>
                    {(() => {
                      const configGain = globalConfig?.structuredTangibleGains?.find(g => g.name === t.type) as any;
                      const availableUnits = configGain?.units || (configGain?.unit ? [configGain.unit] : []);
                      const isDisabled = isProductionOverride || availableUnits.length <= 1;

                      return (
                        <select 
                          disabled={isDisabled}
                          value={t.unit}
                          onChange={(e) => updateTangible(t.id, { unit: e.target.value as any })}
                          className={cn(
                            "w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none transition-all",
                            isDisabled 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                              : "bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          )}
                        >
                          <option value="">Selecione...</option>
                          {availableUnits.length > 0 ? (
                            availableUnits.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))
                          ) : (
                            <>
                              <option value="R$">R$ (Real)</option>
                              <option value="%">% (Percentual)</option>
                              <option value="horas">Horas</option>
                            </>
                          )}
                        </select>
                      );
                    })()}
                  </div>
                  {!isProductionOverride && (
                    <div className="md:col-span-2 flex justify-end">
                      <button 
                        onClick={() => removeTangible(t.id)}
                        disabled={isReadOnly}
                        className={cn(
                          "w-10 h-10 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl flex items-center justify-center transition-all border border-slate-100",
                          isReadOnly && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Intangible Gains */}
      <div className={cn("p-6 rounded-[2rem] border transition-all", bgColor, borderColor)}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Ganhos Intangíveis</h4>
          </div>
          {!isProductionOverride && (
            <button 
              onClick={addIntangible}
              disabled={isReadOnly}
              className={cn(
                "flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm",
                isReadOnly && "opacity-50 cursor-not-allowed"
              )}
            >
              <Plus size={14} />
              Adicionar Ganho
            </button>
          )}
        </div>

        <div className="space-y-4">
          {(effectiveIntangible.length === 0) ? (
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
              Nenhum ganho intangível registrado
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {effectiveIntangible.map((i) => (
                <div key={i.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm items-end relative group">
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tipo de Ganho</label>
                    <select 
                      disabled={isProductionOverride}
                      value={i.type}
                      onChange={(e) => updateIntangible(i.id, { type: e.target.value as any })}
                      className={cn(
                        "w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none transition-all",
                        isProductionOverride ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-75" : "bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      )}
                    >
                      <option value="">Selecione...</option>
                      {((globalConfig?.structuredIntangibleGains?.filter(g => g.active).map(g => g.name)) || intangibleTypes).length > 0 ? (
                        ((globalConfig?.structuredIntangibleGains?.filter(g => g.active).map(g => g.name)) || intangibleTypes).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))
                      ) : (
                        <>
                          <option value="Qualidade">Qualidade</option>
                          <option value="Satisfação do cliente">Satisfação do cliente</option>
                          <option value="Redução de risco">Redução de risco</option>
                          <option value="Engajamento">Engajamento</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Descrição</label>
                    <input 
                      type="text"
                      readOnly={isProductionOverride}
                      value={i.description}
                      onChange={(e) => updateIntangible(i.id, { description: e.target.value })}
                      placeholder="Descreva o ganho qualitativo..."
                      className={cn(
                        "w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none transition-all",
                        isProductionOverride ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500"
                      )}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Impacto</label>
                    <select 
                      value={i.impactLevel}
                      onChange={(e) => updateIntangible(i.id, { impactLevel: e.target.value as any })}
                      disabled={isReadOnly}
                      className={cn(
                        "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer",
                        isReadOnly && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <option value="">Selecione...</option>
                      <option value="Baixo">Baixo</option>
                      <option value="Médio">Médio</option>
                      <option value="Alto">Alto</option>
                    </select>
                  </div>
                  {!isProductionOverride && (
                    <div className="md:col-span-2 flex justify-end">
                      <button 
                        onClick={() => removeIntangible(i.id)}
                        disabled={isReadOnly}
                        className={cn(
                          "w-10 h-10 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl flex items-center justify-center transition-all border border-slate-100",
                          isReadOnly && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
