import re

with open('src/components/PDCAEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m_start = text.find('{activePlanStep === 3 && (')
m_end = text.find('{/* Step 4: Plano de Ação (5W2H) */}')

print('m_start:', m_start, 'm_end:', m_end)

new_step3 = '''{activePlanStep === 3 && (
                        <motion.section
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-8"
                        >
                          {(() => {
                            const impact = activeCycle.plan.impact;
                            const hasTangibleDetail =
                              (impact.tangibleFinancialLoss ?? 0) > 0 ||
                              (impact.tangibleWastedTime ?? 0) > 0 ||
                              !!impact.tangibleRework?.trim() ||
                              !!impact.tangibleOtherCosts?.trim() ||
                              (impact.value ?? 0) > 0;

                            const hasIntangibleDetail =
                              !!impact.intangibleCustomerImpact?.trim() ||
                              !!impact.intangibleQualityImpact?.trim() ||
                              !!impact.intangibleRiskImpact?.trim() ||
                              !!impact.intangibleTeamImpact?.trim();

                            return (
                              <div className="bg-theme-card p-10 rounded-[2.5rem] border border-theme-border shadow-sm space-y-12">
                                <SectionHeader
                                  number="3"
                                  title="Impacto do Problema"
                                />

                                {/* Orientação */}
                                <div className="space-y-8">
                                  <div className="p-5 bg-indigo-50/80 border border-indigo-100/80 rounded-2xl flex items-start gap-3">
                                    <HelpCircle
                                      className="text-indigo-600 shrink-0 mt-0.5"
                                      size={18}
                                    />
                                    <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                                      <strong>Orientação:</strong> O Tipo de Impacto, Detalhamento do Impacto e Descrição Geral do Impacto são preenchimentos obrigatórios. Apenas as Metas Estruturadas (Ganhos Esperados) são opcionais.
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-3 pb-2 border-b border-theme-border">
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                                      <RefreshCw size={18} />
                                    </div>
                                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-700">
                                      1. Impacto Atual
                                    </h4>
                                  </div>

                                  <div className="space-y-6">
                                    {/* Tipo de Impacto */}
                                    <div className="space-y-3">
                                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Target size={14} className="text-indigo-500" />
                                        Tipo de Impacto{" "}
                                        <span className="text-rose-500 font-bold">* (Obrigatório)</span>
                                      </label>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
                                        {(["Tangível", "Intangível", "Ambos"] as const).map((type) => {
                                          const isSelected = activeCycle.plan.impact.impactType === type;
                                          return (
                                            <button
                                              key={type}
                                              type="button"
                                              onClick={() =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    impactType: type,
                                                  },
                                                })
                                              }
                                              className={cn(
                                                "p-4 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all text-center cursor-pointer",
                                                isSelected
                                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                                  : "bg-theme-background border-theme-border text-slate-500 hover:bg-slate-50",
                                                showValidationErrors &&
                                                  !activeCycle.plan.impact.impactType &&
                                                  "ring-2 ring-rose-500 border-rose-300 bg-rose-50/50"
                                              )}
                                            >
                                              {type}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {showValidationErrors && !activeCycle.plan.impact.impactType && (
                                        <p className="text-xs font-bold text-rose-500">
                                          Selecione o tipo de impacto.
                                        </p>
                                      )}
                                    </div>

                                    {/* Bloco Impacto Tangível */}
                                    {(activeCycle.plan.impact.impactType === "Tangível" ||
                                      activeCycle.plan.impact.impactType === "Ambos") && (
                                      <div
                                        className={cn(
                                          "p-6 bg-slate-50/80 rounded-3xl border space-y-4 animate-in fade-in duration-300 transition-all",
                                          showValidationErrors && !hasTangibleDetail
                                            ? "border-rose-400 bg-rose-50/40 ring-2 ring-rose-300"
                                            : "border-slate-200/80"
                                        )}
                                      >
                                        <div className="flex items-center justify-between flex-wrap gap-2 text-slate-700">
                                          <div className="flex items-center gap-2">
                                            <Zap size={16} className="text-amber-500" />
                                            <span className="text-xs font-black uppercase tracking-widest">
                                              Detalhamento do Impacto Tangível{" "}
                                              <span className="text-rose-500 font-bold">* (Obrigatório ao menos 1 campo)</span>
                                            </span>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Perda financeira estimada (R$)
                                            </label>
                                            <input
                                              type="number"
                                              placeholder="0.00"
                                              value={activeCycle.plan.impact.tangibleFinancialLoss ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    tangibleFinancialLoss: parseFloat(e.target.value) || 0,
                                                    value: parseFloat(e.target.value) || activeCycle.plan.impact.value || 0,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Tempo desperdiçado (horas/mês)
                                            </label>
                                            <input
                                              type="number"
                                              placeholder="0"
                                              value={activeCycle.plan.impact.tangibleWastedTime ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    tangibleWastedTime: parseFloat(e.target.value) || 0,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Retrabalho (horas ou %)
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Ex: 15 horas ou 20%"
                                              value={activeCycle.plan.impact.tangibleRework ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    tangibleRework: e.target.value,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Outros custos
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Ex: Desperdício de insumos, multas"
                                              value={activeCycle.plan.impact.tangibleOtherCosts ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    tangibleOtherCosts: e.target.value,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                        </div>
                                        {showValidationErrors && !hasTangibleDetail && (
                                          <p className="text-xs font-bold text-rose-500 pt-1">
                                            Preencha ao menos uma informação do impacto tangível (Perda financeira, Tempo, Retrabalho ou Outros custos).
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* Bloco Impacto Intangível */}
                                    {(activeCycle.plan.impact.impactType === "Intangível" ||
                                      activeCycle.plan.impact.impactType === "Ambos") && (
                                      <div
                                        className={cn(
                                          "p-6 bg-slate-50/80 rounded-3xl border space-y-4 animate-in fade-in duration-300 transition-all",
                                          showValidationErrors && !hasIntangibleDetail
                                            ? "border-rose-400 bg-rose-50/40 ring-2 ring-rose-300"
                                            : "border-slate-200/80"
                                        )}
                                      >
                                        <div className="flex items-center justify-between flex-wrap gap-2 text-slate-700">
                                          <div className="flex items-center gap-2">
                                            <Award size={16} className="text-indigo-500" />
                                            <span className="text-xs font-black uppercase tracking-widest">
                                              Detalhamento do Impacto Intangível{" "}
                                              <span className="text-rose-500 font-bold">* (Obrigatório ao menos 1 campo)</span>
                                            </span>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Impacto no cliente
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Ex: Reclamações frequentes, insatisfação"
                                              value={activeCycle.plan.impact.intangibleCustomerImpact ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    intangibleCustomerImpact: e.target.value,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Impacto na qualidade
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Ex: Riscos de desvio de padrão"
                                              value={activeCycle.plan.impact.intangibleQualityImpact ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    intangibleQualityImpact: e.target.value,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Impacto em risco
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Ex: Risco de não conformidade ou segurança"
                                              value={activeCycle.plan.impact.intangibleRiskImpact ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    intangibleRiskImpact: e.target.value,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Impacto na equipe
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Ex: Desmotivação, sobrecarga"
                                              value={activeCycle.plan.impact.intangibleTeamImpact ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    intangibleTeamImpact: e.target.value,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                          </div>
                                        </div>
                                        {showValidationErrors && !hasIntangibleDetail && (
                                          <p className="text-xs font-bold text-rose-500 pt-1">
                                            Preencha ao menos uma informação do impacto intangível (Cliente, Qualidade, Risco ou Equipe).
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* Bloco Ganho Esperado (Metas Estruturadas - OPCIONAL) */}
                                    <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 space-y-4">
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2 text-emerald-800">
                                          <TrendingUp size={16} className="text-emerald-600" />
                                          <span className="text-xs font-black uppercase tracking-widest">
                                            Ganho Esperado (Metas Estruturadas)
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 bg-white/80 px-3 py-1 rounded-full border border-emerald-200/80 shadow-xs">
                                          Ganhos esperados são opcionais
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {activeCycle.plan.impact.impactType !== "Intangível" && (
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              Redução de custo estimada (R$)
                                            </label>
                                            <input
                                              type="number"
                                              placeholder="0.00 (opcional)"
                                              value={activeCycle.plan.impact.expectedCostReduction ?? ""}
                                              onChange={(e) =>
                                                updatePlan({
                                                  impact: {
                                                    ...activeCycle.plan.impact,
                                                    expectedCostReduction: parseFloat(e.target.value) || 0,
                                                  },
                                                })
                                              }
                                              className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                          </div>
                                        )}
                                        <div className="space-y-2">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Ganho de tempo (horas/mês)
                                          </label>
                                          <input
                                            type="number"
                                            placeholder="0 (opcional)"
                                            value={activeCycle.plan.impact.expectedTimeGain ?? ""}
                                            onChange={(e) =>
                                              updatePlan({
                                                impact: {
                                                  ...activeCycle.plan.impact,
                                                  expectedTimeGain: parseFloat(e.target.value) || 0,
                                                },
                                              })
                                            }
                                            className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Melhoria percentual de indicador (%)
                                          </label>
                                          <input
                                            type="number"
                                            placeholder="0 (opcional)"
                                            value={activeCycle.plan.impact.expectedIndicatorImprovement ?? ""}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value) || 0;
                                              updatePlan({
                                                impact: {
                                                  ...activeCycle.plan.impact,
                                                  expectedIndicatorImprovement: val,
                                                  improvementPercentage: val || activeCycle.plan.impact.improvementPercentage,
                                                },
                                              });
                                            }}
                                            className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Outros ganhos
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="Ex: Melhoria do clima (opcional)"
                                            value={activeCycle.plan.impact.expectedOtherGains ?? ""}
                                            onChange={(e) =>
                                              updatePlan({
                                                impact: {
                                                  ...activeCycle.plan.impact,
                                                  expectedOtherGains: e.target.value,
                                                },
                                              })
                                            }
                                            className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Descrição Geral do Impacto (Obrigatório) */}
                                    <div className="space-y-4 pt-4 border-t border-theme-border">
                                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={14} className="text-indigo-500" />
                                        Descrição Geral do Impacto{" "}
                                        <span className="text-rose-500 font-bold">* (Obrigatório)</span>
                                      </label>
                                      <textarea
                                        placeholder="Descreva detalhadamente o prejuízo ou problema atual..."
                                        value={activeCycle.plan.impact.description || ""}
                                        onChange={(e) =>
                                          updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              description: e.target.value,
                                            },
                                          })
                                        }
                                        className={cn(
                                          "w-full p-6 bg-theme-background border border-theme-border rounded-[2rem] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-theme-foreground min-h-[120px] transition-all",
                                          showValidationErrors &&
                                            !activeCycle.plan.impact.description?.trim() &&
                                            "ring-2 ring-rose-500 border-rose-300 bg-rose-50/50"
                                        )}
                                      />
                                      {showValidationErrors && !activeCycle.plan.impact.description?.trim() && (
                                        <p className="text-xs font-bold text-rose-500">
                                          A Descrição Geral do Impacto é obrigatória.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </motion.section>
                      )}
                      '''

new_text = text[:m_start] + new_step3 + text[m_end:]

with open('src/components/PDCAEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Done replacing Step 3!')
