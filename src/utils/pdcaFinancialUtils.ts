import { PDCACycle, Project } from '../types';

export type FinancialResultType = 'Único' | 'Recorrente';
export type FinancialPeriodicity = 'Mensal' | 'Anual' | 'Outro';

export interface PDCAFinancialResult {
  hasFinancialData: boolean;
  financialCurrentLoss: number; // Impacto financeiro atual (R$) antes da melhoria
  financialPostImprovement: number; // Impacto financeiro após melhoria (R$)
  financialResult: number; // Resultado líquido (Positivo = Ganho, Negativo = Perda)
  resultClassification: 'GANHO' | 'PERDA' | 'SEM_VARIACAO' | 'NAO_APLICAVEL';
  financialType: FinancialResultType;
  financialPeriodicity: FinancialPeriodicity;
  financialPeriodicityOther?: string;
  financialStartDate?: string; // YYYY-MM-DD
  source: 'NEW_STRUCTURE' | 'MODERN_CHECK' | 'LEGACY_REAL_GAINS' | 'NONE';
  legacyDescription?: string;
}

/**
 * Realiza o parsing seguro de datas financeiras evitando distorções de fuso horário (UTC vs Local).
 * - Strings 'YYYY-MM-DD' são interpretadas como data de calendário local (ano, mês, dia à 00:00:00 local).
 * - Strings ISO completas com 'T' preservam o parsing padrão.
 */
export function parseFinancialDate(dateStr?: string | null): Date {
  if (!dateStr) return new Date();

  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
  }

  return new Date(dateStr);
}

/**
 * Normaliza qualquer valor numérico ou string numérica de forma segura.
 */
export function parseSafeNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    // Trata formato pt-BR "1.250,50" ou en-US "1250.50"
    const clean = val.replace(/\s+/g, '').replace(/[R$\.]/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Fonte Única de Verdade para extrair e interpretar o resultado financeiro de qualquer ciclo PDCA.
 * Prioridade:
 * 1. Nova estrutura (financialPostImprovement !== undefined || financialCurrentLoss !== undefined)
 * 2. CHECK moderno (cycle.check.realCostReduction !== undefined)
 * 3. Estrutura legada (cycle.plan.actionPlan[].realGains.tangible)
 */
export function getPDCAFinancialResult(cycle?: Partial<PDCACycle> | null): PDCAFinancialResult {
  if (!cycle) {
    return {
      hasFinancialData: false,
      financialCurrentLoss: 0,
      financialPostImprovement: 0,
      financialResult: 0,
      resultClassification: 'NAO_APLICAVEL',
      financialType: 'Único',
      financialPeriodicity: 'Mensal',
      source: 'NONE',
    };
  }

  const planImpact = cycle.plan?.impact;
  const check = cycle.check;

  // 1. PRIORIDADE 1: Nova Estrutura (Impacto Atual + Impacto Após Melhoria ou Campos Específicos)
  const hasNewPlanLoss = planImpact?.financialCurrentLoss !== undefined;
  const hasNewCheckPost = check?.financialPostImprovement !== undefined;
  const hasNewExplicitResult = check?.financialResult !== undefined;

  if (hasNewPlanLoss || hasNewCheckPost || hasNewExplicitResult) {
    const currentLoss = planImpact?.financialCurrentLoss !== undefined
      ? parseSafeNumber(planImpact.financialCurrentLoss)
      : parseSafeNumber(planImpact?.tangibleFinancialLoss ?? planImpact?.value ?? 0);

    const postImprovement = check?.financialPostImprovement !== undefined
      ? parseSafeNumber(check.financialPostImprovement)
      : (check?.realCostReduction !== undefined ? Math.max(0, currentLoss - parseSafeNumber(check.realCostReduction)) : currentLoss);

    const calcResult = check?.financialResult !== undefined
      ? parseSafeNumber(check.financialResult)
      : (currentLoss - postImprovement);

    let classification: 'GANHO' | 'PERDA' | 'SEM_VARIACAO' = 'SEM_VARIACAO';
    if (calcResult > 0) classification = 'GANHO';
    else if (calcResult < 0) classification = 'PERDA';
    else classification = 'SEM_VARIACAO';

    const financialType: FinancialResultType = check?.financialType || planImpact?.financialType || 'Recorrente';
    const financialPeriodicity: FinancialPeriodicity = check?.financialPeriodicity || planImpact?.financialPeriodicity || 'Mensal';
    const financialPeriodicityOther = check?.financialPeriodicityOther || planImpact?.financialPeriodicityOther;
    const financialStartDate = check?.financialStartDate;

    return {
      hasFinancialData: currentLoss > 0 || postImprovement > 0 || calcResult !== 0,
      financialCurrentLoss: currentLoss,
      financialPostImprovement: postImprovement,
      financialResult: calcResult,
      resultClassification: classification,
      financialType,
      financialPeriodicity,
      financialPeriodicityOther,
      financialStartDate,
      source: 'NEW_STRUCTURE',
    };
  }

  // 2. PRIORIDADE 2: CHECK Moderno (realCostReduction)
  if (check && check.realCostReduction !== undefined && check.realCostReduction !== null && check.realCostReduction !== 0) {
    const costReduction = parseSafeNumber(check.realCostReduction);
    const initialLoss = parseSafeNumber(planImpact?.tangibleFinancialLoss ?? planImpact?.value ?? 0);
    const postImprovement = Math.max(0, initialLoss - costReduction);

    return {
      hasFinancialData: true,
      financialCurrentLoss: initialLoss,
      financialPostImprovement: postImprovement,
      financialResult: costReduction,
      resultClassification: costReduction > 0 ? 'GANHO' : (costReduction < 0 ? 'PERDA' : 'SEM_VARIACAO'),
      financialType: planImpact?.financialType || 'Recorrente',
      financialPeriodicity: planImpact?.financialPeriodicity || 'Mensal',
      financialPeriodicityOther: planImpact?.financialPeriodicityOther,
      financialStartDate: undefined,
      source: 'MODERN_CHECK',
    };
  }

  // 3. PRIORIDADE 3: Estrutura Legada (realGains das ações do Action Plan)
  let legacyTangibleSum = 0;
  let hasLegacyGains = false;
  let legacyDescriptions: string[] = [];

  const actionPlan = cycle.plan?.actionPlan || [];
  for (const action of actionPlan) {
    if (action.ativo !== false && action.realGains?.tangible && action.realGains.tangible.length > 0) {
      for (const t of action.realGains.tangible) {
        const val = parseSafeNumber(t.value);
        if (val !== 0) {
          legacyTangibleSum += val;
          hasLegacyGains = true;
          if (t.type) legacyDescriptions.push(`${t.type}: ${t.unit || 'R$'} ${val}`);
        }
      }
    }
  }

  if (hasLegacyGains) {
    const initialLoss = parseSafeNumber(planImpact?.tangibleFinancialLoss ?? planImpact?.value ?? 0);
    return {
      hasFinancialData: true,
      financialCurrentLoss: initialLoss,
      financialPostImprovement: Math.max(0, initialLoss - legacyTangibleSum),
      financialResult: legacyTangibleSum,
      resultClassification: legacyTangibleSum > 0 ? 'GANHO' : (legacyTangibleSum < 0 ? 'PERDA' : 'SEM_VARIACAO'),
      financialType: 'Único',
      financialPeriodicity: 'Mensal',
      financialPeriodicityOther: undefined,
      financialStartDate: undefined,
      source: 'LEGACY_REAL_GAINS',
      legacyDescription: legacyDescriptions.join(' | '),
    };
  }

  // Fallback se houver apenas perda financeira registrada no PLAN
  const fallbackLoss = parseSafeNumber(planImpact?.tangibleFinancialLoss ?? planImpact?.value ?? 0);
  if (fallbackLoss > 0) {
    return {
      hasFinancialData: true,
      financialCurrentLoss: fallbackLoss,
      financialPostImprovement: fallbackLoss,
      financialResult: 0,
      resultClassification: 'SEM_VARIACAO',
      financialType: planImpact?.financialType || 'Recorrente',
      financialPeriodicity: planImpact?.financialPeriodicity || 'Mensal',
      financialPeriodicityOther: planImpact?.financialPeriodicityOther,
      financialStartDate: undefined,
      source: 'NEW_STRUCTURE',
    };
  }

  return {
    hasFinancialData: false,
    financialCurrentLoss: 0,
    financialPostImprovement: 0,
    financialResult: 0,
    resultClassification: 'NAO_APLICAVEL',
    financialType: 'Único',
    financialPeriodicity: 'Mensal',
    source: 'NONE',
  };
}

export interface ProjectFinancialSummary {
  projectId: string;
  projectTitle: string;
  totalGains: number;
  totalLosses: number;
  netBalance: number;
  cyclesCountWithFinancialData: number;
  hasFinancialImpact: boolean;
  cycleDetails: Array<{
    cycleId: string;
    cycleName: string;
    subtaskTitle: string;
    financialResult: PDCAFinancialResult;
  }>;
}

/**
 * Consolida os resultados financeiros de um Projeto, garantindo deduplicação estrita de ciclos PDCA.
 * Cada ciclo PDCA é contabilizado exatamente UMA vez, mesmo que compartilhado entre múltiplas subtarefas.
 */
export function getProjectFinancialSummary(
  project: Project,
  dateFilter?: { startDate?: string; endDate?: string }
): ProjectFinancialSummary {
  const processedCycleIds = new Set<string>();
  let totalGains = 0;
  let totalLosses = 0;
  let cyclesCountWithFinancialData = 0;
  const cycleDetails: ProjectFinancialSummary['cycleDetails'] = [];

  const subtasks = project.subtasks || [];
  for (const subtask of subtasks) {
    const cycles = subtask.pdcaCycles || [];
    for (const cycle of cycles) {
      const cycleId = cycle.id || `${subtask.id}_cycle`;
      if (processedCycleIds.has(cycleId)) {
        // Ciclo compartilhado ou duplicado: contabiliza apenas uma vez
        continue;
      }
      processedCycleIds.add(cycleId);

      const res = getPDCAFinancialResult(cycle);

      // Aplicação de filtro temporal caso fornecido
      if (dateFilter && (dateFilter.startDate || dateFilter.endDate)) {
        if (res.financialStartDate) {
          const start = dateFilter.startDate ? parseFinancialDate(dateFilter.startDate).getTime() : 0;
          const end = dateFilter.endDate ? parseFinancialDate(dateFilter.endDate).getTime() : Infinity;
          const cycleDate = parseFinancialDate(res.financialStartDate).getTime();
          if (cycleDate < start || cycleDate > end) {
            continue;
          }
        }
      }

      if (res.hasFinancialData || res.financialResult !== 0) {
        cyclesCountWithFinancialData++;
        if (res.financialResult > 0) {
          totalGains += res.financialResult;
        } else if (res.financialResult < 0) {
          totalLosses += Math.abs(res.financialResult);
        }
      }

      cycleDetails.push({
        cycleId,
        cycleName: cycle.nomePdca || 'Ciclo PDCA',
        subtaskTitle: subtask.title,
        financialResult: res,
      });
    }
  }

  const netBalance = totalGains - totalLosses;

  return {
    projectId: project.id,
    projectTitle: project.name || 'Projeto sem título',
    totalGains,
    totalLosses,
    netBalance,
    cyclesCountWithFinancialData,
    hasFinancialImpact: cyclesCountWithFinancialData > 0 || netBalance !== 0,
    cycleDetails,
  };
}

/**
 * Calcula o valor financeiro acumulado reconhecido dentro de um intervalo de datas.
 * Regras:
 * - Teto temporal obrigatório: effectiveEnd = min(filterEndDate, now) — NUNCA reconhece meses futuros como realizado.
 * - Único: Reconhecido uma única vez no período se a data de início estiver dentro do intervalo realizado.
 * - Recorrente Mensal: Reconhecido a partir do mês de início integral até o menor entre a data final do filtro e a data atual.
 * - Recorrente Anual: Reconhecido proporcionalmente por ano ativo no intervalo realizado.
 * - Outro: Reconhece o valor base sem multiplicação arbitrária.
 */
export function calculateAccumulatedFinancialResult(
  res: PDCAFinancialResult,
  range?: { startDate?: Date; endDate?: Date },
  referenceDate: Date = new Date()
): number {
  if (!res.hasFinancialData || res.financialResult === 0) return 0;

  const now = referenceDate;
  const startRange = range?.startDate || new Date(now.getFullYear(), 0, 1);
  const requestedEnd = range?.endDate || now;

  // TETO TEMPORAL OBRIGATÓRIO: resultado realizado nunca ultrapassa a data atual
  const endRange = requestedEnd < now ? requestedEnd : now;

  if (startRange > endRange) {
    return 0;
  }

  if (res.financialType === 'Único') {
    if (res.financialStartDate) {
      const cycleDate = parseFinancialDate(res.financialStartDate);
      if (cycleDate >= startRange && cycleDate <= endRange) {
        return res.financialResult;
      }
      return 0;
    }
    // Legado ou sem data informada: reconhece dentro do período corrente realizado
    return res.financialResult;
  }

  if (res.financialType === 'Recorrente') {
    if (res.financialPeriodicity === 'Mensal') {
      let activeStart = startRange;
      if (res.financialStartDate) {
        const cycleStart = parseFinancialDate(res.financialStartDate);
        // Primeiro mês integral a partir do mês da data de início
        const cycleMonthStart = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), 1);
        if (cycleMonthStart > endRange) return 0;
        if (cycleMonthStart > startRange) {
          activeStart = cycleMonthStart;
        }
      }

      const startY = activeStart.getFullYear();
      const startM = activeStart.getMonth();
      const endY = endRange.getFullYear();
      const endM = endRange.getMonth();

      const monthsCount = (endY - startY) * 12 + (endM - startM) + 1;
      if (monthsCount <= 0) return 0;

      return res.financialResult * monthsCount;
    }

    if (res.financialPeriodicity === 'Anual') {
      let activeStart = startRange;
      if (res.financialStartDate) {
        const cycleStart = parseFinancialDate(res.financialStartDate);
        if (cycleStart > endRange) return 0;
        if (cycleStart > startRange) {
          activeStart = cycleStart;
        }
      }

      const yearsCount = Math.max(1, endRange.getFullYear() - activeStart.getFullYear() + 1);
      return res.financialResult * yearsCount;
    }

    // Periodicidade "Outro": retorna o valor base reconhecido
    return res.financialResult;
  }

  return res.financialResult;
}

/**
 * Retorna todos os ciclos PDCA deduplicados com impacto financeiro entre os projetos.
 */
export function getAllFinancialCycles(
  projects: Project[],
  userMap?: Map<string, { id: string; name: string }>
) {
  const processedCycleIds = new Set<string>();
  const cyclesList: Array<{
    projectId: string;
    projectTitle: string;
    projectStatus: string;
    assignedToName: string;
    cycleId: string;
    cycleName: string;
    subtaskTitle: string;
    financialResult: PDCAFinancialResult;
  }> = [];

  for (const project of projects) {
    const user = userMap ? userMap.get(project.assignedTo) : undefined;
    const assignedToName = user?.name || 'Não atribuído';

    const subtasks = project.subtasks || [];
    for (const subtask of subtasks) {
      const pdcaCycles = subtask.pdcaCycles || [];
      for (const cycle of pdcaCycles) {
        const cycleId = cycle.id || `${subtask.id}_cycle`;
        if (processedCycleIds.has(cycleId)) continue;
        processedCycleIds.add(cycleId);

        const finRes = getPDCAFinancialResult(cycle);
        cyclesList.push({
          projectId: project.id,
          projectTitle: project.name || 'Projeto sem título',
          projectStatus: project.status,
          assignedToName,
          cycleId,
          cycleName: cycle.nomePdca || 'Ciclo PDCA',
          subtaskTitle: subtask.title,
          financialResult: finRes,
        });
      }
    }
  }

  return cyclesList;
}

/**
 * Gera a evolução mensal dos resultados financeiros (Ganhos, Perdas e Saldo) respeitando o período selecionado
 * e limitado estritamente à data atual (somente resultados realizados até hoje).
 */
export function getMonthlyFinancialEvolution(
  projects: Project[],
  periodOrYear?: number | { startDate?: Date; endDate?: Date; filterType?: string },
  referenceDate: Date = new Date()
) {
  const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = referenceDate;

  // Deduplica todos os ciclos PDCA
  const cycles = getAllFinancialCycles(projects);

  let period: { startDate?: Date; endDate?: Date; filterType?: string } | undefined;
  if (typeof periodOrYear === 'number') {
    period = {
      startDate: new Date(periodOrYear, 0, 1),
      endDate: new Date(periodOrYear, 11, 31, 23, 59, 59),
    };
  } else {
    period = periodOrYear;
  }

  let startPeriod = period?.startDate ? new Date(period.startDate) : new Date(now.getFullYear(), 0, 1);
  const requestedEnd = period?.endDate ? new Date(period.endDate) : now;
  // Teto temporal obrigatório: effectiveEnd nunca ultrapassa a data atual
  const effectiveEnd = requestedEnd < now ? requestedEnd : now;

  // Se o filtro for 'all' (Todos), ajusta o início para o primeiro resultado financeiro existente
  if (period?.filterType === 'all') {
    let oldestDate: Date | null = null;
    for (const c of cycles) {
      if (c.financialResult.financialStartDate) {
        const d = parseFinancialDate(c.financialResult.financialStartDate);
        if (!oldestDate || d < oldestDate) {
          oldestDate = d;
        }
      }
    }
    if (oldestDate) {
      startPeriod = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 1);
    } else {
      startPeriod = new Date(effectiveEnd.getFullYear(), 0, 1);
    }
  }

  // Garante que startPeriod não seja posterior ao effectiveEnd
  if (startPeriod > effectiveEnd) {
    startPeriod = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1);
  }

  // Determina se o intervalo cruza anos diferentes para formatar o rótulo
  const spansMultipleYears = startPeriod.getFullYear() !== effectiveEnd.getFullYear();

  // Gera todas as competências mensais entre startPeriod e effectiveEnd
  const monthlyBuckets: Array<{
    year: number;
    monthIndex: number;
    label: string;
    monthStart: Date;
    monthEnd: Date;
  }> = [];

  let currY = startPeriod.getFullYear();
  let currM = startPeriod.getMonth();
  const endY = effectiveEnd.getFullYear();
  const endM = effectiveEnd.getMonth();

  while (currY < endY || (currY === endY && currM <= endM)) {
    const mStart = new Date(currY, currM, 1, 0, 0, 0);
    const mEnd = new Date(currY, currM + 1, 0, 23, 59, 59);
    
    let label = monthsNames[currM];
    if (spansMultipleYears) {
      const yearShort = String(currY).slice(-2);
      label = `${monthsNames[currM]}/${yearShort}`;
    }

    monthlyBuckets.push({
      year: currY,
      monthIndex: currM,
      label,
      monthStart: mStart,
      monthEnd: mEnd,
    });

    currM++;
    if (currM > 11) {
      currM = 0;
      currY++;
    }
  }

  // Se nenhum bucket foi gerado, gera pelo menos o mês de effectiveEnd
  if (monthlyBuckets.length === 0) {
    const mStart = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1, 0, 0, 0);
    const mEnd = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth() + 1, 0, 23, 59, 59);
    monthlyBuckets.push({
      year: effectiveEnd.getFullYear(),
      monthIndex: effectiveEnd.getMonth(),
      label: monthsNames[effectiveEnd.getMonth()],
      monthStart: mStart,
      monthEnd: mEnd,
    });
  }

  const monthlyData = monthlyBuckets.map((bucket, bucketIdx) => {
    let monthGains = 0;
    let monthLosses = 0;

    for (const c of cycles) {
      const res = c.financialResult;
      if (!res.hasFinancialData || res.financialResult === 0) continue;

      if (res.financialType === 'Único') {
        if (res.financialStartDate) {
          const startDate = parseFinancialDate(res.financialStartDate);
          if (startDate.getFullYear() === bucket.year && startDate.getMonth() === bucket.monthIndex) {
            if (res.financialResult > 0) monthGains += res.financialResult;
            else monthLosses += Math.abs(res.financialResult);
          }
        } else if (bucketIdx === 0) {
          // Sem data: aloca no primeiro mês do período selecionado
          if (res.financialResult > 0) monthGains += res.financialResult;
          else monthLosses += Math.abs(res.financialResult);
        }
      } else if (res.financialType === 'Recorrente') {
        if (res.financialPeriodicity === 'Mensal') {
          let isActiveInMonth = true;
          if (res.financialStartDate) {
            const startDate = parseFinancialDate(res.financialStartDate);
            const startMonthFirst = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            if (bucket.monthStart < startMonthFirst) {
              isActiveInMonth = false;
            }
          }
          if (isActiveInMonth) {
            if (res.financialResult > 0) monthGains += res.financialResult;
            else monthLosses += Math.abs(res.financialResult);
          }
        } else if (res.financialPeriodicity === 'Anual') {
          let startMonth = 0;
          let startYear = bucket.year;
          if (res.financialStartDate) {
            const s = parseFinancialDate(res.financialStartDate);
            startYear = s.getFullYear();
            startMonth = s.getMonth();
          }
          if (bucket.year >= startYear && bucket.monthIndex === startMonth) {
            if (res.financialResult > 0) monthGains += res.financialResult;
            else monthLosses += Math.abs(res.financialResult);
          }
        } else {
          // Outro
          if (bucketIdx === 0) {
            if (res.financialResult > 0) monthGains += res.financialResult;
            else monthLosses += Math.abs(res.financialResult);
          }
        }
      }
    }

    const net = monthGains - monthLosses;
    return {
      month: bucket.label,
      monthIndex: bucket.monthIndex,
      year: bucket.year,
      gains: monthGains,
      losses: monthLosses,
      netBalance: net,
      accumulatedBalance: 0,
    };
  });

  let runningAccum = 0;
  for (const item of monthlyData) {
    runningAccum += item.netBalance;
    item.accumulatedBalance = runningAccum;
  }

  return monthlyData;
}
