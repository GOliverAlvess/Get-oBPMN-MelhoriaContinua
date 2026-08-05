import sys

rest_code = '''
                      {/* Step 4: Plano de Ação (5W2H) */}
                      {activePlanStep === 4 && (
                        <motion.section
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-8"
                        >
                          <div className="bg-theme-card p-10 rounded-[2.5rem] border border-theme-border shadow-sm space-y-8">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <SectionHeader
                                number="4"
                                title="Plano de Ação (5W2H)"
                              />
                              <button
                                type="button"
                                onClick={handleAddActionPlanItem}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 cursor-pointer"
                              >
                                <Plus size={16} />
                                Nova Ação
                              </button>
                            </div>

                            {activeCycle.plan.actionPlan.length === 0 ? (
                              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
                                <GitBranch className="mx-auto text-slate-300" size={40} />
                                <p className="text-sm font-bold text-slate-500">
                                  Nenhuma ação cadastrada no Plano de Ação.
                                </p>
                                <p className="text-xs text-slate-400 max-w-md mx-auto">
                                  Clique no botão "Nova Ação" acima para formular contramedidas 5W2H para a causa raiz identificada.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {activeCycle.plan.actionPlan.map((item, index) => (
                                  <div
                                    key={item.id}
                                    className="p-6 bg-slate-50/80 rounded-3xl border border-slate-200/80 space-y-6 transition-all hover:border-slate-300"
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                                      <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                                          #{index + 1}
                                        </span>
                                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                          {item.what || "Nova Ação"}
                                        </h5>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteActionPlanItem(item.id)}
                                        className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-xl hover:bg-rose-50"
                                        title="Excluir Ação"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>

                                    {/* Campos 5W2H */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          O quê (Ação) *
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Treinar equipe técnica"
                                          value={item.what || ""}
                                          onChange={(e) =>
                                            handleUpdateActionPlanItem(item.id, { what: e.target.value })
                                          }
                                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          Por quê (Justificativa)
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Eliminar erro operacional"
                                          value={item.why || ""}
                                          onChange={(e) =>
                                            handleUpdateActionPlanItem(item.id, { why: e.target.value })
                                          }
                                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          Onde (Local)
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Setor de montagem"
                                          value={item.where || ""}
                                          onChange={(e) =>
                                            handleUpdateActionPlanItem(item.id, { where: e.target.value })
                                          }
                                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          Quando (Prazo) *
                                        </label>
                                        <input
                                          type="date"
                                          value={item.when || ""}
                                          onChange={(e) =>
                                            handleUpdateActionPlanItem(item.id, { when: e.target.value })
                                          }
                                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          Quem (Responsável) *
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Carlos Silva"
                                          value={item.who || ""}
                                          onChange={(e) =>
                                            handleUpdateActionPlanItem(item.id, { who: e.target.value })
                                          }
                                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          Como (Método)
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Workshop presencial"
                                          value={item.how || ""}
                                          onChange={(e) =>
                                            handleUpdateActionPlanItem(item.id, { how: e.target.value })
                                          }
                                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      <div className="space-y-1 sm:col-span-2 md:col-span-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          Quanto Custa (Custo R$)
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Ex: R$ 500,00 ou R$ 0,00"
                                          value={item.howMuch || ""}
                                          onChange={(e) =>
                                            handleUpdateActionPlanItem(item.id, { howMuch: e.target.value })
                                          }
                                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.section>
                      )}

                      {/* Botões de Navegação das Etapas do PLAN */}
                      <div className="flex items-center justify-between pt-6 border-t border-theme-border">
                        <button
                          type="button"
                          disabled={activePlanStep === 1}
                          onClick={() => handleStepChange(activePlanStep - 1)}
                          className={cn(
                            "flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-theme-border hover:bg-theme-card",
                            activePlanStep === 1 ? "opacity-0 invisible" : "opacity-100 cursor-pointer"
                          )}
                        >
                          <ArrowLeft size={18} />
                          Anterior
                        </button>

                        {activePlanStep < 4 ? (
                          <button
                            type="button"
                            onClick={() => handleStepChange(activePlanStep + 1)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all group cursor-pointer"
                          >
                            Próximo Passo
                            <ChevronRight
                              size={18}
                              className="group-hover:translate-x-1 transition-transform"
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!isPlanPhaseValid) {
                                setSaveFeedback("Preencha todos os campos obrigatórios da etapa PLAN para avançar para o DO.");
                                setShowValidationErrors(true);
                                return;
                              }
                              handlePhaseChange("DO");
                            }}
                            className={cn(
                              "flex items-center gap-2 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all group cursor-pointer",
                              isPlanPhaseValid
                                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                            )}
                          >
                            Avançar para DO
                            <ArrowRight
                              size={18}
                              className="group-hover:translate-x-1 transition-transform"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* --- ETAPA DO --- */}
                {activePhase === "DO" && (
                  <motion.div
                    key="do"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div className="bg-theme-card p-10 rounded-[2.5rem] border border-theme-border shadow-sm space-y-8">
                      <SectionHeader
                        number="DO"
                        title="Execução do Plano de Ação"
                        subtitle="Acompanhe o andamento e registre os dados de execução das ações planejadas"
                      />

                      {activeCycle.plan.actionPlan.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">
                          Nenhuma ação definida na etapa PLAN.
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {activeCycle.plan.actionPlan.map((item, index) => (
                            <div
                              key={item.id}
                              className="p-6 bg-slate-50/80 rounded-3xl border border-slate-200/80 space-y-6"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                                    #{index + 1}
                                  </span>
                                  <div>
                                    <h5 className="text-sm font-black text-slate-800">
                                      {item.what}
                                    </h5>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                      Responsável: {item.who || "Não definido"} | Prazo: {item.when || "Não definido"}
                                    </p>
                                  </div>
                                </div>

                                {/* Status Toggle */}
                                <div className="flex items-center gap-2">
                                  {(["Pendente", "Em andamento", "Concluído", "Cancelado"] as const).map((st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() =>
                                        handleUpdateActionPlanItem(item.id, {
                                          status: st,
                                          currentPhase: st === "Concluído" ? "CHECK" : item.currentPhase || "DO",
                                        })
                                      }
                                      className={cn(
                                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                        item.status === st
                                          ? st === "Concluído"
                                            ? "bg-emerald-600 text-white shadow-sm"
                                            : st === "Em andamento"
                                            ? "bg-amber-500 text-white shadow-sm"
                                            : st === "Cancelado"
                                            ? "bg-rose-600 text-white shadow-sm"
                                            : "bg-slate-700 text-white shadow-sm"
                                          : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                                      )}
                                    >
                                      {st}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Observações da Execução
                                  </label>
                                  <textarea
                                    placeholder="Registre detalhes do andamento ou imprevistos..."
                                    value={item.observations || ""}
                                    onChange={(e) =>
                                      handleUpdateActionPlanItem(item.id, { observations: e.target.value })
                                    }
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                                  />
                                </div>

                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      Data de Início Real
                                    </label>
                                    <input
                                      type="date"
                                      value={item.startDate || ""}
                                      onChange={(e) =>
                                        handleUpdateActionPlanItem(item.id, { startDate: e.target.value })
                                      }
                                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      Data de Conclusão Real
                                    </label>
                                    <input
                                      type="date"
                                      value={item.endDate || ""}
                                      onChange={(e) =>
                                        handleUpdateActionPlanItem(item.id, { endDate: e.target.value })
                                      }
                                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botão Avançar para CHECK */}
                      <div className="flex justify-end pt-6 border-t border-slate-200">
                        <button
                          type="button"
                          disabled={!isDoPhaseValid}
                          onClick={() => handlePhaseChange("CHECK")}
                          className={cn(
                            "flex items-center gap-2 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer",
                            isDoPhaseValid
                              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                          )}
                        >
                          Avançar para CHECK
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* --- ETAPA CHECK --- */}
                {activePhase === "CHECK" && (
                  <motion.div
                    key="check"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    {/* TOP: Verificação de Resultados das Ações */}
                    <div className="bg-theme-card p-10 rounded-[2.5rem] border border-theme-border shadow-sm space-y-8">
                      <SectionHeader
                        number="CHECK"
                        title="Verificação de Resultados"
                        subtitle="Acompanhe os resultados e meça a efetividade das ações executadas"
                      />

                      {activeCycle.plan.actionPlan.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">
                          Nenhuma ação disponível para acompanhamento.
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {activeCycle.plan.actionPlan.map((item, index) => (
                            <div
                              key={item.id}
                              className="p-6 bg-slate-50/80 rounded-3xl border border-slate-200/80 space-y-6"
                            >
                              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                                    #{index + 1}
                                  </span>
                                  <div>
                                    <h5 className="text-sm font-black text-slate-800">
                                      {item.what}
                                    </h5>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                      Status DO: {item.status} | Responsável: {item.who || "N/I"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Acompanhamento */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Modo de Acompanhamento
                                  </label>
                                  <select
                                    value={item.monitoringMode || "Dias"}
                                    onChange={(e) =>
                                      handleUpdateActionPlanItem(item.id, {
                                        monitoringMode: e.target.value as "Dias" | "Semanas" | "Meses",
                                      })
                                    }
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    <option value="Dias">Dias</option>
                                    <option value="Semanas">Semanas</option>
                                    <option value="Meses">Meses</option>
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Período de Acompanhamento
                                  </label>
                                  <input
                                    type="number"
                                    placeholder="Ex: 30"
                                    value={item.monitoringPeriod ?? ""}
                                    onChange={(e) =>
                                      handleUpdateActionPlanItem(item.id, {
                                        monitoringPeriod: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Funcionou? (Ação foi efetiva?)
                                  </label>
                                  <select
                                    value={item.worked || ""}
                                    onChange={(e) =>
                                      handleUpdateActionPlanItem(item.id, {
                                        worked: e.target.value as "Sim" | "Não" | "Parcial",
                                      })
                                    }
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    <option value="">Selecione...</option>
                                    <option value="Sim">Sim</option>
                                    <option value="Parcial">Parcial</option>
                                    <option value="Não">Não</option>
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Observações do Período de Acompanhamento
                                </label>
                                <textarea
                                  placeholder="Observações adicionais do acompanhamento..."
                                  value={item.monitoringTool || ""}
                                  onChange={(e) =>
                                    handleUpdateActionPlanItem(item.id, {
                                      monitoringTool: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[70px]"
                                />
                              </div>

                              {(item.worked === "Não" || item.worked === "Parcial") && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                                    Justificativa da Falha / Resultado Parcial *
                                  </label>
                                  <textarea
                                    placeholder="Explique por que a ação não funcionou conforme o esperado..."
                                    value={item.failureReason || ""}
                                    onChange={(e) =>
                                      handleUpdateActionPlanItem(item.id, {
                                        failureReason: e.target.value,
                                      })
                                    }
                                    className="w-full p-3 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-medium text-rose-900 outline-none focus:ring-2 focus:ring-rose-500 min-h-[70px]"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* BOTTOM: Vínculo com Planejamento & Medição de Ganhos */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 space-y-8">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <TrendingUp size={20} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                            Vínculo com Planejamento & Medição de Ganhos
                          </h3>
                          <p className="text-xs text-slate-500">
                            Compare os resultados reais obtidos com o planejamento e conclua a verificação
                          </p>
                        </div>
                      </div>

                      {/* 1. Resultados Obtidos (Resultados Reais) */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                          <Zap size={14} className="text-amber-500" />
                          1. Resultados Reais Obtidos
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Redução de Custo Real (R$)
                            </label>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={activeCycle.check?.realCostReduction ?? ""}
                              onChange={(e) =>
                                updateCycle({
                                  check: {
                                    ...activeCycle.check,
                                    realCostReduction: parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Ganho de Tempo Real (horas/mês)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={activeCycle.check?.realTimeGain ?? ""}
                              onChange={(e) =>
                                updateCycle({
                                  check: {
                                    ...activeCycle.check,
                                    realTimeGain: parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Resultado de Indicador (%)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={activeCycle.check?.realIndicatorResult ?? ""}
                              onChange={(e) =>
                                updateCycle({
                                  check: {
                                    ...activeCycle.check,
                                    realIndicatorResult: parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Observações dos Resultados Reais
                          </label>
                          <textarea
                            placeholder="Anote detalhes dos resultados obtidos..."
                            value={activeCycle.check?.realResultNotes || ""}
                            onChange={(e) =>
                              updateCycle({
                                check: {
                                  ...activeCycle.check,
                                  realResultNotes: e.target.value,
                                },
                              })
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[70px]"
                          />
                        </div>
                      </div>

                      {/* 2. Comparação com Planejamento */}
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          2. Comparação com o Planejado (PLAN)
                        </h4>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-slate-600">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Custo Planejado vs Real</span>
                            <p className="font-bold text-slate-800">
                              R$ {activeCycle.plan.impact.expectedCostReduction || 0} vs R$ {activeCycle.check?.realCostReduction || 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Tempo Planejado vs Real</span>
                            <p className="font-bold text-slate-800">
                              {activeCycle.plan.impact.expectedTimeGain || 0}h vs {activeCycle.check?.realTimeGain || 0}h
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Indicador Planejado vs Real</span>
                            <p className="font-bold text-slate-800">
                              {activeCycle.plan.impact.expectedIndicatorImprovement || 0}% vs {activeCycle.check?.realIndicatorResult || 0}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 3. Conclusão */}
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                            3. Conclusão
                          </span>
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-black text-slate-600 uppercase tracking-widest block">
                            O ganho esperado foi atingido? <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-3 max-w-md">
                            {(["Sim", "Parcial", "Não"] as const).map((status) => {
                              const isSelected = activeCycle.check?.expectedGainAchieved === status;
                              return (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() =>
                                    updateCycle({
                                      check: {
                                        ...activeCycle.check,
                                        expectedGainAchieved: status,
                                      },
                                    })
                                  }
                                  className={cn(
                                    "p-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all text-center cursor-pointer",
                                    isSelected
                                      ? status === "Sim"
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                        : status === "Parcial"
                                        ? "bg-amber-500 text-white border-amber-500 shadow-md"
                                        : "bg-rose-600 text-white border-rose-600 shadow-md"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                  )}
                                >
                                  {status}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Botão Avançar para ACT */}
                      <div className="pt-6 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          disabled={!isVinculoValid}
                          onClick={() => {
                            if (!isVinculoValid) {
                              setSaveFeedback(
                                "Preencha a Seção '3. Conclusão' do Vínculo com Planejamento para avançar para a etapa ACT."
                              );
                              setShowValidationErrors(true);
                              return;
                            }
                            const updatedActionPlan = (activeCycle.plan.actionPlan || []).map((i) => ({
                              ...i,
                              currentPhase: i.currentPhase === "CHECK" || !i.currentPhase ? "ACT" : i.currentPhase,
                            }));
                            updateCycle({
                              plan: {
                                ...activeCycle.plan,
                                actionPlan: updatedActionPlan,
                              },
                              etapaAtual: "ACT",
                            });
                            setActivePhase("ACT");
                          }}
                          className={cn(
                            "flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer",
                            isVinculoValid
                              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                          )}
                        >
                          Avançar para ACT
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* --- ETAPA ACT --- */}
                {activePhase === "ACT" && (
                  <motion.div
                    key="act"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div className="bg-theme-card p-10 rounded-[2.5rem] border border-theme-border shadow-sm space-y-8">
                      <SectionHeader
                        number="ACT"
                        title="Ação Corretiva & Padronização"
                        subtitle="Defina ações de padronização para manter o ganho ou inicie um novo ciclo"
                      />

                      <div className="space-y-6">
                        <div className="p-6 bg-slate-50/80 rounded-3xl border border-slate-200/80 space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">
                            Status Final do Problema
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                            {(["Resolvido", "Não resolvido"] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => {
                                  const updatedActionPlan = (activeCycle.plan.actionPlan || []).map((i) => ({
                                    ...i,
                                    finalProblemStatus: st,
                                  }));
                                  updateCycle({
                                    plan: {
                                      ...activeCycle.plan,
                                      actionPlan: updatedActionPlan,
                                    },
                                  });
                                }}
                                className={cn(
                                  "p-4 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all text-center cursor-pointer",
                                  activeCycle.plan.actionPlan[0]?.finalProblemStatus === st
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                )}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Finalizar Ciclo */}
                      <div className="flex justify-end pt-6 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            updateCycle({
                              status: "Concluído",
                              etapaAtual: "REPORT",
                            });
                            setActivePhase("REPORT");
                            setSaveFeedback("Ciclo PDCA concluído com sucesso!");
                          }}
                          className="flex items-center gap-2 bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all cursor-pointer"
                        >
                          <CheckCircle2 size={18} />
                          Concluir Ciclo PDCA
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* --- ETAPA REPORT --- */}
                {activePhase === "REPORT" && (
                  <motion.div
                    key="report"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div className="bg-theme-card p-10 rounded-[2.5rem] border border-theme-border shadow-sm space-y-8">
                      <SectionHeader
                        number="REPORT"
                        title="Relatório Consolidado do Ciclo PDCA"
                        subtitle="Visão geral e fechamento do ciclo de melhoria contínua"
                      />

                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200/80 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">
                          Resumo do Ciclo: {activeCycle.title}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-slate-600">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Status</span>
                            <span className="font-bold text-emerald-600">{activeCycle.status}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Total de Ações</span>
                            <span className="font-bold text-slate-800">{activeCycle.plan.actionPlan.length}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Ganho Atingido</span>
                            <span className="font-bold text-slate-800">{activeCycle.check?.expectedGainAchieved || "Não informado"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDCAEditor;
'''

with open('src/components/PDCAEditor.tsx', 'a', encoding='utf-8') as f:
    f.write(rest_code)

print('Successfully appended rest of PDCAEditor.tsx!')
