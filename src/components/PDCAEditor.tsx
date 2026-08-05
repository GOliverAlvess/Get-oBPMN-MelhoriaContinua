import React, { useState, useMemo, useRef, useEffect } from "react";
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
  Percent,
  FileText,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  HelpCircle,
  Save,
  Search,
  Clock,
  Download,
  ExternalLink,
  GitBranch,
  Layers,
  Lock,
  Zap,
  Award,
  Pencil,
  Check,
  Link2,
  GitFork,
  PlusCircle,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import html2pdf from "html2pdf.js";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";

import {
  Project,
  Subtask,
  PDCACycle,
  ParetoItem,
  ActionPlanItem,
  PDCAStatus,
  PDCAPriority,
  ActionPlanType,
  GainsStructure,
  GlobalConfig,
} from "../types";
import ParetoDiagram from "./ParetoDiagram";
import GainsEditor from "./GainsEditor";
import { cn, isValidUrl, formatUrl, exportarCSVPadrao } from "../lib/utils";
import { logFeature, logFix, logMelhoria, logAjuste } from "../lib/changelogService";

import { SYSTEM_LOGO_PATH } from "../constants/pdfLogo";
import { getBase64ImageFromUrl } from "../lib/utils";
import { auth } from "../firebase";

const STATUS_MAP: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
};

const SYSTEM_LOGO_PRIMARY_COLOR = "#003489";

const translateStatus = (status: string) => STATUS_MAP[status] || status;

// Set up pdfMake fonts
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if ((pdfFonts as any).vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).vfs;
}

const SectionHeader = ({
  number,
  title,
  subtitle,
}: {
  number?: string;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex items-start gap-4 pb-6 border-b border-slate-200">
    {number && (
      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
        {number}
      </div>
    )}
    <div>
      <h3 className="text-lg font-black text-slate-800 tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const StatCard = ({
  title,
  value,
  icon,
  color = "indigo",
}: {
  title: string;
  value: string | number;
  icon: any;
  color?: string;
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComp = icon;
      return <IconComp size={22} />;
    }
    return null;
  };

  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-50 text-slate-600",
  };

  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div
        className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
          colors[color] || "bg-indigo-50 text-indigo-600"
        )}
      >
        {renderIcon()}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-lg font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const isDone = status === "Concluído" || status === "Concluido";
  const isInProg = status === "Em andamento" || status === "Em Andamento";
  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5",
        isDone
          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
          : isInProg
          ? "bg-amber-50 text-amber-600 border border-amber-200"
          : "bg-slate-100 text-slate-600 border border-slate-200"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", isDone ? "bg-emerald-500" : isInProg ? "bg-amber-500" : "bg-slate-400")} />
      {status}
    </span>
  );
};

const PhaseTab = ({
  phase,
  label,
  active,
  onClick,
  disabled,
  color,
  icon,
  lockTooltip,
}: {
  phase?: string;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  icon?: any;
  lockTooltip?: string;
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function") {
      const IconComp = icon;
      return <IconComp size={12} />;
    }
    return null;
  };

  return (
    <div className="relative group/tab">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
          active
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
            : disabled
            ? "text-slate-300 cursor-not-allowed"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        {renderIcon()}
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
};

const getProgress = (cycle: PDCACycle) => cycle.progress || 0;

export default function PDCAEditor({
  project,
  subtask,
  onUpdateSubtask,
  onBack,
  defaultTaskId,
  globalConfig,
  userProfile,
}: {
  project: Project;
  subtask: Subtask;
  onUpdateSubtask: (s: Subtask) => void;
  onBack: () => void;
  defaultTaskId?: string;
  globalConfig?: GlobalConfig;
  userProfile?: string;
}) {
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<
    "PLAN" | "DO" | "CHECK" | "ACT" | "REPORT"
  >("PLAN");
  const [activePlanStep, setActivePlanStep] = useState<number>(1);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showProblemsModal, setShowProblemsModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showActConfirmation, setShowActConfirmation] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<PDCACycle | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogData, setEditingLogData] = useState<{
    status: "Pendente" | "Em andamento";
    sector: string;
    observation: string;
  } | null>(null);
  const [showLogHistoryId, setShowLogHistoryId] = useState<string | null>(null);

  // Modal for choice & linking PDCA
  const [startOrLinkConfig, setStartOrLinkConfig] = useState<{
    isOpen: boolean;
    taskId: string;
    taskLabel: string;
  } | null>(null);
  const [startOrLinkMode, setStartOrLinkMode] = useState<'choice' | 'link'>('choice');
  const [selectedPdcaToLink, setSelectedPdcaToLink] = useState<string | null>(null);
  const [selectedSubtasksToLink, setSelectedSubtasksToLink] = useState<string[]>([]);

  // Distinct PDCAs in project across all subtasks
  const projectPDCAs = useMemo(() => {
    const map = new Map<string, { cycle: PDCACycle; subtasks: Subtask[] }>();
    (project.subtasks || []).forEach((st) => {
      (st.pdcaCycles || []).forEach((c) => {
        if (!map.has(c.id)) {
          map.set(c.id, { cycle: c, subtasks: [st] });
        } else {
          const existing = map.get(c.id)!;
          if (!existing.subtasks.some((s) => s.id === st.id)) {
            existing.subtasks.push(st);
          }
        }
      });
    });
    return Array.from(map.values());
  }, [project.subtasks]);

  // Subtasks linked to the active cycle
  const linkedSubtasksForActiveCycle = useMemo(() => {
    if (!activeCycleId || !project.subtasks) return [];
    return (project.subtasks || []).filter((st) =>
      (st.pdcaCycles || []).some((c) => c.id === activeCycleId)
    );
  }, [project.subtasks, activeCycleId]);

  const isMaster = useMemo(() => {
    let p = userProfile;
    if (!p) {
      try {
        const saved = sessionStorage.getItem("pdca_auth_user") || localStorage.getItem("pdca_auth_user");
        if (saved) {
          const u = JSON.parse(saved);
          p = u.profile;
        }
      } catch (e) {
        // ignore
      }
    }
    const user = auth.currentUser;
    if (!p && user) {
      p = (user as any).profile;
    }
    const email = user?.email || "";
    if (
      !email ||
      email === "ga.oliveira@ativalog.com.br" ||
      email === "bielalves201@gmail.com"
    ) {
      return true;
    }
    if (!p) return true;
    const upper = String(p).toUpperCase();
    return upper.includes("MASTER");
  }, [userProfile]);

  const handleConfirmDeleteCycle = (cycleId: string) => {
    const updatedCycles = subtask.pdcaCycles.filter((c) => c.id !== cycleId);
    onUpdateSubtask({
      ...subtask,
      pdcaCycles: updatedCycles,
    });
    if (activeCycleId === cycleId) {
      setActiveCycleId(null);
      setShowDashboard(true);
    }
    setCycleToDelete(null);
  };

  const [confirmingLog, setConfirmingLog] = useState<{
    id: string;
    updates: any;
    obsInputId: string;
  } | null>(null);

  const [isEditingPdcaName, setIsEditingPdcaName] = useState(false);
  const [editingPdcaNameValue, setEditingPdcaNameValue] = useState("");

  // Filter cycles if defaultTaskId is provided
  const cycles = useMemo(() => {
    if (defaultTaskId) {
      return subtask.pdcaCycles.filter((c) => c.taskId === defaultTaskId);
    }
    return subtask.pdcaCycles;
  }, [subtask.pdcaCycles, defaultTaskId]);

  const activeCycle = subtask.pdcaCycles.find((c) => c.id === activeCycleId);

  const isPlanStep3Valid = useMemo(() => {
    if (!activeCycle) return false;
    const impact = activeCycle.plan.impact;
    if (!impact || !impact.impactType) return false;

    const hasTangibleDetail =
      (impact.tangibleFinancialLoss ?? 0) > 0 ||
      (impact.tangibleWastedTime ?? 0) > 0 ||
      !!(impact.tangibleRework && String(impact.tangibleRework).trim()) ||
      !!impact.tangibleOtherCosts?.trim();

    const hasIntangibleDetail =
      !!impact.intangibleCustomerImpact?.trim() ||
      !!impact.intangibleQualityImpact?.trim() ||
      !!impact.intangibleRiskImpact?.trim() ||
      !!impact.intangibleTeamImpact?.trim();

    if (impact.impactType === "Tangível" && !hasTangibleDetail) return false;
    if (impact.impactType === "Intangível" && !hasIntangibleDetail) return false;
    if (impact.impactType === "Ambos" && (!hasTangibleDetail || !hasIntangibleDetail)) return false;

    if (!impact.description?.trim()) return false;

    return true;
  }, [activeCycle]);

  const isPlanPhaseValid = useMemo(() => {
    if (!activeCycle) return false;
    const { rootCauseAnalysis } = activeCycle.plan;
    const isCauseValid = rootCauseAnalysis.type === "ishikawa"
      ? (rootCauseAnalysis.priorityCauses || []).length > 0
      : !!rootCauseAnalysis.identifiedRootCause?.trim();

    const hasActionItems = (activeCycle.plan.actionPlan || []).some(
      (item) => item.status !== "Cancelado" && item.ativo !== false && !!item.what?.trim()
    );

    return isCauseValid && isPlanStep3Valid && hasActionItems;
  }, [activeCycle, isPlanStep3Valid]);

  const isDoPhaseValid = useMemo(() => {
    if (!activeCycle || activeCycle.plan.actionPlan.length === 0) return false;
    return activeCycle.plan.actionPlan.some((item) => {
      return item.status === "Concluído";
    });
  }, [activeCycle]);

  const isCheckPhaseValid = useMemo(() => {
    if (!activeCycle) return false;

    const hasConclusao = !!activeCycle.check?.expectedGainAchieved;

    const activeItems = (activeCycle.plan.actionPlan || []).filter(
      (item) => item.status !== "Cancelado" && item.ativo !== false
    );

    if (activeItems.length === 0) return false;

    const allItemsChecked = activeItems.every((item) => {
      const isDoDone = item.status === "Concluído";
      const hasMonitoring = !!item.monitoringTool?.trim();
      const hasWorked = !!item.worked;
      const hasFailureReason =
        item.worked === "Sim" || !item.worked || !!item.failureReason?.trim();

      return isDoDone && hasMonitoring && hasWorked && hasFailureReason;
    });

    return hasConclusao && allItemsChecked;
  }, [activeCycle]);

  const isActPhaseValid = useMemo(() => {
    if (!activeCycle) return false;
    return activeCycle.plan.actionPlan.some((item) => {
      const hasFinalStatus = !!item.finalProblemStatus;
      const hasFinalAction = !!item.finalAction;
      if (item.finalAction === "Padronizar processo") {
        return (
          hasFinalStatus &&
          hasFinalAction &&
          (item.standardizationModels || []).length > 0
        );
      }
      return hasFinalStatus && hasFinalAction;
    });
  }, [activeCycle]);

  const cycleProgress = useMemo(() => {
    if (!activeCycle) return 0;
    const planItems = (activeCycle.plan.actionPlan || []).filter(
      (item) => item.ativo !== false && item.status !== "Cancelado",
    );
    if (planItems.length === 0) return isPlanPhaseValid ? 25 : 0;

    const itemsProgress = planItems.map((item) => {
      let p = 25; // PLAN is done if item exists in a cycle with PLAN valid

      // DO progress
      const isDoDone = item.status === "Concluído";

      if (isDoDone) {
        p += 25;
        // CHECK progress
        const isCheckDone =
          !!item.monitoringTool?.trim() &&
          !!item.worked &&
          (item.worked === "Sim" || !!item.failureReason?.trim());
        if (isCheckDone) {
          p += 25;
          // ACT progress
          const isActDone =
            !!item.finalProblemStatus &&
            !!item.finalAction &&
            (item.finalAction !== "Padronizar processo" ||
              (item.standardizationModels || []).length > 0);
          if (isActDone) p += 25;
        }
      } else if (item.status === "Em andamento") {
        p += 10; // Partial DO
      }

      return p;
    });

    const averageProgress =
      itemsProgress.reduce((acc, p) => acc + p, 0) / itemsProgress.length;
    return Math.round(averageProgress);
  }, [activeCycle, isPlanPhaseValid]);

  // Sync progress with subtask overall progress
  useEffect(() => {
    if (activeCycle) {
      const newCycles = subtask.pdcaCycles.map((c) =>
        c.id === activeCycle.id ? { ...c, progress: cycleProgress } : c,
      );

      // Calculate overall subtask progress
      // As per rule: "Se houver mais de uma subtarefa no card, deverá ser dividida para considerar o progresso total no kanban."
      // I assume this PDCAEditor is for a single subtask. I should update that subtask's progress.
      // If there are multiple cycles for the same taskId, we take the best one or average?
      // "Cards concluídos não estão chegando a 100%" implies we want the card progress to reflect PDCA completion.

      const totalPDCAProgress =
        newCycles.reduce((acc, c) => acc + (c.progress || 0), 0) /
        (newCycles.length || 1);

      if (subtask.progress !== Math.round(totalPDCAProgress)) {
        onUpdateSubtask({
          ...subtask,
          pdcaCycles: newCycles,
          progress: Math.round(totalPDCAProgress),
          status:
            totalPDCAProgress === 100
              ? "Concluído"
              : totalPDCAProgress > 0
                ? "Em andamento"
                : "Pendente",
        });
      }
    }
  }, [cycleProgress, activeCycle?.id]);

  const ishikawaDefaultCategories = useMemo(
    () => [
      {
        id: uuidv4(),
        name: "Método" as const,
        description: "Procedimentos, fluxos e formas de trabalho.",
        entries: [],
      },
      {
        id: uuidv4(),
        name: "Máquina" as const,
        description: "Equipamentos, ferramentas e tecnologia.",
        entries: [],
      },
      {
        id: uuidv4(),
        name: "Mão de obra" as const,
        description: "Pessoas, competências e treinamento.",
        entries: [],
      },
      {
        id: uuidv4(),
        name: "Material" as const,
        description: "Insumos, peças e qualidade da matéria-prima.",
        entries: [],
      },
      {
        id: uuidv4(),
        name: "Meio ambiente" as const,
        description: "Local de trabalho, clima e condições externas.",
        entries: [],
      },
      {
        id: uuidv4(),
        name: "Medida" as const,
        description: "Indicadores, métricas e calibração.",
        entries: [],
      },
    ],
    [],
  );

  const allIshikawaCauses = useMemo(() => {
    if (activeCycle?.plan.rootCauseAnalysis.type !== "ishikawa") return [];
    const categories =
      activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories;
    const causes = categories
      .flatMap((cat) => cat.entries.map((e) => e.text.trim()))
      .filter((t) => t !== "");
    return Array.from(new Set(causes));
  }, [activeCycle?.plan.rootCauseAnalysis.ishikawa, ishikawaDefaultCategories]);

  // Problems from Mapping
  const problemsFromMapping = useMemo(() => {
    const customData = subtask.mapping.customData || {};
    return Object.entries(customData)
      .filter(([id, data]) => {
        if (!data.isProblemStep) return false;
        // Check if task already has a cycle
        const hasCycle = subtask.pdcaCycles.some((c) => c.taskId === id);
        // User requested: "Se o ciclo estiver concluído, a task NÃO deve aparecer novamente em Identificar Problemas"
        const hasFinishedCycle = subtask.pdcaCycles.some(
          (c) => c.taskId === id && c.status === "Concluído",
        );
        const hasActiveCycle = subtask.pdcaCycles.some(
          (c) => c.taskId === id && c.status === "Ativo",
        );

        // Only show if it doesn't have an active cycle and doesn't have a finished cycle
        // Rule: Only allow new cycle if there is explicit user action (the modal IS the explicit action here,
        // but the rule says hide finished ones from Identify Problems)
        return !hasActiveCycle && !hasFinishedCycle;
      })
      .map(([id, data]) => ({
        id,
        label: data.description || "Sem descrição",
        time: data.timeInMinutes || 0,
        role: data.responsibleRole || "",
      }));
  }, [subtask.mapping.customData, subtask.pdcaCycles]);

  const relatedCycles = useMemo(() => {
    if (!activeCycle) return [];
    return subtask.pdcaCycles
      .filter((c) => c.taskId === activeCycle.taskId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [subtask.pdcaCycles, activeCycle?.taskId]);

  const isIshikawaValid = useMemo(() => {
    if (!activeCycle || activeCycle.plan.rootCauseAnalysis.type !== "ishikawa")
      return true;
    const { priorityCauses } = activeCycle.plan.rootCauseAnalysis;
    return priorityCauses && priorityCauses.length > 0;
  }, [activeCycle]);

  const handlePhaseChange = (newPhase: typeof activePhase) => {
    const phases: (typeof activePhase)[] = [
      "PLAN",
      "DO",
      "CHECK",
      "ACT",
      "REPORT",
    ];
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
    if (newPhase === "DO" && !isPlanPhaseValid) {
      setShowValidationErrors(true);
      setSaveFeedback("Finalize a etapa PLAN para desbloquear o DO.");
      return;
    }

    // CHECK: Bloqueado até DO = concluído
    if (newPhase === "CHECK" && !isDoPhaseValid) {
      setSaveFeedback("Finalize a etapa DO para desbloquear o CHECK.");
      return;
    }

    // ACT: Bloqueado até CHECK = concluído
    if (newPhase === "ACT" && !isCheckPhaseValid) {
      setSaveFeedback("Finalize a etapa CHECK para desbloquear o ACT.");
      return;
    }

    if (
      newPhase === "REPORT" &&
      !isActPhaseValid &&
      activeCycle?.status !== "Concluído"
    ) {
      setSaveFeedback(
        "Finalize o ciclo (ACT) para visualizar o relatório completo.",
      );
      return;
    }

    setShowValidationErrors(false);
    setActivePhase(newPhase);
    // Update cycle's own phase state if it exists
    if (activeCycle) {
      updateCycle({ etapaAtual: newPhase });
    }
  };

  const handleStartPdcaFlow = (taskId: string, taskLabel: string) => {
    const existingActiveCycle = (subtask.pdcaCycles || []).find(
      (c) => (c.taskId === taskId || c.linkedTaskIds?.includes(taskId)) && c.status === "Ativo"
    );
    if (existingActiveCycle) {
      setActiveCycleId(existingActiveCycle.id);
      setActivePhase(existingActiveCycle.etapaAtual || "PLAN");
      setShowDashboard(false);
      setShowProblemsModal(false);
      setSaveFeedback("Já existe um ciclo ativo para esta etapa.");
      return;
    }

    setStartOrLinkConfig({ isOpen: true, taskId, taskLabel });
    setStartOrLinkMode("choice");
    setSelectedPdcaToLink(null);
    setSelectedSubtasksToLink([subtask.id]);
  };

  const handleConfirmLink = () => {
    if (!startOrLinkConfig || !selectedPdcaToLink) return;

    const targetItem = projectPDCAs.find((item) => item.cycle.id === selectedPdcaToLink);
    if (!targetItem) return;

    const baseCycle = targetItem.cycle;

    const newLinkedTaskIds = Array.from(
      new Set([...(baseCycle.linkedTaskIds || [baseCycle.taskId]), startOrLinkConfig.taskId])
    );
    const newLinkedSubtaskIds = Array.from(new Set(selectedSubtasksToLink));

    const updatedCycle: PDCACycle = {
      ...baseCycle,
      linkedTaskIds: newLinkedTaskIds,
      linkedSubtaskIds: newLinkedSubtaskIds,
    };

    const hasCycleInCurrent = (subtask.pdcaCycles || []).some((c) => c.id === updatedCycle.id);
    let newCurrentCycles = subtask.pdcaCycles || [];
    if (selectedSubtasksToLink.includes(subtask.id)) {
      if (hasCycleInCurrent) {
        newCurrentCycles = newCurrentCycles.map((c) => (c.id === updatedCycle.id ? updatedCycle : c));
      } else {
        newCurrentCycles = [updatedCycle, ...newCurrentCycles];
      }
    } else {
      newCurrentCycles = newCurrentCycles.filter((c) => c.id !== updatedCycle.id);
    }

    onUpdateSubtask({
      ...subtask,
      pdcaCycles: newCurrentCycles,
    });

    logFeature("Vínculo de ciclo PDCA compartilhado entre múltiplas subtarefas", "PDCA", "🔗");

    setActiveCycleId(updatedCycle.id);
    setActivePhase(updatedCycle.etapaAtual || "PLAN");
    setShowDashboard(false);
    setShowProblemsModal(false);
    setStartOrLinkConfig(null);
    setSaveFeedback("PDCA vinculado com sucesso!");
    setTimeout(() => setSaveFeedback(null), 3500);
  };

  const createNewCycle = (taskId: string, taskLabel: string) => {
    // Check if any cycle already exists for this task to avoid automatic duplicates
    const existingActiveCycle = subtask.pdcaCycles.find(
      (c) => c.taskId === taskId && c.status === "Ativo",
    );
    if (existingActiveCycle) {
      setActiveCycleId(existingActiveCycle.id);
      setActivePhase(existingActiveCycle.etapaAtual || "PLAN");
      setShowDashboard(false);
      setShowProblemsModal(false);
      setSaveFeedback("Já existe um ciclo ativo para esta etapa.");
      return;
    }

    const existingFinishedCycle = subtask.pdcaCycles.find(
      (c) => c.taskId === taskId && c.status === "Concluído",
    );
    if (
      existingFinishedCycle &&
      !confirm(
        "Já existe um ciclo concluído para esta etapa. Deseja iniciar um NOVO ciclo de melhoria?",
      )
    ) {
      return;
    }

    const cycleCount = subtask.pdcaCycles.filter(
      (c) => c.taskId === taskId,
    ).length;
    const newCycle: PDCACycle = {
      id: uuidv4(),
      taskId,
      title:
        cycleCount > 0
          ? `Ciclo PDCA ${cycleCount + 1} - ${taskLabel}`
          : `Ciclo PDCA - ${taskLabel}`,
      nomePdca: "", // Initialized to empty so the fallback will be utilized
      createdAt: new Date().toISOString(),
      status: "Ativo",
      etapaAtual: "PLAN",
      plan: {
        problemDescription: taskLabel,
        rootCauseAnalysis: {
          type: "5whys",
          entries: [
            { id: uuidv4(), text: "" },
            { id: uuidv4(), text: "" },
            { id: uuidv4(), text: "" },
            { id: uuidv4(), text: "" },
            { id: uuidv4(), text: "" },
          ],
        },
        impact: {
          description: "",
          value: 0,
          goal: 0,
        },
        actionPlan: [],
      },
    };

    onUpdateSubtask({
      ...subtask,
      pdcaCycles: [newCycle, ...subtask.pdcaCycles],
    });
    logFeature("Novo ciclo PDCA iniciado para a etapa", "PDCA", "🔄");
    setActiveCycleId(newCycle.id);
    setActivePhase("PLAN");
    setShowDashboard(false);
    setShowProblemsModal(false);
  };

  const updateCycle = (newData: Partial<PDCACycle>) => {
    if (!activeCycleId) return;
    const newCycles = subtask.pdcaCycles.map((c) =>
      c.id === activeCycleId ? { ...c, ...newData } : c,
    );
    onUpdateSubtask({ ...subtask, pdcaCycles: newCycles });
  };

  const updatePlan = (newPlanData: Partial<NonNullable<PDCACycle["plan"]>>) => {
    if (!activeCycle) return;
    updateCycle({
      plan: {
        ...activeCycle.plan,
        ...newPlanData,
      },
    });
  };

  const handleAddActionPlanItem = () => {
    if (!activeCycle) return;
    const newItem: ActionPlanItem = {
      id: uuidv4(),
      what: "",
      why: "",
      where: "",
      when: "",
      who: "",
      how: "",
      howMuch: "0",
      status: "Pendente",
      currentPhase: "DO",
      executionLogs: [],
    };
    const updatedPlan = [...(activeCycle.plan.actionPlan || []), newItem];
    updatePlan({ actionPlan: updatedPlan });
  };

  const handleDeleteActionPlanItem = (id: string) => {
    if (!activeCycle) return;
    const updatedPlan = (activeCycle.plan.actionPlan || []).filter((item) => item.id !== id);
    updatePlan({ actionPlan: updatedPlan });
  };

  const removeActionPlanItem = handleDeleteActionPlanItem;
  const addActionPlanItem = handleAddActionPlanItem;

  const handleUpdateActionPlanItem = (id: string, updates: Partial<ActionPlanItem>, isDebounced = false) => {
    if (!activeCycle) return;
    const updatedPlan = (activeCycle.plan.actionPlan || []).map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    updatePlan({ actionPlan: updatedPlan });
  };

  const updateActionPlan = handleUpdateActionPlanItem;

  const handleStepChange = (step: number) => {
    setActivePlanStep(step);
  };

  const handleSave = () => {
    logAjuste("Ajustes salvos no ciclo PDCA ativo", "PDCA", "💾");
    setSaveFeedback("Dados salvos com sucesso!");
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const exportToCSV = () => {
    if (relatedCycles.length === 0) return;

    const formatExpectedTangibleGains = (gains: any): string => {
      if (!gains || !gains.tangible || gains.tangible.length === 0) return "";
      return gains.tangible
        .map((t: any) => `${t.type || ""}: ${t.unit || ""} ${t.value ?? ""}`)
        .filter(Boolean)
        .join(" | ");
    };

    const formatExpectedIntangibleGains = (gains: any): string => {
      if (!gains || !gains.intangible || gains.intangible.length === 0)
        return "";
      return gains.intangible
        .map(
          (i: any) =>
            `${i.type || ""} (${i.impactLevel || ""})${i.description ? ` - ${i.description}` : ""}`,
        )
        .filter(Boolean)
        .join(" | ");
    };

    const formatRealGainsStr = (gains: any): string => {
      if (!gains) return "";
      const tangible = (gains.tangible || [])
        .map((t: any) => `${t.type || ""}: ${t.unit || ""} ${t.value ?? ""}`)
        .filter(Boolean)
        .join(" | ");
      const intangible = (gains.intangible || [])
        .map(
          (i: any) =>
            `${i.type || ""} (${i.impactLevel || ""})${i.description ? ` - ${i.description}` : ""}`,
        )
        .filter(Boolean)
        .join(" | ");
      if (!tangible && !intangible) return "";
      return [tangible, intangible].filter(Boolean).join(" || ");
    };

    const getRootCausa = (cycle: any): string => {
      const rca = cycle.plan?.rootCauseAnalysis;
      if (!rca) return "";
      if (rca.identifiedRootCause && rca.identifiedRootCause.trim() !== "") {
        return rca.identifiedRootCause;
      }
      if (rca.priorityCauses && rca.priorityCauses.length > 0) {
        return rca.priorityCauses.filter(Boolean).join(" | ");
      }
      return "";
    };

    const formatCsvDate = (dateStr: string | undefined): string => {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return format(d, "dd/MM/yyyy");
      } catch (error) {
        return dateStr;
      }
    };

    const headers = [
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
      "ACT - Padronização",
    ];

    const rows: any[][] = [];

    relatedCycles.forEach((cycle) => {
      cycle.plan.actionPlan
        .filter((item) => item.status !== "Cancelado" && item.ativo !== false)
        .forEach((item) => {
          rows.push([
            cycle.id,
            cycle.title,
            cycle.plan.problemDescription,
            getRootCausa(cycle),
            cycle.plan.impact.description || "",
            cycle.plan.impact.value ?? "",
            cycle.plan.impact.improvementPercentage ?? cycle.plan.impact.goal ?? "",
            formatExpectedTangibleGains(cycle.plan.impact.expectedGains),
            formatExpectedIntangibleGains(cycle.plan.impact.expectedGains),
            (project.scope?.odsSelecionadas && project.scope.odsSelecionadas.length > 0) ? project.scope.odsSelecionadas.join(", ") : "",
            project.scope?.odsDescricao || project.scope?.ods || "",
            (project.scope?.esgSelecionado && project.scope.esgSelecionado.length > 0) ? project.scope.esgSelecionado.join(", ") : "",
            project.scope?.esgDescricao || [
              project.scope?.esgEnvironmental ? `E: ${project.scope.esgEnvironmental}` : "",
              project.scope?.esgSocial ? `S: ${project.scope.esgSocial}` : "",
              project.scope?.esgGovernance ? `G: ${project.scope.esgGovernance}` : ""
            ].filter(Boolean).join(" | ") || "",
            item.what || "",
            item.why || "",
            item.where || "",
            item.when || "",
            item.who || "",
            item.how || "",
            item.howMuch || "",
            item.actionType || "",
            translateStatus(item.status),
            formatCsvDate(item.startDate),
            formatCsvDate(item.endDate),
            item.monitoringMode || "",
            item.monitoringPeriod || "",
            item.monitoringTool || "",
            item.worked || "",
            formatRealGainsStr(item.realGains),
            item.finalProblemStatus || "",
            item.finalAction || "",
            (item.standardizationModels || []).join(", "),
          ]);
        });
    });

    const fileName = `Relatorio_PDCA_${activeCycle?.title.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    exportarCSVPadrao(headers, rows, fileName);
  };

  const normalizeColors = (element: HTMLElement) => {
    // Force a temporary class for PDF specific overrides
    element.classList.add("pdf-mode");

    const all = element.querySelectorAll("*");
    all.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);

      // Extensive list of properties to check
      [
        "color",
        "backgroundColor",
        "borderColor",
        "outlineColor",
        "fill",
        "stroke",
      ].forEach((prop) => {
        const val = (style as any)[prop];
        if (val && (val.includes("oklab") || val.includes("oklch"))) {
          // Robust fallback strategy
          if (prop === "backgroundColor")
            htmlEl.style.backgroundColor = "rgb(255, 255, 255)";
          else if (prop === "borderColor")
            htmlEl.style.borderColor = "rgb(226, 232, 240)";
          else htmlEl.style.setProperty(prop, "rgb(30, 41, 59)", "important");
        }
      });

      // Force simple colors for specific classes
      if (htmlEl.classList.contains("bg-indigo-600"))
        htmlEl.style.backgroundColor = "rgb(79, 70, 229)";
      if (htmlEl.classList.contains("text-indigo-600"))
        htmlEl.style.color = "rgb(79, 70, 229)";

      const shadow = style.boxShadow;
      if (shadow && (shadow.includes("oklab") || shadow.includes("oklch"))) {
        htmlEl.style.boxShadow = "none";
      }
    });
  };

  const PDFHeader = ({
    projectName,
    cycleTitle,
  }: {
    projectName: string;
    cycleTitle?: string;
  }) => (
    <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
          FP
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-indigo-600 tracking-wider">
            GESTÃO PRO
          </span>
          <span className="text-[8px] text-slate-400 font-bold uppercase">
            PDCA Expert Analysis
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[300px]">
          {projectName}
        </p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          {cycleTitle || "Relatório PDCA"}
        </p>
      </div>
    </div>
  );

  const exportToPDF = async () => {
    if (!activeCycle) return;
    setIsExportingPDF(true);

    try {
      // Carrega a imagem do logo do sistema para incorporar de forma segura no documento PDF
      const logoBase64 = await getBase64ImageFromUrl(SYSTEM_LOGO_PATH);

      // Filtra as ações válidas do plano de ação do PDCA (removendo as canceladas ou inativas)
      const validActions = (activeCycle.plan.actionPlan || []).filter(
        (item) => item.status !== "Cancelado" && item.ativo !== false,
      );

      // Mapeia o status das ações para exibição e controle do fluxo
      const mappedActions = validActions.map((action) => {
        return {
          ...action,
          displayStatus: translateStatus(action.status),
          effectiveStatus: action.status,
        };
      });

      // Cálculos auxiliares para monitoramento de KPIs de sucesso do plano na fase CHECK
      const totalActions = mappedActions.length;
      const doneActions = mappedActions.filter(
        (item) => item.effectiveStatus === "Concluído",
      ).length;
      const pendingActions = totalActions - doneActions;
      const completionRate =
        totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;

      // Coleta as datas da fase de execução (DO) para extrair o período ativo das tarefas
      const doDates = mappedActions
        .flatMap((a) => [a.startDate, a.endDate])
        .filter(Boolean)
        .map((d) => new Date(d!).getTime());
      const minDoDate =
        doDates.length > 0
          ? format(new Date(Math.min(...doDates)), "dd/MM/yyyy")
          : "---";
      const maxDoDate =
        doDates.length > 0
          ? format(new Date(Math.max(...doDates)), "dd/MM/yyyy")
          : "---";

      // Renderização dinâmica da tabela de ganhos esperados tangíveis
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
                },
                { text: t.unit || "---", style: "tableCell" },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#D3D3D3",
            vLineColor: () => "#D3D3D3",
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        };
      };

      // Mapeamento dinâmico para o título explicativo da Causa Raiz de acordo com a aba PLAN
      const rcaTitleMap: Record<string, string> = {
        "5whys": "02. ANÁLISE DE CAUSA RAIZ (5 PORQUÊS)",
        "list": "02. ANÁLISE DE CAUSA RAIZ (LISTA DE CAUSAS)",
        "ishikawa": "02. ANÁLISE DE CAUSA RAIZ (ISHIKAWA)",
      };
      
      const rcaType = activeCycle.plan.rootCauseAnalysis.type;
      const rcaTitle = rcaTitleMap[rcaType] || "02. ANÁLISE DE CAUSA RAIZ";

      // Função reativa interna que gera o conteúdo estrutural adequado para cada tipo de causa raiz
      const renderRootCauseContent = () => {
        if (rcaType === "5whys") {
          return {
            table: {
              widths: [100, "*"],
              body: [
                [
                  { text: "NÍVEL", style: "tableHeader" },
                  {
                    text: "RESPOSTA / CAUSA IDENTIFICADA",
                    style: "tableHeader",
                  },
                ],
                ...Array.from({ length: 5 }).map((_, i) => {
                  const entry = activeCycle.plan.rootCauseAnalysis.entries[i];
                  return [
                    {
                      text: `${i + 1}º Por quê`,
                      style: "tableCell",
                      bold: true,
                      alignment: "center",
                    },
                    { text: entry?.text || "---", style: "tableCell" },
                  ];
                }),
              ],
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => "#D3D3D3",
              vLineColor: () => "#D3D3D3",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            margin: [0, 5, 0, 24],
          };
        } else if (rcaType === "list") {
          const listEntries = activeCycle.plan.rootCauseAnalysis.entries || [];
          return {
            table: {
              widths: ["*"],
              body: [
                [
                  { text: "CAUSAS IDENTIFICADAS (LISTA DE CAUSAS)", style: "tableHeader" }
                ],
                ...(listEntries.length > 0 
                  ? listEntries.map((e, idx) => [
                      { text: `${idx + 1}. ${e.text || "---"}`, style: "tableCell" }
                    ])
                  : [
                      [{ text: "Nenhuma causa registrada.", style: "tableCell", italic: true }]
                    ])
              ],
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => "#D3D3D3",
              vLineColor: () => "#D3D3D3",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            margin: [0, 5, 0, 24],
          };
        } else if (rcaType === "ishikawa") {
          const ishikawaCategories = activeCycle.plan.rootCauseAnalysis.ishikawa || ishikawaDefaultCategories;
          return {
            table: {
              widths: [120, "*"],
              body: [
                [
                  { text: "CATEGORIA 6M", style: "tableHeader" },
                  { text: "CAUSAS INDIVIDUALIZADAS", style: "tableHeader" }
                ],
                ...ishikawaCategories.map((cat) => [
                  { text: cat.name, style: "tableCell", bold: true },
                  { 
                    text: cat.entries && cat.entries.length > 0 
                      ? cat.entries.map((e, idx) => `${idx + 1}. ${e.text}`).join("\n") 
                      : "Nenhuma causa analisada nesta categoria.", 
                    style: "tableCell" 
                  }
                ])
              ],
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => "#D3D3D3",
              vLineColor: () => "#D3D3D3",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            margin: [0, 5, 0, 24],
          };
        }
        
        return { text: "Método de causa raiz não estruturado ou sem preenchimento.", italic: true, style: "bodyTextSmall" };
      };

      // Agrupa os planos de ação ativamente com seu histórico correspondente de forma isolada e estruturada para a Fase DO
      const planGroupsContents = mappedActions.map((action, idx) => {
        const actionLogs = (action.executionLogs || [])
          .filter((log) => log.observation && log.observation.trim() !== "")
          .map((log) => [
            {
              text: log.timestamp ? format(new Date(log.timestamp), "dd/MM/yy HH:mm") : "---",
              style: "tableCellTiny",
            },
            {
              text: log.responsible || "---",
              style: "tableCellTiny",
            },
            {
              text: log.observation || "---",
              style: "tableCellTiny",
            }
          ]);

        return {
          stack: [
            {
              text: `PLANO ${idx + 1}: ${action.what || "Sem descrição"}`,
              fontSize: 9,
              bold: true,
              color: "#003489",
              margin: [0, 10, 0, 4]
            },
            {
              table: {
                widths: ["15%", "15%", "14%", "14%", "14%", "14%", "14%"],
                body: [
                  [
                    { text: "O QUÊ", style: "tableHeaderTiny" },
                    { text: "POR QUÊ", style: "tableHeaderTiny" },
                    { text: "ONDE", style: "tableHeaderTiny" },
                    { text: "QUANDO", style: "tableHeaderTiny" },
                    { text: "QUEM", style: "tableHeaderTiny" },
                    { text: "COMO", style: "tableHeaderTiny" },
                    { text: "QUANTO", style: "tableHeaderTiny" }
                  ],
                  [
                    { text: action.what || "---", style: "tableCellTiny" },
                    { text: action.why || "---", style: "tableCellTiny" },
                    { text: action.where || "---", style: "tableCellTiny" },
                    { text: action.when || "---", style: "tableCellTiny" },
                    { text: action.who || "---", style: "tableCellTiny" },
                    { text: action.how || "---", style: "tableCellTiny" },
                    { text: action.howMuch || "---", style: "tableCellTiny" }
                  ]
                ]
              },
              margin: [0, 2, 0, 4]
            },
            {
              table: {
                widths: ["50%", "50%"],
                body: [
                  [
                    { text: `INÍCIO: ${action.startDate ? format(new Date(action.startDate), "dd/MM/yyyy") : "---"}`, style: "tableCellTiny", alignment: "left", bold: true },
                    { text: `STATUS ATUAL: ${action.displayStatus}`, style: "tableCellTiny", alignment: "right", bold: true, color: "#003489" }
                  ]
                ]
              },
              layout: "noBorders",
              margin: [0, 0, 0, 6]
            },
            {
              text: "HISTÓRICO DO PLANO (EXECUÇÃO):",
              fontSize: 7,
              bold: true,
              color: "#64748b",
              margin: [0, 4, 0, 2]
            },
            {
              table: {
                headerRows: 1,
                widths: ["15%", "15%", "70%"],
                body: [
                  [
                    { text: "DATA/HORA", style: "tableHeaderTiny" },
                    { text: "USUÁRIO", style: "tableHeaderTiny" },
                    { text: "EVOLUÇÃO DO PLANO", style: "tableHeaderTiny" }
                  ],
                  ...(actionLogs.length > 0 
                    ? actionLogs 
                    : [
                        [
                          { text: "Nenhum histórico registrado com observações para esta ação.", colSpan: 3, style: "tableCellTiny", italic: true },
                          {},
                          {}
                        ]
                      ])
                ]
              },
              layout: "lightHorizontalLines",
              margin: [0, 0, 0, 16]
            }
          ],
          unbreakable: true // Garante que as tabelas de um plano fiquem agrupadas sem quebra indevida de página
        };
      });

      // Definição da estrutura completa do documento PDF com sua paginação obrigatória de 5 páginas
      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 40, 40, 60],
        images: {
          logo: logoBase64,
        },
        footer: (currentPage: number, pageCount: number) => {
          return {
            margin: [40, 10, 40, 0],
            stack: [
              {
                canvas: [
                  {
                    type: "line",
                    x1: 0,
                    y1: 0,
                    x2: 515,
                    y2: 0,
                    lineWidth: 0.5,
                    lineColor: "#D3D3D3",
                  },
                ],
              },
              {
                columns: [
                  { width: 100, text: "", style: "footerText" },
                  {
                    width: "*",
                    text: `GIP FLOW – Melhoria Contínua`,
                    style: "footerText",
                    alignment: "center",
                  },
                  {
                    width: 100,
                    text: `Página ${currentPage} de ${pageCount}`,
                    alignment: "right",
                    style: "footerText",
                  },
                ],
                margin: [0, 10, 0, 0],
              },
            ],
          };
        },
        content: [
          // ============================== PÁGINA 1 ==============================
          // TOPO: LOGO (Regra: width 220px, height auto, no clipping)
          {
            image: "logo",
            width: 220,
            alignment: "left",
            margin: [0, 0, 0, 24],
          },
          // CABEÇALHO PRINCIPAL DO RELATÓRIO
          {
            text: "RELATÓRIO TÉCNICO DE MELHORIA",
            style: "mainTitle",
            alignment: "center",
            margin: [0, 0, 0, 15],
          },
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    columns: [
                      {
                        text: `Projeto Mãe: ${project.name.toUpperCase()}`,
                        style: "metadataText",
                      },
                      {
                        text: `Emissão: ${format(new Date(), "dd/MM/yyyy")}`,
                        style: "metadataText",
                        alignment: "right",
                      },
                    ],
                    margin: [8, 4, 8, 4],
                  },
                ],
              ],
            },
            layout: {
              fillColor: () => "#f3f4f6",
              hLineWidth: () => 0,
              vLineWidth: () => 0,
            },
            margin: [0, 0, 0, 20],
          },

          // SEÇÃO 01: RESUMO EXECUTIVO
          {
            table: {
              widths: ["*"],
              body: [
                [{ text: "01. RESUMO EXECUTIVO", style: "sectionHeader" }],
              ],
            },
            layout: "noBorders",
            margin: [0, 10, 0, 5],
          },
          {
            stack: [
              {
                text: "DEFINIÇÃO DO PROBLEMA",
                style: "fieldLabel",
                margin: [0, 8, 0, 4],
              },
              {
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text:
                          activeCycle.plan.problemDescription ||
                          "Não descrito.",
                        style: "bodyHighlight",
                        margin: [10, 8, 10, 8],
                      },
                    ],
                  ],
                },
                layout: {
                  fillColor: () => "#f9fafb",
                  hLineWidth: () => 1,
                  vLineWidth: () => 1,
                  hLineColor: () => "#D3D3D3",
                  vLineColor: () => "#D3D3D3",
                },
              },
            ],
            margin: [0, 0, 0, 16],
          },
          {
            columns: [
              {
                width: "50%",
                stack: [
                  {
                    text: "CAUSA RAIZ PRIORITÁRIA",
                    style: "fieldLabel",
                    margin: [0, 0, 0, 4],
                  },
                  {
                    text:
                      activeCycle.plan.rootCauseAnalysis.identifiedRootCause ||
                      "Pendente de análise profunda",
                    style: "bodyHighlight",
                    bold: true,
                    color: "#003489",
                  },
                ],
              },
              {
                width: "50%",
                stack: [
                  {
                    text: "GANHOS TANGÍVEIS (ALVO)",
                    style: "fieldLabel",
                    margin: [0, 0, 0, 4],
                  },
                  renderGainsTable(activeCycle.plan.impact.expectedGains),
                ],
              },
            ],
            columnGap: 24,
            margin: [0, 0, 0, 24],
          },

          // SEÇÃO 02: ANÁLISE DE CAUSA RAIZ (MÉTODO DINÂMICO)
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: rcaTitle,
                    style: "sectionHeader",
                  },
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 10, 0, 5],
          },
          renderRootCauseContent(),
          // Bloco que exibe dinamicamente a causa raiz identificada no PDCA, independente do método utilizado
          {
            stack: [
              {
                text: "CAUSA RAIZ IDENTIFICADA",
                style: "fieldLabel",
                margin: [0, 8, 0, 4],
              },
              {
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text:
                          activeCycle.plan.rootCauseAnalysis.identifiedRootCause ||
                          "Não informada.",
                        style: "bodyHighlight",
                        margin: [10, 8, 10, 8],
                      },
                    ],
                  ],
                },
                layout: {
                  fillColor: () => "#f9fafb",
                  hLineWidth: () => 1,
                  vLineWidth: () => 1,
                  hLineColor: () => "#D3D3D3",
                  vLineColor: () => "#D3D3D3",
                },
              },
            ],
            margin: [0, 0, 0, 24],
          },

          // ============================== PÁGINA 2 ==============================
          // SEÇÃO 03: PLANO DE AÇÃO (5W2H) – COM MARCADOR DE PÁGINA ANTECEDENTE
          {
            table: {
              widths: ["*"],
              body: [
                [{ text: "03. PLANO DE AÇÃO (5W2H)", style: "sectionHeader" }],
              ],
            },
            layout: "noBorders",
            pageBreak: "before",
            margin: [0, 10, 0, 5],
          },
          {
            table: {
              headerRows: 1,
              widths: ["15%", "15%", "14%", "14%", "14%", "14%", "14%"],
              body: [
                [
                  { text: "O QUÊ", style: "tableHeaderTiny" },
                  { text: "POR QUÊ", style: "tableHeaderTiny" },
                  { text: "ONDE", style: "tableHeaderTiny" },
                  { text: "QUANDO", style: "tableHeaderTiny" },
                  { text: "QUEM", style: "tableHeaderTiny" },
                  { text: "COMO", style: "tableHeaderTiny" },
                  { text: "QUANTO", style: "tableHeaderTiny" },
                ],
                ...(activeCycle.plan.actionPlan || [])
                  .filter(
                    (item) =>
                      item.status !== "Cancelado" && item.ativo !== false,
                  )
                  .map((action) => [
                    { text: action.what || "---", style: "tableCellTiny" },
                    { text: action.why || "---", style: "tableCellTiny" },
                    { text: action.where || "---", style: "tableCellTiny" },
                    { text: action.when || "---", style: "tableCellTiny" },
                    { text: action.who || "---", style: "tableCellTiny" },
                    { text: action.how || "---", style: "tableCellTiny" },
                    { text: action.howMuch || "---", style: "tableCellTiny" },
                  ]),
              ],
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => "#D3D3D3",
              vLineColor: () => "#D3D3D3",
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 5, 0, 24],
            unbreakable: true,
          },

          // SEÇÃO 04: IMPACTO ATUAL DO PROBLEMA
          {
            table: {
              widths: ["*"],
              body: [
                [{ text: "04. IMPACTO ATUAL DO PROBLEMA", style: "sectionHeader" }],
              ],
            },
            layout: "noBorders",
            margin: [0, 10, 0, 5],
          },
          {
            stack: [
              {
                columns: [
                  {
                    width: "40%",
                    stack: [
                      { text: "VALOR DO IMPACTO ATUAL", style: "fieldLabel", margin: [0, 0, 0, 4] },
                      { 
                        text: activeCycle.plan.impact.value 
                          ? `R$ ${parseFloat(activeCycle.plan.impact.value.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                          : "Não informado", 
                        style: "bodyHighlight", 
                        bold: true, 
                        color: "#DC2626" 
                      }
                    ]
                  },
                  {
                    width: "30%",
                    stack: [
                      { text: "META DE REDUÇÃO (%)", style: "fieldLabel", margin: [0, 0, 0, 4] },
                      { text: (activeCycle.plan.impact.improvementPercentage ?? activeCycle.plan.impact.goal) ? `${activeCycle.plan.impact.improvementPercentage ?? activeCycle.plan.impact.goal}%` : "0%", style: "bodyHighlight", bold: true, color: "#059669" }
                    ]
                  },
                  {
                    width: "30%",
                    stack: [
                      { text: "GANHOS ESPERADOS", style: "fieldLabel", margin: [0, 0, 0, 4] },
                      { text: activeCycle.plan.impact.expectedGains?.tangible && activeCycle.plan.impact.expectedGains.tangible.length > 0 ? `${activeCycle.plan.impact.expectedGains.tangible.length} ganho(s) mapeado(s)` : "Não mapeado", style: "bodyHighlight" }
                    ]
                  }
                ],
                margin: [0, 0, 0, 12]
              },
              {
                text: "DESCRIÇÃO DO IMPACTO / CONTEXTUALIZAÇÃO",
                style: "fieldLabel",
                margin: [0, 6, 0, 4]
              },
              {
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: activeCycle.plan.impact.description || "Descrição detalhada do impacto atual não informada.",
                        style: "bodyTextSmall",
                        margin: [8, 6, 8, 5]
                      }
                    ]
                  ],
                },
                layout: {
                  fillColor: () => "#f9fafb",
                  hLineWidth: () => 1,
                  vLineWidth: () => 1,
                  hLineColor: () => "#D3D3D3",
                  vLineColor: () => "#D3D3D3",
                }
              }
            ],
            margin: [0, 5, 0, 24]
          },

          // ============================== PÁGINA 3 ==============================
          // SEÇÃO 05: FASE DO – EXECUÇÃO (COM QUEBRA DE PÁGINA E AGRUPADO POR PLANO SEM EVIDÊNCIAS)
          {
            table: {
              widths: ["*"],
              body: [
                [{ text: "05. FASE DO – EXECUÇÃO", style: "sectionHeader" }],
              ],
            },
            layout: "noBorders",
            pageBreak: "before",
            margin: [0, 10, 0, 5],
          },
          {
            stack: [
              {
                text: "RESUMO DA EXECUÇÃO DO PLANO",
                style: "fieldLabel",
                margin: [0, 8, 0, 4],
              },
              {
                columns: [
                  {
                    width: "60%",
                    text: [
                      {
                        text: "OBJETIVO: ",
                        bold: true,
                        color: "#003489",
                        fontSize: 8,
                      },
                      {
                        text:
                          activeCycle.plan.problemDescription ||
                          "Executar plano de ação para solução do problema.",
                        fontSize: 9,
                      },
                    ],
                  },
                  {
                    width: "40%",
                    text: [
                      {
                        text: "PERÍODO: ",
                        bold: true,
                        color: "#003489",
                        fontSize: 8,
                      },
                      { text: `${minDoDate} a ${maxDoDate}`, fontSize: 9 },
                    ],
                    alignment: "right",
                  },
                ],
                margin: [0, 0, 0, 12],
              },
              {
                text: "ORGANIZAÇÃO AGRUPADA DOS PLANOS DE AÇÃO E HISTÓRICO",
                style: "fieldLabel",
                margin: [0, 12, 0, 2],
              },
              ...planGroupsContents
            ],
            margin: [0, 0, 0, 20],
          },

          // ============================== PÁGINA 4 ==============================
          // SEÇÃO 06: FASE CHECK – VERIFICAÇÃO – COM MARCADOR DE PÁGINA ANTECEDENTE
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: "06. FASE CHECK – VERIFICAÇÃO",
                    style: "sectionHeader",
                  },
                ],
              ],
            },
            layout: "noBorders",
            pageBreak: "before",
            margin: [0, 10, 0, 5],
          },
          {
            stack: [
              {
                columns: [
                  {
                    width: "50%",
                    stack: [
                      {
                        text: "INDICADORES DE DESEMPENHO (KPIs)",
                        style: "fieldLabel",
                        margin: [0, 8, 0, 4],
                      },
                      {
                        table: {
                          widths: ["*", "auto"],
                          body: [
                            [
                              { text: "Ações Totais", style: "tableCellTiny" },
                              {
                                text: totalActions.toString(),
                                style: "tableCellTiny",
                                bold: true,
                              },
                            ],
                            [
                              {
                                text: "Ações Concluídas",
                                style: "tableCellTiny",
                              },
                              {
                                text: doneActions.toString(),
                                style: "tableCellTiny",
                                bold: true,
                              },
                            ],
                            [
                              {
                                text: "Ações Pendentes/Andamento",
                                style: "tableCellTiny",
                              },
                              {
                                text: pendingActions.toString(),
                                style: "tableCellTiny",
                                bold: true,
                              },
                            ],
                            [
                              {
                                text: "% de Conclusão",
                                style: "tableCellTiny",
                                bold: true,
                                color: "#003489",
                              },
                              {
                                text: `${completionRate}%`,
                                style: "tableCellTiny",
                                bold: true,
                                color: "#003489",
                              },
                            ],
                          ],
                        },
                      },
                    ],
                  },
                  {
                    width: "50%",
                    stack: [
                      {
                        text: "PROBLEMAS IDENTIFICADOS NA EXECUÇÃO",
                        style: "fieldLabel",
                        margin: [0, 8, 0, 4],
                      },
                      {
                        ul: validActions
                          .filter(
                            (item) =>
                              item.worked === "Não" ||
                              item.worked === "Parcial",
                          )
                          .map((item) => ({
                            text: `${item.what}: ${item.failureReason || "Não obteve o resultado esperado."}`,
                            fontSize: 8,
                          }))
                          .slice(0, 5),
                      },
                    ],
                  },
                ],
                columnGap: 24,
                margin: [0, 0, 0, 16],
              },
              {
                text: "RESULTADOS REGISTRADOS (GANHOS REAIS)",
                style: "fieldLabel",
                margin: [0, 8, 0, 4],
              },
              ...mappedActions
                .filter(
                  (item) =>
                    item.effectiveStatus === "Concluído" &&
                    item.realGains &&
                    (item.realGains.tangible.length > 0 ||
                      item.realGains.intangible.length > 0),
                )
                .flatMap((item) => [
                  {
                    text: `Ação: ${item.what}`,
                    fontSize: 8,
                    bold: true,
                    margin: [0, 4, 0, 2],
                  },
                  renderGainsTable(item.realGains),
                  item.realGains?.intangible &&
                  item.realGains.intangible.length > 0
                    ? {
                        ul: item.realGains.intangible.map((ig) => ({
                          text: `${ig.type}: ${ig.description} (Impacto: ${ig.impactLevel})`,
                          fontSize: 7,
                        })),
                        margin: [10, 2, 0, 4],
                      }
                    : {},
                ]),

              {
                text: "ANÁLISE (RESULTADOS ATINGIDOS)",
                style: "fieldLabel",
                margin: [0, 12, 0, 4],
              },
              {
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        text: mappedActions.some((i) => i.worked === "Não")
                          ? "Algumas ações não atingiram o resultado esperado ou apresentaram falhas parciais. Problemas foram detectados na fase de execução, necessitando reavaliação nas diretrizes de ACT para correção de rota."
                          : "As ações executadas demonstraram total eficácia conforme os critérios definidos na fase de planejamento. Os ganhos reais confirmam a mitigação da causa raiz identificada e estabilidade do processo.",
                        style: "bodyHighlight",
                        margin: [10, 8, 10, 8],
                      },
                    ],
                  ],
                },
                layout: {
                  fillColor: () => "#f9fafb",
                  hLineWidth: () => 1,
                  vLineWidth: () => 1,
                  hLineColor: () => "#D3D3D3",
                  vLineColor: () => "#D3D3D3",
                },
                margin: [0, 0, 0, 16],
              },
              {
                text: "CONCLUSÃO DA FASE CHECK",
                style: "fieldLabel",
                margin: [0, 8, 0, 4],
              },
              {
                text: [
                  {
                    text: "STATUS FINAL: ",
                    bold: true,
                    color: "#003489",
                    fontSize: 9,
                  },
                  {
                    text: isCheckPhaseValid
                      ? "VERIFICADO E VALIDADO"
                      : "EM PROCESSO DE VERIFICAÇÃO",
                    fontSize: 9,
                    bold: true,
                  },
                ],
              },
            ],
            margin: [0, 0, 0, 20],
          },

          // ============================== PÁGINA 5 ==============================
          // SEÇÃO 07: PADRONIZAÇÃO E ENCERRAMENTO (ACT) – COM MARCADOR DE PÁGINA ANTECEDENTE
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: "07. PADRONIZAÇÃO E ENCERRAMENTO (ACT)",
                    style: "sectionHeader",
                  },
                ],
              ],
            },
            layout: "noBorders",
            pageBreak: "before",
            margin: [0, 10, 0, 5],
          },
          {
            stack: [
              {
                text: "AÇÕES E STATUS FINAIS",
                style: "fieldLabel",
                margin: [0, 8, 0, 4],
              },
              {
                table: {
                  headerRows: 1,
                  widths: ["40%", "20%", "20%", "20%"],
                  body: [
                    [
                      { text: "AÇÃO", style: "tableHeaderTiny" },
                      { text: "STATUS FINAL", style: "tableHeaderTiny" },
                      { text: "AÇÃO FINAL", style: "tableHeaderTiny" },
                      { text: "PADRONIZAÇÃO", style: "tableHeaderTiny" },
                    ],
                    ...mappedActions.map((item) => [
                      { text: item.what || "---", style: "tableCellTiny" },
                      {
                        text: item.finalProblemStatus || "---",
                        style: "tableCellTiny",
                        color:
                          item.finalProblemStatus === "Resolvido"
                            ? "#059669"
                            : "#DC2626",
                      },
                      {
                        text: item.finalAction || "---",
                        style: "tableCellTiny",
                      },
                      {
                        text: item.standardizationModels?.join(", ") || "N/A",
                        style: "tableCellTiny",
                      },
                    ]),
                  ],
                },
                layout: "lightHorizontalLines",
              },
            ],
          },
        ],
        styles: {
          mainTitle: { fontSize: 18, bold: true, color: "#003489" },
          metadataText: { fontSize: 9, bold: true, color: "#4b5563" },
          sectionHeader: {
            fontSize: 12,
            bold: true,
            color: "#FFFFFF",
            fillColor: "#003489",
            margin: [8, 4, 8, 4],
          },
          fieldLabel: { fontSize: 8, bold: true, color: "#64748b" },
          bodyHighlight: { fontSize: 10, color: "#1e293b" },
          bodyTextSmall: { fontSize: 9, color: "#4b5563", lineHeight: 1.4 },
          tableHeader: {
            fontSize: 9,
            bold: true,
            color: "#FFFFFF",
            fillColor: "#003489",
            alignment: "center",
          },
          tableHeaderTiny: {
            fontSize: 7,
            bold: true,
            color: "#FFFFFF",
            fillColor: "#003489",
            alignment: "center",
          },
          tableCell: { fontSize: 9, color: "#334155" },
          tableCellTiny: { fontSize: 7, color: "#334155", alignment: "center" },
          footerText: { fontSize: 8, bold: true, color: "#64748b" },
        },
        defaultStyle: {
          font: "Roboto",
        },
      };

      pdfMake
        .createPdf(docDefinition)
        .download(
          `PDCA_${activeCycle.title.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`,
        );
      setSaveFeedback("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setSaveFeedback("Erro na geração do PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const renderIshikawa = () => {
    if (!activeCycle) return null;
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(
            activeCycle.plan.rootCauseAnalysis.ishikawa ||
            ishikawaDefaultCategories
          ).map((cat, catIdx) => (
            <div
              key={cat.id}
              className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-black text-slate-800 text-xs uppercase tracking-widest">
                    {cat.name}
                  </h5>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {cat.description}
                  </p>
                </div>
                <button
                  disabled={(cat.entries?.length || 0) >= 3}
                  onClick={() => {
                    const currentIshikawa =
                      activeCycle.plan.rootCauseAnalysis.ishikawa ||
                      ishikawaDefaultCategories;
                    const newIshikawa = currentIshikawa.map((c, i) => {
                      if (i === catIdx)
                        return {
                          ...c,
                          entries: [
                            ...(c.entries || []),
                            { id: uuidv4(), text: "" },
                          ],
                        };
                      return c;
                    });
                    updatePlan({
                      rootCauseAnalysis: {
                        ...activeCycle.plan.rootCauseAnalysis,
                        ishikawa: newIshikawa,
                      },
                    });
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    (cat.entries?.length || 0) >= 3
                      ? "text-slate-300"
                      : "bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm",
                  )}
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {cat.entries.map((entry, entryIdx) => (
                  <div key={entry.id} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Causa..."
                      value={entry.text || ""}
                      onChange={(e) => {
                        const currentIshikawa =
                          activeCycle.plan.rootCauseAnalysis.ishikawa ||
                          ishikawaDefaultCategories;
                        const newIshikawa = [...currentIshikawa];
                        const newEntries = [...newIshikawa[catIdx].entries];
                        newEntries[entryIdx] = {
                          ...newEntries[entryIdx],
                          text: e.target.value,
                        };
                        newIshikawa[catIdx] = {
                          ...newIshikawa[catIdx],
                          entries: newEntries,
                        };
                        updatePlan({
                          rootCauseAnalysis: {
                            ...activeCycle.plan.rootCauseAnalysis,
                            ishikawa: newIshikawa,
                          },
                        });
                      }}
                      className="flex-1 p-2 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium shadow-sm transition-all"
                    />
                    <button
                      onClick={() => {
                        const currentIshikawa =
                          activeCycle.plan.rootCauseAnalysis.ishikawa ||
                          ishikawaDefaultCategories;
                        const newIshikawa = [...currentIshikawa];
                        newIshikawa[catIdx] = {
                          ...newIshikawa[catIdx],
                          entries: newIshikawa[catIdx].entries.filter(
                            (_, i) => i !== entryIdx,
                          ),
                        };
                        updatePlan({
                          rootCauseAnalysis: {
                            ...activeCycle.plan.rootCauseAnalysis,
                            ishikawa: newIshikawa,
                          },
                        });
                      }}
                      className="text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center">
              <Target size={24} />
            </div>
            <div>
              <h4 className="text-lg font-black tracking-tight">
                Causas Prioritárias
              </h4>
              <p className="text-slate-400 text-xs font-medium">
                Selecione até 3 causas principais para focar no plano de ação.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allIshikawaCauses.length === 0 ? (
              <p className="text-slate-500 text-xs italic p-4 border border-dashed border-slate-800 rounded-2xl col-span-full text-center">
                Preencha as causas acima para priorizar.
              </p>
            ) : (
              allIshikawaCauses.map((cause, cIdx) => {
                const isSelected = (
                  activeCycle.plan.rootCauseAnalysis.priorityCauses || []
                ).includes(cause);
                return (
                  <button
                    key={`${cause}-${cIdx}`}
                    onClick={() => {
                      const current =
                        activeCycle.plan.rootCauseAnalysis.priorityCauses || [];
                      if (isSelected)
                        updatePlan({
                          rootCauseAnalysis: {
                            ...activeCycle.plan.rootCauseAnalysis,
                            priorityCauses: current.filter((c) => c !== cause),
                          },
                        });
                      else
                        updatePlan({
                          rootCauseAnalysis: {
                            ...activeCycle.plan.rootCauseAnalysis,
                            priorityCauses: [...current, cause],
                          },
                        });
                    }}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                      isSelected
                        ? "bg-indigo-600 border-indigo-400 text-white shadow-lg"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected
                          ? "border-white bg-white text-indigo-600"
                          : "border-slate-600",
                      )}
                    >
                      {isSelected && <CheckCircle2 size={12} />}
                    </div>
                    <span className="text-xs font-bold truncate">{cause}</span>
                  </button>
                );
              })
            )}
          </div>
          {(activeCycle.plan.rootCauseAnalysis.priorityCauses || []).length >
            0 && (
            <div className="pt-4 border-t border-slate-800">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                Selecionadas (
                {activeCycle.plan.rootCauseAnalysis.priorityCauses?.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {activeCycle.plan.rootCauseAnalysis.priorityCauses?.map(
                  (cause, cIdx) => (
                    <span
                      key={`${cause}-${cIdx}`}
                      className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                    >
                      {cause}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  const renderStandardCauses = () => {
    if (!activeCycle) return null;
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {activeCycle.plan.rootCauseAnalysis.entries.map((entry, idx) => (
            <div key={entry.id} className="flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black shadow-sm shrink-0 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 group-focus-within:border-indigo-100 transition-all">
                {activeCycle.plan.rootCauseAnalysis.type === "5whys" ? (
                  idx + 1
                ) : (
                  <HelpCircle size={16} />
                )}
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder={
                    activeCycle.plan.rootCauseAnalysis.type === "5whys"
                      ? `Por quê ${idx + 1}?`
                      : "Descreva a causa..."
                  }
                  value={entry.text || ""}
                  onChange={(e) => {
                    const newEntries = [
                      ...activeCycle.plan.rootCauseAnalysis.entries,
                    ];
                    newEntries[idx].text = e.target.value;
                    updatePlan({
                      rootCauseAnalysis: {
                        ...activeCycle.plan.rootCauseAnalysis,
                        entries: newEntries,
                      },
                    });
                  }}
                  className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-inner transition-all"
                />
                {activeCycle.plan.rootCauseAnalysis.type === "list" && (
                  <button
                    onClick={() => {
                      const newEntries =
                        activeCycle.plan.rootCauseAnalysis.entries.filter(
                          (_, i) => i !== idx,
                        );
                      updatePlan({
                        rootCauseAnalysis: {
                          ...activeCycle.plan.rootCauseAnalysis,
                          entries: newEntries,
                        },
                      });
                    }}
                    className="p-4 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {activeCycle.plan.rootCauseAnalysis.type === "list" && (
            <button
              onClick={() =>
                updatePlan({
                  rootCauseAnalysis: {
                    ...activeCycle.plan.rootCauseAnalysis,
                    entries: [
                      ...activeCycle.plan.rootCauseAnalysis.entries,
                      { id: uuidv4(), text: "" },
                    ],
                  },
                })
              }
              className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 font-black text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Adicionar Causa
            </button>
          )}
        </div>

        <div className="p-8 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <Target size={18} />
            </div>
            <h5 className="font-black text-xs uppercase tracking-widest">
              Causa raiz identificada
            </h5>
          </div>
          <textarea
            placeholder="Após a análise, qual a causa raiz definitiva?"
            value={activeCycle.plan.rootCauseAnalysis.identifiedRootCause || ""}
            onChange={(e) =>
              updatePlan({
                rootCauseAnalysis: {
                  ...activeCycle.plan.rootCauseAnalysis,
                  identifiedRootCause: e.target.value,
                },
              })
            }
            className={cn(
              "w-full p-6 bg-white border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm min-h-[120px] transition-all",
              showValidationErrors &&
                !activeCycle.plan.rootCauseAnalysis.identifiedRootCause?.trim()
                ? "border-rose-300 ring-4 ring-rose-50"
                : "border-indigo-100",
            )}
          />
          {!activeCycle.plan.rootCauseAnalysis.identifiedRootCause && (
            <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
              <AlertCircle size={14} /> Identificação obrigatória para
              prosseguir
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActionPlanItem = (item: ActionPlanItem, index: number) => {
    return (
      <div
        key={item.id}
        className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6 relative group transition-all hover:bg-white hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-200">
              {index + 1}
            </div>
            <div>
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Ação Corretiva
              </h5>
              <p className="text-xs font-bold text-slate-600">
                Planejamento 5W2H
              </p>
            </div>
          </div>
          <button
            onClick={() => removeActionPlanItem(item.id)}
            className="text-slate-300 hover:text-rose-500 transition-colors p-2 bg-white rounded-xl shadow-sm border border-slate-100"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                What (O que?)
              </label>
              <textarea
                value={item.what || ""}
                placeholder="Descrição clara da ação..."
                onChange={(e) =>
                  updateActionPlan(item.id, { what: e.target.value }, true)
                }
                onBlur={() => updateActionPlan(item.id, {})}
                className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 min-h-[100px] shadow-sm resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                Why (Por que?)
              </label>
              <textarea
                value={item.why || ""}
                placeholder="Motivo desta ação..."
                onChange={(e) =>
                  updateActionPlan(item.id, { why: e.target.value }, true)
                }
                onBlur={() => updateActionPlan(item.id, {})}
                className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 min-h-[100px] shadow-sm resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                Where (Onde?)
              </label>
              <input
                value={item.where || ""}
                placeholder="Local..."
                onChange={(e) =>
                  updateActionPlan(item.id, { where: e.target.value }, true)
                }
                onBlur={() => updateActionPlan(item.id, {})}
                className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                When (Quando?)
              </label>
              <input
                type="date"
                value={item.when || ""}
                onChange={(e) =>
                  updateActionPlan(item.id, { when: e.target.value }, true)
                }
                onBlur={() => updateActionPlan(item.id, {})}
                className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 shadow-sm h-[58px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                Who (Quem?)
              </label>
              <input
                value={item.who || ""}
                placeholder="Responsável..."
                onChange={(e) =>
                  updateActionPlan(item.id, { who: e.target.value }, true)
                }
                onBlur={() => updateActionPlan(item.id, {})}
                className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              How (Como?)
            </label>
            <textarea
              value={item.how || ""}
              placeholder="Método de execução..."
              onChange={(e) =>
                updateActionPlan(item.id, { how: e.target.value }, true)
              }
              onBlur={() => updateActionPlan(item.id, {})}
              className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 min-h-[80px] shadow-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              How Much (Custo)
            </label>
            <input
              value={item.howMuch || ""}
              placeholder="Ex: R$ 0,00"
              onChange={(e) =>
                updateActionPlan(item.id, { howMuch: e.target.value }, true)
              }
              onBlur={() => updateActionPlan(item.id, {})}
              className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 shadow-sm"
            />
          </div>
        </div>
      </div>
    );
  };

  const dashboardStats = useMemo(() => {
    const total = cycles.length;
    const resolved = cycles.filter((c) => c.status === "Concluído").length;
    const inProgress = cycles.filter((c) => c.status === "Ativo").length;

    return { total, resolved, inProgress };
  }, [cycles]);

  if (showDashboard) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <ChevronRight size={24} className="rotate-180" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <RefreshCw size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  Dashboard PDCA
                </h3>
                <p className="text-sm text-slate-400 font-medium">
                  Melhoria Contínua Integrada
                </p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Total"
              value={dashboardStats.total}
              icon={<AlertCircle />}
              color="indigo"
            />
            <StatCard
              title="Andamento"
              value={dashboardStats.inProgress}
              icon={<Clock />}
              color="amber"
            />
            <StatCard
              title="Resolvidos"
              value={dashboardStats.resolved}
              icon={<CheckCircle2 />}
              color="emerald"
            />
          </div>

          {/* Cycles List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                Acompanhamento de Ciclos
              </h4>
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
                <p className="text-sm">
                  Clique em "Identificar Problemas" para começar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    onClick={() => {
                      setActiveCycleId(cycle.id);
                      setActivePhase(cycle.etapaAtual || "PLAN");
                      setShowDashboard(false);
                    }}
                    className={cn(
                      "bg-white p-6 rounded-2xl border transition-all cursor-pointer group shadow-sm",
                      cycle.status === "Concluído"
                        ? "border-slate-100 opacity-75 grayscale-[0.5]"
                        : "border-slate-200 hover:border-indigo-300",
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5
                          className={cn(
                            "font-bold transition-colors",
                            cycle.status === "Concluído"
                              ? "text-slate-500"
                              : "text-slate-800 group-hover:text-indigo-600",
                          )}
                        >
                          {cycle.title}
                        </h5>
                        <p className="text-xs text-slate-400 mt-1">
                          Iniciado em{" "}
                          {format(new Date(cycle.createdAt), "dd/MM/yyyy")}
                        </p>
                        {(() => {
                          const linkedStCount = (project.subtasks || []).filter(s => (s.pdcaCycles || []).some(c => c.id === cycle.id)).length;
                          if (linkedStCount <= 1) return null;
                          return (
                            <div className="mt-2 inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                              <Link2 size={10} />
                              <span>Vinculado a {linkedStCount} subtarefas</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={cycle.status} />
                        {isMaster && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCycleToDelete(cycle);
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/50 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                            title="Excluir ciclo PDCA"
                          >
                            <Trash2 size={14} />
                            <span>Excluir ciclo PDCA</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Progresso</span>
                        <span>{getProgress(cycle)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-500"
                          style={{
                            width: `${getProgress(cycle)}%`,
                          }}
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
                  <h3 className="text-xl font-black text-slate-800">
                    Identificar Problemas do Fluxo
                  </h3>
                  <button
                    onClick={() => setShowProblemsModal(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                  {problemsFromMapping.length === 0 ? (
                    <div className="py-12 text-center space-y-4">
                      <AlertCircle
                        size={48}
                        className="mx-auto text-slate-200"
                      />
                      <p className="text-slate-500 font-medium">
                        Nenhuma "Etapa Problema" identificada no mapeamento.
                      </p>
                      <p className="text-xs text-slate-400">
                        Marque as etapas críticas no fluxograma para que elas
                        apareçam aqui.
                      </p>
                    </div>
                  ) : (
                    problemsFromMapping.map((p) => {
                      const hasActiveCycle = subtask.pdcaCycles.some(
                        (c) => c.taskId === p.id && c.status === "Ativo",
                      );
                      const completedCycles = subtask.pdcaCycles.filter(
                        (c) => c.taskId === p.id && c.status === "Concluído",
                      );
                      const isCompleted =
                        completedCycles.length > 0 && !hasActiveCycle;

                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "p-4 border rounded-2xl flex items-center justify-between group transition-all",
                            hasActiveCycle
                              ? "bg-indigo-50 border-indigo-200"
                              : isCompleted
                                ? "bg-slate-50 border-slate-200 opacity-80"
                                : "bg-slate-50 border-slate-200 hover:border-indigo-300",
                          )}
                        >
                          <div>
                            <p className="font-bold text-slate-800">
                              {p.label}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-black bg-[#FF6B6B] text-white px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                <AlertCircle size={10} /> Problema
                              </span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full" />
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                <Clock size={10} /> {p.time} min
                              </span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {p.role}
                              </span>
                              {hasActiveCycle && (
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                                  <RefreshCw
                                    size={10}
                                    className="animate-spin-slow"
                                  />{" "}
                                  Ciclo Ativo
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
                              onClick={() => handleStartPdcaFlow(p.id, p.label)}
                              className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm border border-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                            >
                              {isCompleted
                                ? "Iniciar Novo Ciclo"
                                : "Iniciar PDCA"}
                            </button>
                          )}
                          {hasActiveCycle && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const activeCycle = subtask.pdcaCycles.find(
                                    (c) =>
                                      c.taskId === p.id && c.status === "Ativo",
                                  );
                                  if (activeCycle) {
                                    setActiveCycleId(activeCycle.id);
                                    setActivePhase(
                                      activeCycle.etapaAtual || "PLAN",
                                    );
                                    setShowDashboard(false);
                                    setShowProblemsModal(false);
                                  }
                                }}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-indigo-700 transition-all"
                              >
                                Ver Ciclo
                              </button>
                              {isMaster && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const activeCycle = subtask.pdcaCycles.find(
                                      (c) =>
                                        c.taskId === p.id && c.status === "Ativo",
                                    );
                                    if (activeCycle) {
                                      setCycleToDelete(activeCycle);
                                    }
                                  }}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/50 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                                  title="Excluir ciclo PDCA"
                                >
                                  <Trash2 size={14} />
                                  <span>Excluir ciclo PDCA</span>
                                </button>
                              )}
                            </div>
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

        <AnimatePresence>
          {cycleToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-left"
              >
                <div className="flex items-center gap-3 text-rose-500 mb-3">
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                    <Trash2 size={22} />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                    Excluir ciclo PDCA
                  </h3>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-6">
                  Deseja realmente excluir este ciclo PDCA?{"\n\n"}
                  Essa ação não poderá ser desfeita.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCycleToDelete(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmDeleteCycle(cycleToDelete.id)}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shadow-md transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Iniciar ou Vincular PDCA */}
        <AnimatePresence>
          {startOrLinkConfig?.isOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-left overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6 shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <RefreshCw size={20} />
                      </span>
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">
                        {startOrLinkMode === "choice"
                          ? "Iniciar ou Vincular PDCA"
                          : "Vincular a PDCA Existente"}
                      </h3>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      Etapa:{" "}
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                        {startOrLinkConfig.taskLabel}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStartOrLinkConfig(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl transition-all"
                  >
                    <Plus size={20} className="rotate-45" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                  {startOrLinkMode === "choice" ? (
                    <div className="space-y-4">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Como você deseja estruturar o ciclo de melhoria contínua para esta etapa?
                      </p>

                      {/* Option 1: Iniciar Novo PDCA */}
                      <div
                        onClick={() => {
                          createNewCycle(
                            startOrLinkConfig.taskId,
                            startOrLinkConfig.taskLabel
                          );
                          setStartOrLinkConfig(null);
                        }}
                        className="p-5 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 rounded-2xl cursor-pointer transition-all group flex items-start gap-4 shadow-sm"
                      >
                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                          <PlusCircle size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              Iniciar Novo PDCA
                            </h4>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              Padrão
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Cria um ciclo PDCA totalmente novo e independente focado exclusivamente nos problemas e causas desta etapa.
                          </p>
                        </div>
                      </div>

                      {/* Option 2: Vincular a PDCA Existente */}
                      <div
                        onClick={() => {
                          setStartOrLinkMode("link");
                          if (projectPDCAs.length > 0) {
                            const firstCycle = projectPDCAs[0];
                            setSelectedPdcaToLink(firstCycle.cycle.id);
                            const alreadyLinkedSubtaskIds = firstCycle.subtasks.map(
                              (s) => s.id
                            );
                            setSelectedSubtasksToLink(
                              Array.from(
                                new Set([subtask.id, ...alreadyLinkedSubtaskIds])
                              )
                            );
                          }
                        }}
                        className="p-5 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 rounded-2xl cursor-pointer transition-all group flex items-start gap-4 shadow-sm"
                      >
                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                          <Link2 size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              Vincular a PDCA Existente
                            </h4>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              Compartilhar
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Conecta esta etapa a um ciclo PDCA já cadastrado no projeto. O plano de ação e evolução serão compartilhados entre as subtarefas vinculadas.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Passo 1: Selecionar PDCA Existente */}
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span>1. Selecione o PDCA existente do projeto:</span>
                        </label>

                        {projectPDCAs.length === 0 ? (
                          <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-center space-y-3">
                            <AlertCircle
                              size={28}
                              className="mx-auto text-amber-600 dark:text-amber-400"
                            />
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                              Nenhum PDCA existente foi encontrado neste projeto.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                createNewCycle(
                                  startOrLinkConfig.taskId,
                                  startOrLinkConfig.taskLabel
                                );
                                setStartOrLinkConfig(null);
                              }}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 transition-all shadow-md"
                            >
                              Criar Novo PDCA
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {projectPDCAs.map((item) => {
                              const isSelected = selectedPdcaToLink === item.cycle.id;
                              const displayName = item.cycle.nomePdca || item.cycle.title;

                              return (
                                <div
                                  key={item.cycle.id}
                                  onClick={() => {
                                    setSelectedPdcaToLink(item.cycle.id);
                                    const alreadyLinkedSubtaskIds = item.subtasks.map(
                                      (s) => s.id
                                    );
                                    setSelectedSubtasksToLink(
                                      Array.from(
                                        new Set([
                                          subtask.id,
                                          ...alreadyLinkedSubtaskIds,
                                        ])
                                      )
                                    );
                                  }}
                                  className={cn(
                                    "p-3.5 border-2 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3",
                                    isSelected
                                      ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 dark:border-indigo-500 shadow-sm"
                                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40"
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={cn(
                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                        isSelected
                                          ? "border-indigo-600 bg-indigo-600 text-white"
                                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                      )}
                                    >
                                      {isSelected && (
                                        <Check size={12} strokeWidth={3} />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-white truncate max-w-[260px]">
                                          {displayName}
                                        </h5>
                                        <span
                                          className={cn(
                                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0",
                                            item.cycle.status === "Concluído"
                                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                          )}
                                        >
                                          {item.cycle.status}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                                        <Link2 size={10} />
                                        Vinculado a {item.subtasks.length} subtarefa(s):{" "}
                                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                          {item.subtasks
                                            .map((s) => s.title)
                                            .join(", ")}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Passo 2: Selecionar subtarefas */}
                      {selectedPdcaToLink && (
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <span>
                                2. Selecione as subtarefas do projeto que compartilharão este PDCA:
                              </span>
                            </label>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                              Marque as subtarefas do projeto que farão parte deste ciclo PDCA.
                            </p>
                          </div>

                          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                            {(project.subtasks || []).map((st) => {
                              const isChecked = selectedSubtasksToLink.includes(
                                st.id
                              );
                              const isCurrent = st.id === subtask.id;

                              return (
                                <div
                                  key={st.id}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedSubtasksToLink((prev) =>
                                        prev.filter((id) => id !== st.id)
                                      );
                                    } else {
                                      setSelectedSubtasksToLink((prev) => [
                                        ...prev,
                                        st.id,
                                      ]);
                                    }
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                                    isChecked
                                      ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800"
                                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                                        isChecked
                                          ? "bg-indigo-600 border-indigo-600 text-white"
                                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                      )}
                                    >
                                      {isChecked && (
                                        <Check size={10} strokeWidth={3} />
                                      )}
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {st.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {isCurrent && (
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                                        Subtarefa Atual
                                      </span>
                                    )}
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                      {st.status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-6 shrink-0">
                  {startOrLinkMode === "link" ? (
                    <button
                      type="button"
                      onClick={() => setStartOrLinkMode("choice")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      <ArrowLeft size={14} />
                      Voltar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStartOrLinkConfig(null)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancelar
                    </button>
                  )}

                  {startOrLinkMode === "link" && (
                    <button
                      type="button"
                      disabled={
                        !selectedPdcaToLink || selectedSubtasksToLink.length === 0
                      }
                      onClick={handleConfirmLink}
                      className={cn(
                        "px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center gap-2",
                        (!selectedPdcaToLink ||
                          selectedSubtasksToLink.length === 0) &&
                          "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Link2 size={16} />
                      Confirmar Vínculo
                    </button>
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
    <div className="flex flex-col min-h-full bg-theme-background transition-colors duration-300 w-full">
      {/* Combined Sticky Header */}
      <div className="sticky top-0 md:top-[73.5px] z-[100] bg-theme-card border-b border-theme-border shadow-sm transition-colors duration-300">
        {/* Cycle Info Header */}
        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setShowDashboard(true)}
              className="p-2 hover:bg-slate-100/10 rounded-lg text-slate-400 shrink-0"
            >
              <ChevronRight size={24} className="rotate-180" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
                <RefreshCw size={24} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0 max-w-full sm:max-w-[400px]">
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 shrink-0 select-none">
                    Ciclo PDCA -{" "}
                  </span>
                  {isEditingPdcaName ? (
                    <input
                      type="text"
                      value={editingPdcaNameValue}
                      onChange={(e) => setEditingPdcaNameValue(e.target.value)}
                      onBlur={() => {
                        setIsEditingPdcaName(false);
                        const nextValue =
                          editingPdcaNameValue.trim() ||
                          activeCycle?.plan?.problemDescription ||
                          "";
                        updateCycle({
                          nomePdca: nextValue,
                          title: `Ciclo PDCA - ${nextValue}`,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setIsEditingPdcaName(false);
                          const nextValue =
                            editingPdcaNameValue.trim() ||
                            activeCycle?.plan?.problemDescription ||
                            "";
                          updateCycle({
                            nomePdca: nextValue,
                            title: `Ciclo PDCA - ${nextValue}`,
                          });
                        } else if (e.key === "Escape") {
                          setIsEditingPdcaName(false);
                        }
                      }}
                      className="bg-theme-card border-b border-indigo-500 outline-none text-theme-foreground font-black px-1 py-0.5 rounded text-sm sm:text-base w-full min-w-[150px] shadow-sm"
                      autoFocus
                    />
                  ) : (
                    <h3
                      onClick={() => {
                        setEditingPdcaNameValue(
                          activeCycle?.nomePdca ||
                            activeCycle?.plan?.problemDescription ||
                            "",
                        );
                        setIsEditingPdcaName(true);
                      }}
                      className="group font-black text-theme-foreground truncate hover:bg-slate-100/50 dark:hover:bg-slate-800/50 px-1.5 py-0.5 rounded cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 min-w-[50px] inline-flex items-center gap-1.5"
                      title="Clique para editar o nome do ciclo PDCA"
                    >
                      <span className="truncate">
                        {activeCycle?.nomePdca ||
                          activeCycle?.plan?.problemDescription ||
                          "Sem Nome"}
                      </span>
                      <svg
                        className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 md:opacity-50 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                        />
                      </svg>
                    </h3>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={activeCycle?.status || "Ativo"} />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {activeCycle &&
                      format(new Date(activeCycle.createdAt), "dd/MM/yyyy")}
                  </span>
                  {linkedSubtasksForActiveCycle.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeCycle) {
                          setStartOrLinkConfig({
                            isOpen: true,
                            taskId: activeCycle.taskId,
                            taskLabel: activeCycle.nomePdca || activeCycle.title,
                          });
                          setStartOrLinkMode("link");
                          setSelectedPdcaToLink(activeCycle.id);
                          setSelectedSubtasksToLink(linkedSubtasksForActiveCycle.map((s) => s.id));
                        }
                      }}
                      className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all shadow-2xs"
                      title="Gerenciar subtarefas vinculadas a este PDCA"
                    >
                      <Link2 size={12} className="shrink-0" />
                      <span>Vinculado a {linkedSubtasksForActiveCycle.length} subtarefa(s)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {isMaster && activeCycle && (
              <button
                type="button"
                onClick={() => setCycleToDelete(activeCycle)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/50 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                title="Excluir ciclo PDCA"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Excluir ciclo PDCA</span>
              </button>
            )}
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
              className="bg-slate-100 border-none text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 flex-1 sm:flex-none text-center"
            >
              <option value="Ativo">Ativo</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>
        </div>

        {linkedSubtasksForActiveCycle.length > 1 && (
          <div className="mx-4 sm:mx-8 my-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs font-medium shadow-xs flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Aviso:</strong> Este PDCA está vinculado a <strong>{linkedSubtasksForActiveCycle.length} subtarefas</strong> ({linkedSubtasksForActiveCycle.map(s => s.title).join(", ")}). Alterações efetuadas aqui afetarão todas elas.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeCycle) {
                  setStartOrLinkConfig({
                    isOpen: true,
                    taskId: activeCycle.taskId,
                    taskLabel: activeCycle.nomePdca || activeCycle.title,
                  });
                  setStartOrLinkMode("link");
                  setSelectedPdcaToLink(activeCycle.id);
                  setSelectedSubtasksToLink(linkedSubtasksForActiveCycle.map((s) => s.id));
                }
              }}
              className="text-[11px] font-extrabold underline hover:text-amber-900 dark:hover:text-amber-100 shrink-0"
            >
              Gerenciar vínculos
            </button>
          </div>
        )}

        {activeCycle && (
          <div className="px-4 md:px-8 flex gap-4 md:gap-8 border-t border-theme-border overflow-x-auto no-scrollbar">
            <PhaseTab
              active={activePhase === "PLAN"}
              onClick={() => handlePhaseChange("PLAN")}
              label="PLAN"
              color="indigo"
            />
            <PhaseTab
              active={activePhase === "DO"}
              onClick={() => handlePhaseChange("DO")}
              label="DO"
              color="amber"
              disabled={!isPlanPhaseValid}
              icon={!isPlanPhaseValid ? <Lock size={12} /> : undefined}
              lockTooltip={
                !isPlanPhaseValid
                  ? "Finalize a etapa PLAN para desbloquear"
                  : undefined
              }
            />
            <PhaseTab
              active={activePhase === "CHECK"}
              onClick={() => handlePhaseChange("CHECK")}
              label="CHECK"
              color="emerald"
              disabled={!isDoPhaseValid}
              icon={!isDoPhaseValid ? <Lock size={12} /> : undefined}
              lockTooltip={
                !isDoPhaseValid
                  ? "Pelo menos um plano deve ser concluído no DO para liberar o CHECK"
                  : undefined
              }
            />
            <PhaseTab
              active={activePhase === "ACT"}
              onClick={() => handlePhaseChange("ACT")}
              label="ACT"
              color="rose"
              disabled={!isCheckPhaseValid}
              icon={!isCheckPhaseValid ? <Lock size={12} /> : undefined}
              lockTooltip={
                !isCheckPhaseValid
                  ? "Pelo menos um plano deve concluir o CHECK para liberar o ACT"
                  : undefined
              }
            />
            <PhaseTab
              active={activePhase === "REPORT"}
              onClick={() => handlePhaseChange("REPORT")}
              label="RELATÓRIO"
              color="slate"
            />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto w-full">
        {activeCycle ? (
          <>
            {/* Phase Content */}
            <div className="flex-1 p-4 md:p-8 w-full max-w-full">
              <AnimatePresence mode="wait">
                {activePhase === "PLAN" && (
                  <motion.div
                    key="plan"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-5xl mx-auto space-y-6 md:space-y-8"
                  >
                    {/* PLAN Steps Navigation */}
                    <div className="flex items-center justify-between bg-theme-card p-1 md:p-2 rounded-2xl md:rounded-3xl border border-theme-border shadow-sm mb-4 overflow-x-auto no-scrollbar">
                      {[
                        {
                          id: 1,
                          title: "Descrição",
                          icon: <FileText size={16} />,
                        },
                        {
                          id: 2,
                          title: "Causa Raiz",
                          icon: <Target size={16} />,
                        },
                        {
                          id: 3,
                          title: "Impacto",
                          icon: <TrendingUp size={16} />,
                        },
                        {
                          id: 4,
                          title: "Plano de Ação",
                          icon: <GitBranch size={16} />,
                        },
                      ].map((step) => (
                        <button
                          key={step.id}
                          onClick={() => setActivePlanStep(step.id)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                            activePlanStep === step.id
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                              : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50",
                          )}
                        >
                          {step.icon}
                          <span className="hidden sm:block">{step.title}</span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-12">
                      {/* Step 1: Descrição */}
                      {activePlanStep === 1 && (
                        <motion.section
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-6"
                        >
                          <SectionHeader
                            number="1"
                            title="Descrição do Problema"
                          />
                          <textarea
                            placeholder="Descreva o problema de forma clara..."
                            value={activeCycle.plan.problemDescription || ""}
                            onChange={(e) =>
                              updatePlan({ problemDescription: e.target.value })
                            }
                            className="w-full p-8 bg-theme-card border border-theme-border rounded-[2.5rem] focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[300px] text-theme-foreground text-lg font-medium shadow-sm"
                          />
                        </motion.section>
                      )}

                      {/* Step 2: Causa Raiz */}
                      {activePlanStep === 2 && (
                        <motion.section
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-8"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <SectionHeader
                              number="2"
                              title="Análise de Causa Raiz"
                            />
                            <div className="flex bg-theme-background p-1 rounded-xl border border-theme-border self-start md:self-auto">
                              <button
                                onClick={() =>
                                  updatePlan({
                                    rootCauseAnalysis: {
                                      ...activeCycle.plan.rootCauseAnalysis,
                                      type: "5whys",
                                    },
                                  })
                                }
                                className={cn(
                                  "px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  activeCycle.plan.rootCauseAnalysis.type ===
                                    "5whys"
                                    ? "bg-theme-card text-indigo-400 shadow-sm"
                                    : "text-slate-400",
                                )}
                              >
                                5 Porquês
                              </button>
                              <button
                                onClick={() =>
                                  updatePlan({
                                    rootCauseAnalysis: {
                                      ...activeCycle.plan.rootCauseAnalysis,
                                      type: "ishikawa",
                                      ishikawa:
                                        activeCycle.plan.rootCauseAnalysis
                                          .ishikawa ||
                                        ishikawaDefaultCategories,
                                    },
                                  })
                                }
                                className={cn(
                                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  activeCycle.plan.rootCauseAnalysis.type ===
                                    "ishikawa"
                                    ? "bg-theme-card text-indigo-400 shadow-sm"
                                    : "text-slate-400",
                                )}
                              >
                                Ishikawa
                              </button>
                              <button
                                onClick={() =>
                                  updatePlan({
                                    rootCauseAnalysis: {
                                      ...activeCycle.plan.rootCauseAnalysis,
                                      type: "list",
                                    },
                                  })
                                }
                                className={cn(
                                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  activeCycle.plan.rootCauseAnalysis.type ===
                                    "list"
                                    ? "bg-theme-card text-indigo-400 shadow-sm"
                                    : "text-slate-400",
                                )}
                              >
                                Lista de Causas
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {activeCycle.plan.rootCauseAnalysis.type ===
                            "ishikawa" ? (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {(
                                    activeCycle.plan.rootCauseAnalysis
                                      .ishikawa || ishikawaDefaultCategories
                                  ).map((cat, catIdx) => (
                                    <div
                                      key={cat.id}
                                      className="bg-theme-card p-6 rounded-2xl border border-theme-border space-y-4 min-w-0"
                                    >
                                      <div className="flex items-center justify-between gap-2 min-w-0">
                                        <div className="min-w-0 flex-1">
                                          <h5 className="font-black text-theme-foreground text-xs uppercase tracking-widest truncate">
                                            {cat.name}
                                          </h5>
                                          <p className="text-[10px] text-slate-400 font-medium truncate">
                                            {cat.description}
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const currentIshikawa =
                                              activeCycle.plan.rootCauseAnalysis
                                                .ishikawa ||
                                              ishikawaDefaultCategories;
                                            const newIshikawa =
                                              currentIshikawa.map((c, i) => {
                                                if (i === catIdx) {
                                                  return {
                                                    ...c,
                                                    entries: [
                                                      ...(c.entries || []),
                                                      {
                                                        id: uuidv4(),
                                                        text: "",
                                                      },
                                                    ],
                                                  };
                                                }
                                                return c;
                                              });
                                            updatePlan({
                                              rootCauseAnalysis: {
                                                ...activeCycle.plan
                                                  .rootCauseAnalysis,
                                                ishikawa: newIshikawa,
                                              },
                                            });
                                          }}
                                          className="p-2 rounded-lg transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                                        >
                                          <Plus size={14} />
                                        </button>
                                      </div>
                                      <div className="space-y-2">
                                        {cat.entries.map((entry, entryIdx) => (
                                          <div
                                            key={entry.id}
                                            className="flex gap-2"
                                          >
                                            <div className="flex-1 min-w-0 flex gap-2">
                                              <input
                                                type="text"
                                                placeholder="Descreva a causa..."
                                                value={entry.text || ""}
                                                onChange={(e) => {
                                                  const currentIshikawa =
                                                    activeCycle.plan
                                                      .rootCauseAnalysis
                                                      .ishikawa ||
                                                    ishikawaDefaultCategories;
                                                  const newIshikawa = [
                                                    ...currentIshikawa,
                                                  ];
                                                  const newEntries = [
                                                    ...newIshikawa[catIdx]
                                                      .entries,
                                                  ];
                                                  newEntries[entryIdx] = {
                                                    ...newEntries[entryIdx],
                                                    text: e.target.value,
                                                  };
                                                  newIshikawa[catIdx] = {
                                                    ...newIshikawa[catIdx],
                                                    entries: newEntries,
                                                  };
                                                  updatePlan({
                                                    rootCauseAnalysis: {
                                                      ...activeCycle.plan
                                                        .rootCauseAnalysis,
                                                      ishikawa: newIshikawa,
                                                    },
                                                  });
                                                }}
                                                className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                                              />
                                              <button
                                                onClick={() => {
                                                  const currentIshikawa =
                                                    activeCycle.plan
                                                      .rootCauseAnalysis
                                                      .ishikawa ||
                                                    ishikawaDefaultCategories;
                                                  const newIshikawa = [
                                                    ...currentIshikawa,
                                                  ];
                                                  newIshikawa[catIdx] = {
                                                    ...newIshikawa[catIdx],
                                                    entries: newIshikawa[
                                                      catIdx
                                                    ].entries.filter(
                                                      (_, i) => i !== entryIdx,
                                                    ),
                                                  };
                                                  updatePlan({
                                                    rootCauseAnalysis: {
                                                      ...activeCycle.plan
                                                        .rootCauseAnalysis,
                                                      ishikawa: newIshikawa,
                                                    },
                                                  });
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

                                {activeCycle.plan.rootCauseAnalysis.type ===
                                  "ishikawa" && (
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
                                        <h4 className="text-lg font-black tracking-tight">
                                          Causas Prioritárias
                                        </h4>
                                        <p className="text-slate-400 text-xs font-medium">
                                          Selecione as causas principais para
                                          focar no plano de ação.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-1">
                                      {allIshikawaCauses.length === 0 ? (
                                        <p className="text-slate-500 text-xs italic">
                                          Preencha as causas no diagrama acima
                                          para priorizar.
                                        </p>
                                      ) : (
                                        allIshikawaCauses.map((cause, cIdx) => {
                                          const isSelected = (
                                            activeCycle.plan.rootCauseAnalysis
                                              .priorityCauses || []
                                          ).includes(cause);
                                          return (
                                            <button
                                              key={`${cause}-${cIdx}`}
                                              onClick={() => {
                                                const current =
                                                  activeCycle.plan
                                                    .rootCauseAnalysis
                                                    .priorityCauses || [];
                                                if (isSelected) {
                                                  updatePlan({
                                                    rootCauseAnalysis: {
                                                      ...activeCycle.plan
                                                        .rootCauseAnalysis,
                                                      priorityCauses:
                                                        current.filter(
                                                          (c) => c !== cause,
                                                        ),
                                                    },
                                                  });
                                                } else {
                                                  updatePlan({
                                                    rootCauseAnalysis: {
                                                      ...activeCycle.plan
                                                        .rootCauseAnalysis,
                                                      priorityCauses: [
                                                        ...current,
                                                        cause,
                                                      ],
                                                    },
                                                  });
                                                }
                                              }}
                                              className={cn(
                                                "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                                                isSelected
                                                  ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/20"
                                                  : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600",
                                              )}
                                            >
                                              <div
                                                className={cn(
                                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                                  isSelected
                                                    ? "border-white bg-white text-indigo-600"
                                                    : "border-slate-600",
                                                )}
                                              >
                                                {isSelected && (
                                                  <CheckCircle2 size={12} />
                                                )}
                                              </div>
                                              <span className="text-xs font-bold">
                                                {cause}
                                              </span>
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>

                                    {(
                                      activeCycle.plan.rootCauseAnalysis
                                        .priorityCauses || []
                                    ).length > 0 && (
                                      <div className="pt-4 border-t border-slate-800">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                                          Causas Selecionadas (
                                          {
                                            activeCycle.plan.rootCauseAnalysis
                                              .priorityCauses?.length
                                          }
                                          )
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {activeCycle.plan.rootCauseAnalysis.priorityCauses?.map(
                                            (cause, cIdx) => (
                                              <span
                                                key={`${cause}-${cIdx}`}
                                                className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                                              >
                                                {cause}
                                              </span>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                                {activeCycle.plan.rootCauseAnalysis.type ===
                                  "ishikawa" &&
                                  (!activeCycle.plan.rootCauseAnalysis
                                    .priorityCauses ||
                                    activeCycle.plan.rootCauseAnalysis
                                      .priorityCauses.length === 0) &&
                                  showValidationErrors && (
                                    <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 animate-pulse">
                                      <AlertCircle size={20} />
                                      <p className="text-xs font-black uppercase tracking-widest">
                                        Selecione as causas prioritárias para
                                        avançar
                                      </p>
                                    </div>
                                  )}
                              </>
                            ) : (
                              activeCycle.plan.rootCauseAnalysis.entries.map(
                                (entry, idx) => (
                                  <div
                                    key={entry.id}
                                    className="flex items-center gap-4"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shadow-sm shrink-0">
                                      {activeCycle.plan.rootCauseAnalysis
                                        .type === "5whys" ? (
                                        idx + 1
                                      ) : (
                                        <AlertCircle size={16} />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex gap-2">
                                      <input
                                        type="text"
                                        placeholder={
                                          activeCycle.plan.rootCauseAnalysis
                                            .type === "5whys"
                                            ? `Por quê ${idx + 1}?`
                                            : "Descreva a causa..."
                                        }
                                        value={entry.text || ""}
                                        onChange={(e) => {
                                          const newEntries = [
                                            ...activeCycle.plan
                                              .rootCauseAnalysis.entries,
                                          ];
                                          newEntries[idx].text = e.target.value;
                                          updatePlan({
                                            rootCauseAnalysis: {
                                              ...activeCycle.plan
                                                .rootCauseAnalysis,
                                              entries: newEntries,
                                            },
                                          });
                                        }}
                                        className="flex-1 min-w-0 p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm"
                                      />
                                      {activeCycle.plan.rootCauseAnalysis
                                        .type === "list" && (
                                        <button
                                          onClick={() => {
                                            const newEntries =
                                              activeCycle.plan.rootCauseAnalysis.entries.filter(
                                                (_, i) => i !== idx,
                                              );
                                            updatePlan({
                                              rootCauseAnalysis: {
                                                ...activeCycle.plan
                                                  .rootCauseAnalysis,
                                                entries: newEntries,
                                              },
                                            });
                                          }}
                                          className="p-4 text-slate-300 hover:text-rose-500 transition-colors"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ),
                              )
                            )}

                            {/* Root Cause Conclusion for 5 Whys and List */}
                            {(activeCycle.plan.rootCauseAnalysis.type ===
                              "5whys" ||
                              activeCycle.plan.rootCauseAnalysis.type ===
                                "list") && (
                              <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
                                <div className="flex items-center gap-2 text-indigo-600">
                                  <Target size={18} />
                                  <h5 className="font-black text-xs uppercase tracking-widest">
                                    Causa raiz identificada
                                  </h5>
                                </div>
                                <textarea
                                  placeholder="Descreva aqui a causa raiz final identificada após a análise..."
                                  value={
                                    activeCycle.plan.rootCauseAnalysis
                                      .identifiedRootCause || ""
                                  }
                                  onChange={(e) =>
                                    updatePlan({
                                      rootCauseAnalysis: {
                                        ...activeCycle.plan.rootCauseAnalysis,
                                        identifiedRootCause: e.target.value,
                                      },
                                    })
                                  }
                                  className={cn(
                                    "w-full p-4 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 shadow-sm min-h-[100px] transition-all",
                                    showValidationErrors &&
                                      !activeCycle.plan.rootCauseAnalysis.identifiedRootCause?.trim()
                                      ? "border-rose-300 bg-rose-50/30"
                                      : "border-indigo-100",
                                  )}
                                />
                                <p className="text-[10px] text-indigo-400 font-bold italic">
                                  * Campo obrigatório para conclusão do PLAN
                                </p>
                                {!activeCycle.plan.rootCauseAnalysis
                                  .identifiedRootCause && (
                                  <div className="flex items-center gap-1.5 text-rose-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                    <AlertCircle size={12} />
                                    Atenção: Identifique a causa raiz para
                                    prosseguir
                                  </div>
                                )}
                              </div>
                            )}

                            {activeCycle.plan.rootCauseAnalysis.type ===
                              "list" && (
                              <button
                                onClick={() => {
                                  updatePlan({
                                    rootCauseAnalysis: {
                                      ...activeCycle.plan.rootCauseAnalysis,
                                      entries: [
                                        ...activeCycle.plan.rootCauseAnalysis
                                          .entries,
                                        { id: uuidv4(), text: "" },
                                      ],
                                    },
                                  });
                                }}
                                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                              >
                                <Plus size={16} />
                                Adicionar Causa
                              </button>
                            )}
                          </div>
                        </motion.section>
                      )}

                      {/* Step 3: Impacto */}
                      {activePlanStep === 3 && (
                        <motion.section
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-8"
                        >
                          <div className="bg-theme-card p-10 rounded-[2.5rem] border border-theme-border shadow-sm space-y-12">
                            <SectionHeader
                              number="3"
                              title="Impacto do Problema"
                            />

                            {/* 1. Impacto Atual */}
                            <div className="space-y-8">
                              <div className="p-5 bg-indigo-50/80 border border-indigo-100/80 rounded-2xl flex items-start gap-3">
                                <HelpCircle className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                                <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                                  <strong>Orientação:</strong> Se não for possível mensurar em R$, utilize tempo ou impacto operacional. Projetos com impacto claro geram mais valor.
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
                                    Tipo de Impacto <span className="text-rose-500 font-bold">* (Obrigatório)</span>
                                  </label>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
                                    {(['Tangível', 'Intangível', 'Ambos'] as const).map((type) => {
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
                                            showValidationErrors && !activeCycle.plan.impact.impactType && "border-rose-500 ring-1 ring-rose-500"
                                          )}
                                        >
                                          {type}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {showValidationErrors && !activeCycle.plan.impact.impactType && (
                                    <p className="text-xs text-rose-500 font-bold">A seleção do Tipo de Impacto é obrigatória.</p>
                                  )}
                                </div>

                                {/* Bloco Impacto Tangível */}
                                {(activeCycle.plan.impact.impactType === 'Tangível' || activeCycle.plan.impact.impactType === 'Ambos') && (
                                  <div className={cn(
                                    "p-6 bg-slate-50/80 rounded-3xl border space-y-4 animate-in fade-in duration-300",
                                    showValidationErrors &&
                                      !((activeCycle.plan.impact.tangibleFinancialLoss ?? 0) > 0 ||
                                        (activeCycle.plan.impact.tangibleWastedTime ?? 0) > 0 ||
                                        !!(activeCycle.plan.impact.tangibleRework && String(activeCycle.plan.impact.tangibleRework).trim()) ||
                                        !!activeCycle.plan.impact.tangibleOtherCosts?.trim())
                                      ? "border-rose-400 bg-rose-50/20"
                                      : "border-slate-200/80"
                                  )}>
                                    <div className="flex items-center justify-between flex-wrap gap-2 text-slate-700">
                                      <div className="flex items-center gap-2">
                                        <Zap size={16} className="text-amber-500" />
                                        <span className="text-xs font-black uppercase tracking-widest">
                                          Detalhamento do Impacto Tangível <span className="text-rose-500 font-bold">* (Pelo menos 1 campo)</span>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perda financeira estimada (R$)</label>
                                        <input
                                          type="number"
                                          placeholder="0.00"
                                          value={activeCycle.plan.impact.tangibleFinancialLoss ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              tangibleFinancialLoss: parseFloat(e.target.value) || 0,
                                              value: parseFloat(e.target.value) || activeCycle.plan.impact.value || 0
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo desperdiçado (horas/mês)</label>
                                        <input
                                          type="number"
                                          placeholder="0"
                                          value={activeCycle.plan.impact.tangibleWastedTime ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              tangibleWastedTime: parseFloat(e.target.value) || 0
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retrabalho (horas ou %)</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: 15 horas ou 20%"
                                          value={activeCycle.plan.impact.tangibleRework ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              tangibleRework: e.target.value
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outros custos</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Desperdício de insumos, multas"
                                          value={activeCycle.plan.impact.tangibleOtherCosts ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              tangibleOtherCosts: e.target.value
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                    </div>
                                    {showValidationErrors &&
                                      !((activeCycle.plan.impact.tangibleFinancialLoss ?? 0) > 0 ||
                                        (activeCycle.plan.impact.tangibleWastedTime ?? 0) > 0 ||
                                        !!(activeCycle.plan.impact.tangibleRework && String(activeCycle.plan.impact.tangibleRework).trim()) ||
                                        !!activeCycle.plan.impact.tangibleOtherCosts?.trim()) && (
                                      <p className="text-xs text-rose-500 font-bold">Preencha ao menos um campo de detalhamento do impacto tangível.</p>
                                    )}
                                  </div>
                                )}

                                {/* Bloco Impacto Intangível */}
                                {(activeCycle.plan.impact.impactType === 'Intangível' || activeCycle.plan.impact.impactType === 'Ambos') && (
                                  <div className={cn(
                                    "p-6 bg-slate-50/80 rounded-3xl border space-y-4 animate-in fade-in duration-300",
                                    showValidationErrors &&
                                      !(!!activeCycle.plan.impact.intangibleCustomerImpact?.trim() ||
                                        !!activeCycle.plan.impact.intangibleQualityImpact?.trim() ||
                                        !!activeCycle.plan.impact.intangibleRiskImpact?.trim() ||
                                        !!activeCycle.plan.impact.intangibleTeamImpact?.trim())
                                      ? "border-rose-400 bg-rose-50/20"
                                      : "border-slate-200/80"
                                  )}>
                                    <div className="flex items-center justify-between flex-wrap gap-2 text-slate-700">
                                      <div className="flex items-center gap-2">
                                        <Award size={16} className="text-indigo-500" />
                                        <span className="text-xs font-black uppercase tracking-widest">
                                          Detalhamento do Impacto Intangível <span className="text-rose-500 font-bold">* (Pelo menos 1 campo)</span>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impacto no cliente</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Reclamações frequentes, insatisfação"
                                          value={activeCycle.plan.impact.intangibleCustomerImpact ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              intangibleCustomerImpact: e.target.value
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impacto na qualidade</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Riscos de desvio de padrão"
                                          value={activeCycle.plan.impact.intangibleQualityImpact ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              intangibleQualityImpact: e.target.value
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impacto em risco</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Risco de não conformidade ou segurança"
                                          value={activeCycle.plan.impact.intangibleRiskImpact ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              intangibleRiskImpact: e.target.value
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impacto na equipe</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Desmotivação, sobrecarga"
                                          value={activeCycle.plan.impact.intangibleTeamImpact ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              intangibleTeamImpact: e.target.value
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                    </div>
                                    {showValidationErrors &&
                                      !(!!activeCycle.plan.impact.intangibleCustomerImpact?.trim() ||
                                        !!activeCycle.plan.impact.intangibleQualityImpact?.trim() ||
                                        !!activeCycle.plan.impact.intangibleRiskImpact?.trim() ||
                                        !!activeCycle.plan.impact.intangibleTeamImpact?.trim()) && (
                                      <p className="text-xs text-rose-500 font-bold">Preencha ao menos um campo de detalhamento do impacto intangível.</p>
                                    )}
                                  </div>
                                )}

                                {/* Bloco Ganho Esperado (Estruturado) - OPCIONAL */}
                                <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 space-y-4">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2 text-emerald-800">
                                      <TrendingUp size={16} className="text-emerald-600" />
                                      <span className="text-xs font-black uppercase tracking-widest">Ganho Esperado (Metas Estruturadas)</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-600 bg-white/80 px-3 py-1 rounded-full border border-slate-200 shadow-xs">
                                      Preenchimento Opcional
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {activeCycle.plan.impact.impactType !== 'Intangível' && (
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Redução de custo estimada (R$)</label>
                                        <input
                                          type="number"
                                          placeholder="0.00"
                                          value={activeCycle.plan.impact.expectedCostReduction ?? ''}
                                          onChange={(e) => updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              expectedCostReduction: parseFloat(e.target.value) || 0
                                            }
                                          })}
                                          className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                      </div>
                                    )}
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ganho de tempo (horas/mês)</label>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={activeCycle.plan.impact.expectedTimeGain ?? ''}
                                        onChange={(e) => updatePlan({
                                          impact: {
                                            ...activeCycle.plan.impact,
                                            expectedTimeGain: parseFloat(e.target.value) || 0
                                          }
                                        })}
                                        className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Melhoria percentual de indicador (%)</label>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={activeCycle.plan.impact.expectedIndicatorImprovement ?? ''}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          updatePlan({
                                            impact: {
                                              ...activeCycle.plan.impact,
                                              expectedIndicatorImprovement: val,
                                              improvementPercentage: val || activeCycle.plan.impact.improvementPercentage
                                            }
                                          });
                                        }}
                                        className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outros ganhos</label>
                                      <input
                                        type="text"
                                        placeholder="Ex: Melhoria do clima, padronização do processo"
                                        value={activeCycle.plan.impact.expectedOtherGains ?? ''}
                                        onChange={(e) => updatePlan({
                                          impact: {
                                            ...activeCycle.plan.impact,
                                            expectedOtherGains: e.target.value
                                          }
                                        })}
                                        className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-theme-border">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <FileText
                                      size={14}
                                      className="text-indigo-500"
                                    />
                                    Descrição Geral do Impacto <span className="text-rose-500 font-bold">* (Obrigatório)</span>
                                  </label>
                                  <textarea
                                    placeholder="Descreva detalhadamente o prejuízo ou problema atual..."
                                    value={
                                      activeCycle.plan.impact.description || ""
                                    }
                                    onChange={(e) =>
                                      updatePlan({
                                        impact: {
                                          ...activeCycle.plan.impact,
                                          description: e.target.value,
                                        },
                                      })
                                    }
                                    className={cn(
                                      "w-full p-6 bg-theme-background border rounded-[2rem] outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-theme-foreground min-h-[120px] transition-all",
                                      showValidationErrors && !activeCycle.plan.impact.description?.trim()
                                        ? "border-rose-500 bg-rose-50/30 ring-1 ring-rose-500"
                                        : "border-theme-border"
                                    )}
                                  />
                                  {showValidationErrors && !activeCycle.plan.impact.description?.trim() && (
                                    <p className="text-xs text-rose-500 font-bold">A descrição geral do impacto é obrigatória.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.section>
                      )}

                      {/* Step 4: Plano de Ação */}
                      {activePlanStep === 4 && (
                        <motion.section
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-8"
                        >
                          <SectionHeader
                            number="4"
                            title="Plano de Ação (5W2H)"
                          />
                          <div className="space-y-6">
                            {activeCycle.plan.actionPlan
                              .filter(
                                (item) =>
                                  item.status !== "Cancelado" &&
                                  item.ativo !== false,
                              )
                              .map((item, index) => (
                                <div
                                  key={item.id}
                                  className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6 relative group transition-all hover:shadow-md"
                                >
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
                                        {index + 1}
                                      </div>
                                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Ação #{index + 1}
                                      </h5>
                                    </div>
                                    <button
                                      onClick={() =>
                                        removeActionPlanItem(item.id)
                                      }
                                      className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                      title="Remover Ação"
                                    >
                                      <Trash2 size={20} />
                                    </button>
                                  </div>

                                  <div className="space-y-6">
                                    {/* 5W2H Section - Full Width */}
                                    <div className="space-y-6 w-full">
                                      <div className="grid grid-cols-1 md:grid-cols-6 gap-6 w-full px-1">
                                        {/* Row 1: What & Why */}
                                        <div className="md:col-span-3 space-y-1 min-w-0">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            What (O que será feito?)
                                          </label>
                                          <textarea
                                            rows={3}
                                            value={item.what || ""}
                                            placeholder="Descreva o que será feito com detalhes..."
                                            onChange={(e) =>
                                              updateActionPlan(
                                                item.id,
                                                { what: e.target.value },
                                                true,
                                              )
                                            }
                                            onBlur={() =>
                                              updateActionPlan(item.id, {})
                                            }
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 resize-none min-h-[100px] box-border"
                                          />
                                        </div>
                                        <div className="md:col-span-3 space-y-1 min-w-0">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Why (Por que será feito?)
                                          </label>
                                          <textarea
                                            rows={3}
                                            value={item.why || ""}
                                            placeholder="Por que essa ação é necessária?"
                                            onChange={(e) =>
                                              updateActionPlan(
                                                item.id,
                                                { why: e.target.value },
                                                true,
                                              )
                                            }
                                            onBlur={() =>
                                              updateActionPlan(item.id, {})
                                            }
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 resize-none min-h-[100px] box-border"
                                          />
                                        </div>

                                        {/* Row 2: Where, When, Who */}
                                        <div className="md:col-span-2 space-y-1 min-w-0">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Where (Onde?)
                                          </label>
                                          <input
                                            value={item.where || ""}
                                            placeholder="Local da execução"
                                            onChange={(e) =>
                                              updateActionPlan(
                                                item.id,
                                                { where: e.target.value },
                                                true,
                                              )
                                            }
                                            onBlur={() =>
                                              updateActionPlan(item.id, {})
                                            }
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 box-border"
                                          />
                                        </div>
                                        <div className="md:col-span-2 space-y-1 min-w-0">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            When (Quando?)
                                          </label>
                                          <input
                                            type="date"
                                            value={item.when || ""}
                                            onChange={(e) =>
                                              updateActionPlan(
                                                item.id,
                                                { when: e.target.value },
                                                true,
                                              )
                                            }
                                            onBlur={() =>
                                              updateActionPlan(item.id, {})
                                            }
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 h-[54px] box-border"
                                          />
                                        </div>
                                        <div className="md:col-span-2 space-y-1 min-w-0">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Who (Quem)
                                          </label>
                                          <input
                                            value={item.who || ""}
                                            placeholder="Responsável"
                                            onChange={(e) =>
                                              updateActionPlan(
                                                item.id,
                                                { who: e.target.value },
                                                true,
                                              )
                                            }
                                            onBlur={() =>
                                              updateActionPlan(item.id, {})
                                            }
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 box-border"
                                          />
                                        </div>

                                        {/* Row 3: How (Main focus) */}
                                        <div className="md:col-span-6 space-y-1 min-w-0">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            How (Como será feito?)
                                          </label>
                                          <textarea
                                            rows={2}
                                            value={item.how || ""}
                                            placeholder="Detalhe o passo a passo da execução..."
                                            onChange={(e) =>
                                              updateActionPlan(
                                                item.id,
                                                { how: e.target.value },
                                                true,
                                              )
                                            }
                                            onBlur={() =>
                                              updateActionPlan(item.id, {})
                                            }
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 resize-none min-h-[80px] box-border"
                                          />
                                        </div>

                                        {/* Row 4: How much (Custo) */}
                                        <div className="md:col-span-6 space-y-1 min-w-0">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            How much (Custo)
                                          </label>
                                          <input
                                            value={item.howMuch || ""}
                                            placeholder="Valor ou recurso necessário"
                                            onChange={(e) =>
                                              updateActionPlan(
                                                item.id,
                                                { howMuch: e.target.value },
                                                true,
                                              )
                                            }
                                            onBlur={() =>
                                              updateActionPlan(item.id, {})
                                            }
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 box-border"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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
                        </motion.section>
                      )}
                    </div>

                    {/* Step Controls */}
                    <div className="flex items-center justify-between pt-10 border-t border-theme-border">
                      <button
                        disabled={activePlanStep === 1}
                        onClick={() => setActivePlanStep((prev) => prev - 1)}
                        className={cn(
                          "flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-theme-border hover:bg-theme-card",
                          activePlanStep === 1
                            ? "opacity-0 invisible"
                            : "opacity-100",
                        )}
                      >
                        <ArrowLeft size={18} />
                        Anterior
                      </button>

                      {activePlanStep < 4 ? (
                        <button
                          onClick={() => {
                            if (activePlanStep === 3 && !isPlanStep3Valid) {
                              setShowValidationErrors(true);
                              setSaveFeedback(
                                "Preencha os campos obrigatórios do Impacto (Tipo, Detalhamento e Descrição) antes de avançar para o Plano de Ação."
                              );
                              return;
                            }
                            setShowValidationErrors(false);
                            setActivePlanStep((prev) => prev + 1);
                          }}
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
                          onClick={() => handlePhaseChange("DO")}
                          className="flex items-center gap-2 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all group"
                        >
                          Finalizar PLAN (Ir para DO)
                          <ChevronRight
                            size={18}
                            className="group-hover:translate-x-1 transition-transform"
                          />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
                {activePhase === "DO" && (
                  <motion.div
                    key="do"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="bg-theme-card rounded-[2.5rem] border border-theme-border shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-theme-border bg-theme-background/50">
                        <h4 className="text-xl font-black text-theme-foreground tracking-tight">
                          Execução e Histórico
                        </h4>
                        <p className="text-slate-400 text-sm mt-1">
                          Registre cada atualização das ações planejadas.
                        </p>
                      </div>
                      <div className="divide-y divide-theme-border">
                        {activeCycle.plan.actionPlan.filter(
                          (item) =>
                            item.status !== "Cancelado" && item.ativo !== false,
                        ).length === 0 ? (
                          <div className="p-20 text-center text-slate-400 italic">
                            Nenhuma ação planejada (PLAN).
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan
                            .filter(
                              (item) =>
                                item.status !== "Cancelado" &&
                                item.ativo !== false,
                            )
                            .map((item, filteredIdx) => {
                              const isExpanded = expandedActionId === item.id;

                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "border-b border-slate-100 last:border-0 transition-all",
                                    isExpanded
                                      ? "bg-white"
                                      : "hover:bg-slate-50/50",
                                  )}
                                >
                                  {/* Accordion Header */}
                                  <button
                                    onClick={() =>
                                      setExpandedActionId(
                                        isExpanded ? null : item.id,
                                      )
                                    }
                                    className="w-full p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left group"
                                  >
                                    <div className="flex items-center gap-4 flex-1">
                                      <span
                                        className={cn(
                                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 shadow-sm",
                                          isExpanded
                                            ? "bg-indigo-600 text-white"
                                            : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
                                        )}
                                      >
                                        {filteredIdx + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <h5 className="font-bold text-slate-800 text-lg truncate group-hover:text-indigo-600 transition-colors">
                                          {item.what || "Ação sem descrição"}
                                        </h5>
                                        <div className="flex items-center gap-3 mt-1">
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <Users
                                              size={12}
                                              className="text-slate-400"
                                            />
                                            <span className="text-slate-600 font-black">
                                              {item.who}
                                            </span>
                                          </p>
                                          {item.when && (
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                              <Clock
                                                size={12}
                                                className="text-slate-400"
                                              />
                                              <span>
                                                {format(
                                                  new Date(item.when),
                                                  "dd/MM/yyyy",
                                                )}
                                              </span>
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      <div className="hidden sm:block">
                                        <span
                                          className={cn(
                                            "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                                            item.status === "Concluído"
                                              ? "bg-emerald-100 text-emerald-700"
                                              : item.status === "Em andamento"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-slate-100 text-slate-600",
                                          )}
                                        >
                                          {item.status}
                                        </span>
                                      </div>
                                      <div
                                        className={cn(
                                          "w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 transition-transform duration-300 group-hover:border-indigo-200 group-hover:text-indigo-500",
                                          isExpanded &&
                                            "rotate-180 bg-indigo-50 border-indigo-200 text-indigo-600",
                                        )}
                                      >
                                        <ChevronDown size={18} />
                                      </div>
                                    </div>
                                  </button>

                                  {/* Accordion Content */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                          duration: 0.3,
                                          ease: "easeInOut",
                                        }}
                                        className=""
                                      >
                                        <div className="px-8 pb-8 space-y-8 animate-in fade-in slide-in-from-top-1 duration-300">
                                          {/* History Log */}
                                          <div className="space-y-4 pt-4 border-t border-slate-50">
                                            <div className="flex items-center justify-between">
                                              <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Clock size={14} />
                                                Histórico de Atualizações
                                              </h6>
                                              <span className="text-[10px] font-black text-slate-300">
                                                {
                                                  (item.executionLogs || [])
                                                    .length
                                                }{" "}
                                                registros
                                              </span>
                                            </div>

                                            <div className="space-y-3">
                                              {(item.executionLogs || [])
                                                .length === 0 ? (
                                                <div className="py-8 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2">
                                                  <AlertCircle
                                                    size={24}
                                                    className="opacity-20"
                                                  />
                                                  <p className="text-[10px] font-bold uppercase tracking-widest">
                                                    Sem movimentações
                                                    registradas
                                                  </p>
                                                </div>
                                              ) : (
                                                [...(item.executionLogs || [])]
                                                  .sort(
                                                    (a, b) =>
                                                      new Date(
                                                        a.timestamp,
                                                      ).getTime() -
                                                      new Date(
                                                        b.timestamp,
                                                      ).getTime(),
                                                  )
                                                  .map((log) => {
                                                    const isEditing = editingLogId === log.id;
                                                    const canEdit =
                                                      (log.status === "Pendente" || log.status === "Em andamento") &&
                                                      item.status !== "Cancelado";

                                                    if (isEditing) {
                                                      return (
                                                        <div
                                                          key={log.id}
                                                          className="bg-indigo-50/80 dark:bg-slate-800 p-4 rounded-2xl border border-indigo-200 dark:border-slate-700 space-y-4 shadow-sm"
                                                        >
                                                          <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-slate-700">
                                                            <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                                                              <Pencil size={12} /> Editar Registro do Histórico
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                              {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm")}
                                                            </span>
                                                          </div>

                                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                                                Status
                                                              </label>
                                                              <select
                                                                value={editingLogData?.status || "Pendente"}
                                                                onChange={(e) =>
                                                                  setEditingLogData((prev) =>
                                                                    prev
                                                                      ? {
                                                                          ...prev,
                                                                          status: e.target.value as "Pendente" | "Em andamento",
                                                                        }
                                                                      : null,
                                                                  )
                                                                }
                                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                                              >
                                                                <option value="Pendente">Pendente</option>
                                                                <option value="Em andamento">Em andamento</option>
                                                              </select>
                                                            </div>

                                                            <div className="space-y-1">
                                                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                                                Setor
                                                              </label>
                                                              <input
                                                                type="text"
                                                                value={editingLogData?.sector || ""}
                                                                onChange={(e) =>
                                                                  setEditingLogData((prev) =>
                                                                    prev ? { ...prev, sector: e.target.value } : null,
                                                                  )
                                                                }
                                                                placeholder="Setor do responsável"
                                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                                              />
                                                            </div>
                                                          </div>

                                                          <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                                              Observação / Descrição
                                                            </label>
                                                            <textarea
                                                              rows={2}
                                                              value={editingLogData?.observation || ""}
                                                              onChange={(e) =>
                                                                setEditingLogData((prev) =>
                                                                  prev ? { ...prev, observation: e.target.value } : null,
                                                                )
                                                              }
                                                              placeholder="Descreva o avanço nesta etapa..."
                                                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                          </div>

                                                          <div className="flex items-center justify-end gap-2 pt-1">
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                setEditingLogId(null);
                                                                setEditingLogData(null);
                                                              }}
                                                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                            >
                                                              Cancelar
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                if (!editingLogData || !editingLogData.observation.trim()) return;

                                                                const previousLogState = {
                                                                  timestamp: log.editedAt || log.timestamp,
                                                                  status: log.status,
                                                                  sector: log.sector,
                                                                  observation: log.observation,
                                                                };

                                                                const updatedLogs = (item.executionLogs || []).map((l) => {
                                                                  if (l.id === log.id) {
                                                                    return {
                                                                      ...l,
                                                                      status: editingLogData.status as any,
                                                                      sector: editingLogData.sector,
                                                                      observation: editingLogData.observation,
                                                                      editedAt: new Date().toISOString(),
                                                                      editHistory: [
                                                                        ...(l.editHistory || []),
                                                                        previousLogState,
                                                                      ],
                                                                    };
                                                                  }
                                                                  return l;
                                                                });

                                                                const updates: Partial<ActionPlanItem> = {
                                                                  executionLogs: updatedLogs,
                                                                };

                                                                const sortedLogs = [...(item.executionLogs || [])].sort(
                                                                  (a, b) =>
                                                                    new Date(a.timestamp).getTime() -
                                                                    new Date(b.timestamp).getTime(),
                                                                );
                                                                if (sortedLogs.length > 0 && sortedLogs[sortedLogs.length - 1].id === log.id) {
                                                                  updates.status = editingLogData.status as any;
                                                                }

                                                                updateActionPlan(item.id, updates);
                                                                logFeature("Permissão de edição no histórico da etapa DO do PDCA", "PDCA", "✏️");
                                                                setEditingLogId(null);
                                                                setEditingLogData(null);
                                                              }}
                                                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                                                            >
                                                              <Check size={14} /> Salvar Alteração
                                                            </button>
                                                          </div>
                                                        </div>
                                                      );
                                                    }

                                                    return (
                                                      <div
                                                        key={log.id}
                                                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4 hover:border-slate-200 transition-colors"
                                                      >
                                                        <div
                                                          className={cn(
                                                            "w-2 h-2 rounded-full mt-2 shrink-0 shadow-sm",
                                                            log.status === "Concluído"
                                                              ? "bg-emerald-500"
                                                              : log.status === "Em andamento"
                                                                ? "bg-amber-500"
                                                                : "bg-slate-300",
                                                          )}
                                                        />
                                                        <div className="flex-1">
                                                          <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                                                                {log.status}
                                                              </span>
                                                              {log.editedAt && (
                                                                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded flex items-center gap-1" title="Registro editado">
                                                                  <Pencil size={9} /> Editado
                                                                </span>
                                                              )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-[10px] text-slate-400 font-medium">
                                                                {format(
                                                                  new Date(log.timestamp),
                                                                  "dd/MM/yyyy HH:mm",
                                                                )}
                                                              </span>
                                                              {canEdit && (
                                                                <button
                                                                  type="button"
                                                                  onClick={() => {
                                                                    setEditingLogId(log.id);
                                                                    setEditingLogData({
                                                                      status:
                                                                        log.status === "Em andamento"
                                                                          ? "Em andamento"
                                                                          : "Pendente",
                                                                      sector: log.sector || "",
                                                                      observation: log.observation || "",
                                                                    });
                                                                  }}
                                                                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-1"
                                                                  title="Editar este registro do histórico"
                                                                >
                                                                  <Pencil size={12} />
                                                                </button>
                                                              )}
                                                            </div>
                                                          </div>
                                                          <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                                            {log.observation}
                                                          </p>
                                                          <div className="mt-3 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
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

                                                            {log.editHistory && log.editHistory.length > 0 && (
                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  setShowLogHistoryId(
                                                                    showLogHistoryId === log.id ? null : log.id,
                                                                  )
                                                                }
                                                                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                                                              >
                                                                <Clock size={10} />
                                                                {showLogHistoryId === log.id
                                                                  ? "Ocultar histórico"
                                                                  : `Histórico de edições (${log.editHistory.length})`}
                                                              </button>
                                                            )}
                                                          </div>

                                                          {showLogHistoryId === log.id && log.editHistory && (
                                                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 bg-slate-50/80 p-3 rounded-xl">
                                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                Rastreabilidade / Alterações Anteriores:
                                                              </p>
                                                              {log.editHistory.map((hist, hIdx) => (
                                                                <div key={hIdx} className="text-[10px] text-slate-500 space-y-0.5 border-l-2 border-amber-300 pl-2">
                                                                  <div className="flex items-center justify-between font-bold text-slate-600">
                                                                    <span>Versão {hIdx + 1} ({hist.status})</span>
                                                                    <span>{format(new Date(hist.timestamp), "dd/MM/yyyy HH:mm")}</span>
                                                                  </div>
                                                                  {hist.sector && <div className="text-[9px] text-slate-400">Setor: {hist.sector}</div>}
                                                                  <div className="italic text-slate-600">"{hist.observation}"</div>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    );
                                                  })
                                              )}
                                            </div>

                                            {/* Add Log Form */}
                                            <div className="mt-8">
                                              {item.status === "Cancelado" ? (
                                                <div className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                                                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-sm">
                                                    <AlertCircle size={32} />
                                                  </div>
                                                  <div className="flex-1">
                                                    <h6 className="text-sm font-black text-rose-900 uppercase tracking-widest mb-1">
                                                      Ação Cancelada
                                                    </h6>
                                                    <p className="text-xs text-rose-600 font-medium leading-relaxed">
                                                      Este plano de ação foi
                                                      cancelado e não permite
                                                      mais atualizações.
                                                    </p>
                                                  </div>
                                                </div>
                                              ) : item.status !==
                                                "Concluído" ? (
                                                <div className="pdca-new-log-card p-6 rounded-[2rem] space-y-6 shadow-xl">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                                                      <Plus size={18} />
                                                    </div>
                                                    <h6 className="text-[10px] font-black uppercase tracking-widest">
                                                      Nova Atualização
                                                    </h6>
                                                  </div>

                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-1">
                                                    <div className="space-y-2">
                                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Novo Status
                                                      </label>
                                                      <select
                                                        id={`status-${item.id}`}
                                                        className="pdca-new-log-input w-full border-none px-4 py-3 rounded-xl text-xs font-bold outline-none ring-1 ring-slate-700 dark:ring-slate-600 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                                      >
                                                        <option
                                                          value="Pendente"
                                                          className="bg-slate-900 dark:bg-slate-50 text-white"
                                                        >
                                                          Pendente
                                                        </option>
                                                        <option
                                                          value="Em andamento"
                                                          className="bg-slate-900 dark:bg-slate-50 text-white"
                                                        >
                                                          Em andamento
                                                        </option>
                                                        <option
                                                          value="Concluído"
                                                          className="bg-slate-900 dark:bg-slate-50 text-white"
                                                        >
                                                          Concluído
                                                        </option>
                                                      </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Setor
                                                      </label>
                                                      <input
                                                        id={`sector-${item.id}`}
                                                        type="text"
                                                        placeholder="Setor do responsável"
                                                        className="pdca-new-log-input w-full border-none px-4 py-3 rounded-xl text-xs font-bold outline-none ring-1 ring-slate-700 dark:ring-slate-600 focus:ring-2 focus:ring-indigo-500 transition-all"
                                                      />
                                                    </div>
                                                    <div className="space-y-2">
                                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Observação
                                                      </label>
                                                      <input
                                                        id={`obs-${item.id}`}
                                                        type="text"
                                                        placeholder="O que foi feito nesta etapa?"
                                                        className="pdca-new-log-input w-full border-none px-4 py-3 rounded-xl text-xs font-bold outline-none ring-1 ring-slate-700 dark:ring-slate-600 focus:ring-2 focus:ring-indigo-500 transition-all"
                                                      />
                                                    </div>
                                                  </div>
                                                  <div className="flex justify-end pr-1">
                                                    <button
                                                      onClick={() => {
                                                        const statusSelect =
                                                          document.getElementById(
                                                            `status-${item.id}`,
                                                          ) as HTMLSelectElement;
                                                        const sectorInput =
                                                          document.getElementById(
                                                            `sector-${item.id}`,
                                                          ) as HTMLInputElement;
                                                        const obsInput =
                                                          document.getElementById(
                                                            `obs-${item.id}`,
                                                          ) as HTMLInputElement;

                                                        if (!obsInput.value)
                                                          return;

                                                        if (
                                                          statusSelect.value ===
                                                          "Concluído"
                                                        ) {
                                                          const updates: any = {
                                                            executionLogs: [
                                                              ...(item.executionLogs ||
                                                                []),
                                                              {
                                                                id: uuidv4(),
                                                                timestamp:
                                                                  new Date().toISOString(),
                                                                status:
                                                                  "Concluído" as any,
                                                                responsible:
                                                                  item.who,
                                                                sector:
                                                                  sectorInput.value,
                                                                observation:
                                                                  obsInput.value,
                                                                type: "completion",
                                                              },
                                                            ],
                                                            status:
                                                              "Concluído" as any,
                                                            endDate:
                                                              new Date().toISOString(),
                                                          };

                                                          if (!item.startDate) {
                                                            updates.startDate =
                                                              new Date().toISOString();
                                                          }

                                                          setConfirmingLog({
                                                            id: item.id,
                                                            updates,
                                                            obsInputId: `obs-${item.id}`,
                                                          });
                                                          return;
                                                        }

                                                        const newLog = {
                                                          id: uuidv4(),
                                                          timestamp:
                                                            new Date().toISOString(),
                                                          status:
                                                            statusSelect.value as any,
                                                          responsible: item.who,
                                                          sector:
                                                            sectorInput.value,
                                                          observation:
                                                            obsInput.value,
                                                          type:
                                                            statusSelect.value ===
                                                            "Concluído"
                                                              ? "completion"
                                                              : "update",
                                                        };

                                                        const newLogs = [
                                                          ...(item.executionLogs ||
                                                            []),
                                                          newLog,
                                                        ];
                                                        const updates: any = {
                                                          executionLogs:
                                                            newLogs,
                                                          status:
                                                            statusSelect.value as any,
                                                        };

                                                        if (
                                                          statusSelect.value ===
                                                            "Em andamento" &&
                                                          !item.startDate
                                                        ) {
                                                          updates.startDate =
                                                            new Date().toISOString();
                                                        }

                                                        updateActionPlan(
                                                          item.id,
                                                          updates,
                                                        );
                                                        obsInput.value = "";
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
                                                    <h6 className="text-sm font-black text-emerald-900 uppercase tracking-widest mb-1">
                                                      Ação Concluída com
                                                      Sucesso!
                                                    </h6>
                                                    <p className="text-xs text-emerald-600 font-medium">
                                                      Todos os registros para
                                                      este plano de ação foram
                                                      finalizados. Verifique
                                                      agora os resultados na
                                                      etapa{" "}
                                                      <strong>CHECK</strong>.
                                                    </p>
                                                  </div>
                                                  <button
                                                    onClick={() =>
                                                      handlePhaseChange("CHECK")
                                                    }
                                                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shrink-0"
                                                  >
                                                    Verificar Resultados{" "}
                                                    <ChevronRight size={14} />
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

                {activePhase === "CHECK" && (
                  <motion.div
                    key="check"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">
                          Verificação de Resultados
                        </h4>
                        <p className="text-slate-500 text-sm mt-1">
                          Acompanhamento e validação de cada ação.
                        </p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {activeCycle.plan.actionPlan.filter(
                          (item) =>
                            item.status !== "Cancelado" && item.ativo !== false,
                        ).length === 0 ? (
                          <div className="p-20 text-center text-slate-400 italic">
                            Nenhuma ação para verificação (CHECK).
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan
                            .filter(
                              (item) =>
                                item.status !== "Cancelado" &&
                                item.ativo !== false,
                            )
                            .map((item, filteredIdx) => {
                              const isExpanded = expandedActionId === item.id;
                              const isDoDone = item.status === "Concluído";

                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "border-b border-slate-100 last:border-0 transition-all",
                                    !isDoDone
                                      ? "bg-slate-50/50 opacity-75"
                                      : isExpanded
                                        ? "bg-white"
                                        : "hover:bg-slate-50/50",
                                  )}
                                >
                                  {/* Accordion Header */}
                                  <button
                                    onClick={() =>
                                      item.status === "Concluído" &&
                                      setExpandedActionId(
                                        isExpanded ? null : item.id,
                                      )
                                    }
                                    className={cn(
                                      "w-full p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left group",
                                      item.status !== "Concluído" &&
                                        "cursor-not-allowed",
                                    )}
                                  >
                                    <div className="flex items-center gap-4 flex-1">
                                      <div className="relative">
                                        <span
                                          className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 shadow-sm",
                                            isExpanded
                                              ? "bg-indigo-600 text-white"
                                              : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
                                            item.status !== "Concluído" &&
                                              "bg-slate-200 text-slate-400",
                                          )}
                                        >
                                          {filteredIdx + 1}
                                        </span>
                                        {item.status !== "Concluído" && (
                                          <div
                                            className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-sm"
                                            title="Aguardando conclusão da etapa DO"
                                          >
                                            <Lock size={10} />
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <h5
                                            className={cn(
                                              "font-bold text-lg truncate transition-colors",
                                              item.status === "Concluído"
                                                ? "text-slate-800 group-hover:text-indigo-600"
                                                : "text-slate-400",
                                            )}
                                          >
                                            {item.what || "Ação sem descrição"}
                                          </h5>
                                          {item.status !== "Concluído" && (
                                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg uppercase tracking-widest whitespace-nowrap">
                                              Aguardando DO
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <TrendingUp
                                              size={12}
                                              className="text-slate-400"
                                            />
                                            Modo:{" "}
                                            <span
                                              className={
                                                isDoDone
                                                  ? "text-slate-600 font-black"
                                                  : "text-slate-400"
                                              }
                                            >
                                              {item.monitoringMode || "Dias"}
                                            </span>
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <Target
                                              size={12}
                                              className="text-slate-400"
                                            />
                                            Período:{" "}
                                            <span
                                              className={
                                                isDoDone
                                                  ? "text-slate-600 font-black"
                                                  : "text-slate-400"
                                              }
                                            >
                                              {item.monitoringPeriod || 0}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                      <div className="hidden sm:block">
                                        {isDoDone ? (
                                          <span
                                            className={cn(
                                              "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                                              item.worked === "Sim"
                                                ? "bg-emerald-100 text-emerald-700"
                                                : item.worked === "Não"
                                                  ? "bg-rose-100 text-rose-700"
                                                  : "bg-amber-100 text-amber-700",
                                            )}
                                          >
                                            Funcionou?{" "}
                                            {item.worked || "Pendente"}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-100 text-slate-400 uppercase tracking-wider">
                                            Bloqueado
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={cn(
                                          "w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 transition-transform duration-300 group-hover:border-indigo-200 group-hover:text-indigo-500",
                                          isExpanded &&
                                            "rotate-180 bg-indigo-50 border-indigo-200 text-indigo-600",
                                        )}
                                      >
                                        <ChevronDown size={18} />
                                      </div>
                                    </div>
                                  </button>

                                  {/* Accordion Content */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                          duration: 0.3,
                                          ease: "easeInOut",
                                        }}
                                        className=""
                                      >
                                        <div className="px-8 pb-8 space-y-8 animate-in fade-in slide-in-from-top-1 duration-300 pt-4 border-t border-slate-50">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-1">
                                            {/* Linha 1 */}
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                Modo de Acompanhamento
                                              </label>
                                              <select
                                                value={
                                                  item.monitoringMode || "Dias"
                                                }
                                                onChange={(e) =>
                                                  updateActionPlan(item.id, {
                                                    monitoringMode: e.target
                                                      .value as any,
                                                  })
                                                }
                                                className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                              >
                                                <option value="Dias">
                                                  Dias
                                                </option>
                                                <option value="Semanas">
                                                  Semanas
                                                </option>
                                                <option value="Meses">
                                                  Meses
                                                </option>
                                              </select>
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                Período
                                              </label>
                                              <input
                                                type="number"
                                                value={
                                                  item.monitoringPeriod || 0
                                                }
                                                onFocus={(e) =>
                                                  e.target.select()
                                                }
                                                onChange={(e) =>
                                                  updateActionPlan(item.id, {
                                                    monitoringPeriod:
                                                      parseInt(
                                                        e.target.value,
                                                      ) || 0,
                                                  })
                                                }
                                                className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                              />
                                            </div>

                                            {/* Linha 2 - Observações do acompanhamento (Texto livre) */}
                                            <div className="space-y-1 md:col-span-2">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                Observações do período de acompanhamento
                                              </label>
                                              <textarea
                                                rows={3}
                                                value={
                                                  item.monitoringTool || ""
                                                }
                                                onChange={(e) =>
                                                  updateActionPlan(item.id, {
                                                    monitoringTool:
                                                      e.target.value,
                                                  })
                                                }
                                                placeholder="Descreva livremente como está sendo feito o acompanhamento, observações ou notas do período..."
                                                className="w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all resize-y"
                                              />
                                            </div>

                                            {/* Linha 3 */}
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                Funcionou?
                                              </label>
                                              <select
                                                value={item.worked || ""}
                                                onChange={(e) =>
                                                  updateActionPlan(item.id, {
                                                    worked: e.target
                                                      .value as any,
                                                  })
                                                }
                                                className={cn(
                                                  "w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer",
                                                  item.worked === "Sim"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : item.worked === "Não"
                                                      ? "bg-rose-100 text-rose-700"
                                                      : item.worked === "Parcial"
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                                                )}
                                              >
                                                <option value="" disabled hidden>
                                                  Selecione o resultado
                                                </option>
                                                <option value="Sim">Sim</option>
                                                <option value="Não">Não</option>
                                                <option value="Parcial">
                                                  Parcial
                                                </option>
                                              </select>
                                            </div>
                                            

                                            {/* Campo Condicional: Motivo */}
                                            {(item.worked === "Não" ||
                                              item.worked === "Parcial") && (
                                              <div className="md:col-span-2 space-y-1 block animate-in slide-in-from-top-2 duration-300">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
                                                  Motivo{" "}
                                                  <span className="text-rose-500 font-bold">
                                                    (Obrigatório)
                                                  </span>
                                                </label>
                                                <textarea
                                                  value={
                                                    item.failureReason || ""
                                                  }
                                                  onChange={(e) =>
                                                    updateActionPlan(item.id, {
                                                      failureReason:
                                                        e.target.value,
                                                    })
                                                  }
                                                  placeholder={
                                                    item.worked === "Não"
                                                      ? "Descreva detalhadamente por que a ação não funcionou..."
                                                      : "Descreva por que a ação funcionou apenas parcialmente..."
                                                  }
                                                  className={cn(
                                                    "w-full bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px] resize-none",
                                                    showValidationErrors &&
                                                      !item.failureReason &&
                                                      "ring-2 ring-rose-500 bg-rose-50",
                                                  )}
                                                />
                                              </div>
                                            )}
                                          </div>

                                          {item.worked === "Sim" && (
                                            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4 animate-in zoom-in-95 duration-300">
                                              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                                                <CheckCircle2 size={24} />
                                              </div>
                                              <div>
                                                <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">
                                                  Resultado Positivo!
                                                </p>
                                                <p className="text-[10px] text-emerald-600 font-medium leading-tight">
                                                  A ação foi eficaz. Siga para a
                                                  etapa <strong>ACT</strong>{" "}
                                                  para padronizar este novo
                                                  processo.
                                                </p>
                                              </div>
                                            </div>
                                          )}
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
                  

                    {/* Bloco de Vinculação com PLAN e Avaliação de Resultados Obtidos */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                            <Target size={20} />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-slate-800 tracking-tight">
                              Vínculo com Planejamento & Medição de Ganhos
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">
                              Compare o que foi estimado na etapa PLAN com o resultado real obtido.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                          Comparativo PLAN x CHECK
                        </span>
                      </div>

                      {/* 3.1 BLOCO 1: Resultados Obtidos */}
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={16} className="text-emerald-600" />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                            1. Resultados Obtidos (Resultados Reais)
                          </span>
                        </div>

                        {/* Botões de Seleção do Tipo de Resultado */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Target size={14} className="text-indigo-500" />
                            Tipo de Resultado Obtido
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
                            {(['Tangível', 'Intangível', 'Ambos'] as const).map((type) => {
                              const currentType =
                                activeCycle.check?.realResultType ||
                                activeCycle.plan.impact.impactType ||
                                'Tangível';
                              const isSelected = currentType === type;
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() =>
                                    updateCycle({
                                      check: {
                                        ...activeCycle.check,
                                        realResultType: type,
                                      },
                                    })
                                  }
                                  className={cn(
                                    "p-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all text-center cursor-pointer",
                                    isSelected
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                                  )}
                                >
                                  {type}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Ganhos Tangíveis Reais */}
                        {((activeCycle.check?.realResultType || activeCycle.plan.impact.impactType || 'Tangível') === 'Tangível' ||
                          (activeCycle.check?.realResultType || activeCycle.plan.impact.impactType || 'Tangível') === 'Ambos') && (
                          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-300">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5">
                              <Zap size={14} className="text-emerald-500" />
                              Resultados Tangíveis Reais
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Redução de custo real (R$)
                                </label>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={activeCycle.check?.realCostReduction ?? ''}
                                  onChange={(e) =>
                                    updateCycle({
                                      check: {
                                        ...activeCycle.check,
                                        realCostReduction: parseFloat(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Ganho de tempo real (horas/mês)
                                </label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={activeCycle.check?.realTimeGain ?? ''}
                                  onChange={(e) =>
                                    updateCycle({
                                      check: {
                                        ...activeCycle.check,
                                        realTimeGain: parseFloat(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Resultado percentual (%)
                                </label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={activeCycle.check?.realIndicatorResult ?? ''}
                                  onChange={(e) =>
                                    updateCycle({
                                      check: {
                                        ...activeCycle.check,
                                        realIndicatorResult: parseFloat(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Ganhos Intangíveis Reais */}
                        {((activeCycle.check?.realResultType || activeCycle.plan.impact.impactType || 'Tangível') === 'Intangível' ||
                          (activeCycle.check?.realResultType || activeCycle.plan.impact.impactType || 'Tangível') === 'Ambos') && (
                          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-300">
                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                              <Award size={14} className="text-indigo-500" />
                              Resultados Intangíveis Reais
                            </span>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Detalhamento dos Ganhos Intangíveis Obtidos (Satisfação, Qualidade, Clima, Processos)
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Descreva os ganhos qualitativos reais observados..."
                                value={activeCycle.check?.realIntangibleNotes ?? ''}
                                onChange={(e) =>
                                  updateCycle({
                                    check: {
                                      ...activeCycle.check,
                                      realIntangibleNotes: e.target.value,
                                    },
                                  })
                                }
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Observações e Notas Gerais
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Anotações gerais sobre o resultado obtido na prática..."
                            value={activeCycle.check?.realResultNotes ?? ''}
                            onChange={(e) =>
                              updateCycle({
                                check: {
                                  ...activeCycle.check,
                                  realResultNotes: e.target.value,
                                },
                              })
                            }
                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                          />
                        </div>
                      </div>

                      {/* 3.2 BLOCO 2: Comparação com Planejamento */}
                      <div className="bg-indigo-50/40 p-6 rounded-3xl border border-indigo-100/80 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-indigo-600" />
                            <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                              2. Comparação com Planejamento
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-3 py-1 rounded-full border border-indigo-200/60 shadow-sm">
                            Dados abaixo definidos na etapa PLAN (somente leitura)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100/60 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Impacto</span>
                            <p className="text-xs font-black text-slate-800">{activeCycle.plan.impact.impactType || 'Não definido'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100/60 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Perda / Impacto Estimado</span>
                            <p className="text-xs font-black text-slate-800">
                              R$ {(activeCycle.plan.impact.tangibleFinancialLoss || activeCycle.plan.impact.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100/60 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Redução Custo Esperada</span>
                            <p className="text-xs font-black text-emerald-600">
                              R$ {(activeCycle.plan.impact.expectedCostReduction || activeCycle.plan.impact.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100/60 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Ganho Tempo Esperado</span>
                            <p className="text-xs font-black text-slate-800">
                              {activeCycle.plan.impact.expectedTimeGain || 0} h/mês
                            </p>
                          </div>
                        </div>

                        {(activeCycle.plan.impact.expectedIndicatorImprovement || activeCycle.plan.impact.expectedOtherGains) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-indigo-100/60">
                            {activeCycle.plan.impact.expectedIndicatorImprovement ? (
                              <div className="bg-white p-3 rounded-2xl border border-indigo-100/60 space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">% Melhoria Indicador Esperada</span>
                                <p className="text-xs font-black text-indigo-600">{activeCycle.plan.impact.expectedIndicatorImprovement}%</p>
                              </div>
                            ) : null}
                            {activeCycle.plan.impact.expectedOtherGains ? (
                              <div className="bg-white p-3 rounded-2xl border border-indigo-100/60 space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Outros Ganhos Esperados</span>
                                <p className="text-xs font-bold text-slate-700">{activeCycle.plan.impact.expectedOtherGains}</p>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* 3.3 BLOCO 3: Conclusão */}
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                            3. Conclusão
                          </span>
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-black text-slate-600 uppercase tracking-widest block">
                            O ganho esperado foi atingido? <span className="text-rose-500 font-bold">* (Obrigatório)</span>
                          </label>
                          <div className="grid grid-cols-3 gap-3 max-w-md">
                            {(['Sim', 'Parcial', 'Não'] as const).map((status) => {
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
                                      ? status === 'Sim'
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                        : status === 'Parcial'
                                          ? "bg-amber-500 text-white border-amber-500 shadow-md"
                                          : "bg-rose-600 text-white border-rose-600 shadow-md"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100",
                                    showValidationErrors && !activeCycle.check?.expectedGainAchieved && "border-rose-500 ring-1 ring-rose-500"
                                  )}
                                >
                                  {status}
                                </button>
                              );
                            })}
                          </div>
                          {showValidationErrors && !activeCycle.check?.expectedGainAchieved && (
                            <p className="text-xs text-rose-500 font-bold">
                              Selecione se o ganho esperado foi atingido para concluir esta etapa.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botão Avançar para ACT (Posição: após 3. Conclusão) */}
                      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs font-medium">
                          {!isCheckPhaseValid ? (
                            <span className="text-amber-600 font-bold flex items-center gap-1.5">
                              <AlertTriangle size={16} className="shrink-0" />
                              Preencha o campo '3. Conclusão' e conclua o acompanhamento das ações em CHECK para habilitar o avanço.
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                              <CheckCircle2 size={16} className="shrink-0" />
                              Etapa de verificação e medição de ganhos concluída! Pronto para avançar.
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isCheckPhaseValid) {
                              setShowValidationErrors(true);
                              setSaveFeedback(
                                "Para avançar para ACT, selecione 'O ganho esperado foi atingido?' em 3. Conclusão e conclua o acompanhamento de todas as ações."
                              );
                              return;
                            }
                            handlePhaseChange("ACT");
                          }}
                          disabled={!isCheckPhaseValid}
                          className={cn(
                            "w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer",
                            isCheckPhaseValid
                              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60 shadow-none"
                          )}
                        >
                          Avançar para ACT
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>

                    </motion.div>
                )}

                {activePhase === "ACT" && (
                  <motion.div
                    key="act"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">
                          Ação de Melhoria Contínua
                        </h4>
                        <p className="text-slate-500 text-sm mt-1">
                          Padronização ou novos ajustes para cada ação.
                        </p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {activeCycle.plan.actionPlan.filter(
                          (item) =>
                            item.status !== "Cancelado" && item.ativo !== false,
                        ).length === 0 ? (
                          <div className="p-20 text-center text-slate-400 italic">
                            Nenhuma ação para agir (ACT).
                          </div>
                        ) : (
                          activeCycle.plan.actionPlan
                            .filter(
                              (item) =>
                                item.status !== "Cancelado" &&
                                item.ativo !== false,
                            )
                            .map((item, filteredIdx) => {
                              const isExpanded = expandedActionId === item.id;
                              const isCheckDone =
                                !!item.monitoringTool?.trim() &&
                                !!item.worked &&
                                (item.worked === "Sim" ||
                                  !!item.failureReason?.trim());

                              // Debug log for tracking blocking logic
                              console.log(
                                `ACT Action ${item.id}: isCheckDone=${isCheckDone}`,
                                item,
                              );

                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "border-b border-slate-100 last:border-0 transition-all",
                                    !isCheckDone
                                      ? "bg-slate-50/50 opacity-75"
                                      : isExpanded
                                        ? "bg-white"
                                        : "hover:bg-slate-50/50",
                                  )}
                                >
                                  {/* Accordion Header */}
                                  <button
                                    onClick={() =>
                                      isCheckDone &&
                                      setExpandedActionId(
                                        isExpanded ? null : item.id,
                                      )
                                    }
                                    className={cn(
                                      "w-full p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left group",
                                      !isCheckDone && "cursor-not-allowed",
                                    )}
                                  >
                                    <div className="flex items-center gap-4 flex-1">
                                      <div className="relative">
                                        <span
                                          className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 shadow-sm",
                                            isExpanded
                                              ? "bg-indigo-600 text-white"
                                              : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
                                            !isCheckDone &&
                                              "bg-slate-200 text-slate-400",
                                          )}
                                        >
                                          {filteredIdx + 1}
                                        </span>
                                        {!isCheckDone && (
                                          <div
                                            className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-sm"
                                            title="Aguardando conclusão da etapa CHECK"
                                          >
                                            <Lock size={10} />
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <h5
                                            className={cn(
                                              "font-bold text-lg truncate transition-colors",
                                              isCheckDone
                                                ? "text-theme-foreground group-hover:text-indigo-400"
                                                : "text-slate-400",
                                            )}
                                          >
                                            {item.what || "Ação sem descrição"}
                                          </h5>
                                          {!isCheckDone && (
                                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg uppercase tracking-widest whitespace-nowrap">
                                              Aguardando CHECK
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <CheckCircle2
                                              size={12}
                                              className="text-slate-400"
                                            />
                                            Status Final:{" "}
                                            <span
                                              className={
                                                isCheckDone
                                                  ? "text-slate-600 font-black"
                                                  : "text-slate-400"
                                              }
                                            >
                                              {item.finalProblemStatus ||
                                                "Pendente"}
                                            </span>
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <Target
                                              size={12}
                                              className="text-slate-400"
                                            />
                                            Ação Final:{" "}
                                            <span
                                              className={
                                                isCheckDone
                                                  ? "text-slate-600 font-black"
                                                  : "text-slate-400"
                                              }
                                            >
                                              {item.finalAction || "Pendente"}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                      <div className="hidden sm:block">
                                        {isCheckDone ? (
                                          <span
                                            className={cn(
                                              "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                                              !!item.finalProblemStatus
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-amber-100 text-amber-700",
                                            )}
                                          >
                                            ACT:{" "}
                                            {item.finalProblemStatus
                                              ? "Finalizado"
                                              : "Em andamento"}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-100 text-slate-400 uppercase tracking-wider">
                                            Bloqueado
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={cn(
                                          "w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 transition-transform duration-300 group-hover:border-indigo-200 group-hover:text-indigo-500",
                                          isExpanded &&
                                            "rotate-180 bg-indigo-50 border-indigo-200 text-indigo-600",
                                        )}
                                      >
                                        <ChevronDown size={18} />
                                      </div>
                                    </div>
                                  </button>

                                  {/* Accordion Content */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                          duration: 0.3,
                                          ease: "easeInOut",
                                        }}
                                        className=""
                                      >
                                        <div className="px-8 pb-8 space-y-8 animate-in fade-in slide-in-from-top-1 duration-300 pt-4 border-t border-slate-50">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-1">
                                            <div className="space-y-4">
                                              <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                  Status Final do Problema
                                                </label>
                                                <select
                                                  value={
                                                    item.finalProblemStatus ||
                                                    "Resolvido"
                                                  }
                                                  onChange={(e) =>
                                                    updateActionPlan(item.id, {
                                                      finalProblemStatus: e
                                                        .target.value as any,
                                                    })
                                                  }
                                                  disabled={!isCheckDone}
                                                  className={cn(
                                                    "w-full bg-theme-background px-4 py-3 rounded-xl text-xs font-bold outline-none border border-theme-border focus:ring-2 focus:ring-indigo-500 transition-all text-theme-foreground",
                                                    !isCheckDone &&
                                                      "opacity-50 cursor-not-allowed",
                                                  )}
                                                >
                                                  <option value="Resolvido">
                                                    Resolvido
                                                  </option>
                                                  <option value="Não resolvido">
                                                    Não resolvido
                                                  </option>
                                                </select>
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                  Ação Final
                                                </label>
                                                <select
                                                  value={
                                                    item.finalAction ||
                                                    "Padronizar processo"
                                                  }
                                                  onChange={(e) =>
                                                    updateActionPlan(item.id, {
                                                      finalAction: e.target
                                                        .value as any,
                                                    })
                                                  }
                                                  disabled={!isCheckDone}
                                                  className={cn(
                                                    "w-full bg-theme-background px-4 py-3 rounded-xl text-xs font-bold outline-none border border-theme-border focus:ring-2 focus:ring-indigo-500 transition-all text-theme-foreground",
                                                    !isCheckDone &&
                                                      "opacity-50 cursor-not-allowed",
                                                  )}
                                                >
                                                  <option value="Padronizar processo">
                                                    Padronizar processo
                                                  </option>
                                                  <option value="Fazer nova análise">
                                                    Fazer nova análise
                                                  </option>
                                                </select>
                                              </div>
                                            </div>

                                            <div className="space-y-4">
                                              {item.finalAction ===
                                                "Padronizar processo" && (
                                                <div className="space-y-3">
                                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                    Modelo de Padronização
                                                    Sugerido
                                                  </label>
                                                  <div className="flex flex-wrap gap-2">
                                                    {[
                                                      "POP",
                                                      "ITO",
                                                      "Painel de controle",
                                                    ].map((model) => (
                                                      <button
                                                        key={model}
                                                        onClick={() => {
                                                          if (!isCheckDone)
                                                            return;
                                                          const current =
                                                            item.standardizationModels ||
                                                            [];
                                                          const next =
                                                            current.includes(
                                                              model as any,
                                                            )
                                                              ? current.filter(
                                                                  (m) =>
                                                                    m !== model,
                                                                )
                                                              : [
                                                                  ...current,
                                                                  model as any,
                                                                ];
                                                          updateActionPlan(
                                                            item.id,
                                                            {
                                                              standardizationModels:
                                                                next,
                                                            },
                                                          );
                                                        }}
                                                        disabled={!isCheckDone}
                                                        className={cn(
                                                          "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                          item.standardizationModels?.includes(
                                                            model as any,
                                                          )
                                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg"
                                                            : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300",
                                                          !isCheckDone &&
                                                            "opacity-50 cursor-not-allowed",
                                                        )}
                                                      >
                                                        {model}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}

                                              {item.finalProblemStatus ===
                                                "Não resolvido" &&
                                                item.finalAction ===
                                                  "Fazer nova análise" && (
                                                  <div className="pt-2">
                                                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3 mb-4">
                                                      <AlertCircle
                                                        size={20}
                                                        className="text-amber-500 shrink-0"
                                                      />
                                                      <p className="text-[10px] text-amber-700 font-medium leading-tight">
                                                        O problema persiste.
                                                        Recomendamos iniciar um
                                                        novo ciclo PDCA para
                                                        aprofundar a análise.
                                                      </p>
                                                    </div>
                                                    <button
                                                      onClick={() => {
                                                        if (!isCheckDone)
                                                          return;
                                                        createNewCycle(
                                                          activeCycle.taskId,
                                                          activeCycle.plan
                                                            .problemDescription,
                                                        );
                                                      }}
                                                      disabled={!isCheckDone}
                                                      className={cn(
                                                        "w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95",
                                                        !isCheckDone &&
                                                          "opacity-50 cursor-not-allowed",
                                                      )}
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
                      {activeCycle.status === "Ativo" && (
                        <div className="pt-12 border-t border-slate-200">
                          <div
                            className={cn(
                              "p-8 rounded-[2.5rem] bg-white border-2 border-dashed transition-all flex flex-col items-center text-center gap-6",
                              isActPhaseValid
                                ? "border-emerald-200 bg-emerald-50/30"
                                : "border-slate-100 opacity-60",
                            )}
                          >
                            <div
                              className={cn(
                                "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                                isActPhaseValid
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-100 text-slate-300",
                              )}
                            >
                              <CheckCircle2 size={32} />
                            </div>
                            <div className="max-w-md">
                              <h4 className="text-xl font-black text-slate-800 tracking-tight">
                                Finalizar Ciclo PDCA
                              </h4>
                              <p className="text-slate-500 text-sm mt-2">
                                {isActPhaseValid
                                  ? "Todas as informações foram preenchidas. Você já pode concluir este ciclo e visualizar o relatório final."
                                  : "Preencha todas as informações da fase de ACT (Padronização ou Reanálise) para concluir o ciclo."}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                updateCycle({ status: "Concluído" });
                                setSaveFeedback(
                                  "Ciclo PDCA concluído com sucesso! 🚀",
                                );
                                setActivePhase("REPORT");
                              }}
                              disabled={!isActPhaseValid}
                              className={cn(
                                "px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl",
                                isActPhaseValid
                                  ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100 active:scale-95"
                                  : "bg-slate-200 text-slate-400 cursor-not-allowed",
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

                {activePhase === "REPORT" && (
                  <motion.div
                    key="report"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="max-w-5xl mx-auto space-y-8"
                  >
                    <div className="flex justify-between items-center no-print">
                      <div>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight">
                          Relatório PDCA
                        </h4>
                        <p className="text-slate-500 text-sm mt-1">
                          Resumo executivo do ciclo de melhoria.
                        </p>
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
                              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100",
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

                    <div
                      id="pdca-report-content"
                      className="space-y-12 pb-12 print-container bg-white p-8 rounded-[2.5rem]"
                    >
                      {relatedCycles.map((cycle, cycleIdx) => (
                        <div
                          key={cycle.id}
                          className="space-y-8 border-b-4 border-slate-100 pb-12 last:border-0 last:pb-0 min-h-[260mm]"
                        >
                          <PDFHeader
                            projectName={project.name}
                            cycleTitle={cycle.title}
                          />
                          <div className="flex items-center gap-4 bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-900/20">
                              {cycleIdx + 1}
                            </div>
                            <div>
                              <h5 className="text-xl font-black tracking-tight uppercase">
                                Ciclo {cycleIdx + 1}
                              </h5>
                              <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">
                                {cycleIdx === 0
                                  ? "Primeira Tentativa"
                                  : "Reanálise de Melhoria"}{" "}
                                • Iniciado em{" "}
                                {format(
                                  new Date(cycle.createdAt),
                                  "dd/MM/yyyy",
                                )}
                              </p>
                            </div>
                          </div>

                          {/* PLAN */}
                          <ReportSection title="PLAN (Planejar)" color="indigo">
                            <ReportField
                              label="Descrição do Problema"
                              value={cycle.plan?.problemDescription}
                            />
                            <ReportField
                              label="Causa Raiz Identificada"
                              value={
                                cycle.plan?.rootCauseAnalysis
                                  ?.identifiedRootCause || "Não informada"
                              }
                            />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <ReportField
                                label="Impacto: Descrição"
                                value={cycle.plan?.impact?.description}
                              />
                              <ReportField
                                label="Impacto: Valor Atual"
                                value={`R$ ${cycle.plan?.impact?.value || 0}`}
                              />
                              <ReportField
                                label="Impacto: Meta (%)"
                                value={`${cycle.plan?.impact?.improvementPercentage ?? cycle.plan?.impact?.goal ?? 0}%`}
                              />
                            </div>
                            <ReportField
                              label="Método Utilizado"
                              value={(() => {
                                const rcaType = cycle.plan?.rootCauseAnalysis?.type;
                                if (!rcaType) return "Não informado";
                                const normalized = rcaType.toLowerCase().trim();
                                if (normalized === "5whys" || normalized === "5_whys" || normalized === "5 porquês") {
                                  return "5 Porquês";
                                }
                                if (
                                  normalized === "list" ||
                                  normalized === "lista" ||
                                  normalized === "lista_causas" ||
                                  normalized === "lista de causas"
                                ) {
                                  return "Lista de causas";
                                }
                                if (normalized === "ishikawa") {
                                  return "Ishikawa";
                                }
                                return "Não informado";
                              })()}
                            />

                            <div className="mt-6 pt-6 border-t border-slate-100 overflow-x-auto no-scrollbar">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                Plano de Ação (5W2H)
                              </p>
                              <div className="space-y-4 min-w-[600px]">
                                {(cycle.plan?.actionPlan || [])
                                  .filter(
                                    (item) =>
                                      item.status !== "Cancelado" &&
                                      item.ativo !== false,
                                  )
                                  .map((item) => (
                                    <div
                                      key={item.id}
                                      className="grid grid-cols-6 gap-4 text-[10px] p-3 bg-slate-50 rounded-xl"
                                    >
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          O que
                                        </p>
                                        <p className="font-bold text-slate-700">
                                          {item.what}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Por que
                                        </p>
                                        <p className="font-bold text-slate-700">
                                          {item.why}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Onde
                                        </p>
                                        <p className="font-bold text-slate-700">
                                          {item.where}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Quando
                                        </p>
                                        <p className="font-bold text-slate-700">
                                          {item.when}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Quem
                                        </p>
                                        <p className="font-bold text-slate-700">
                                          {item.who}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Como
                                        </p>
                                        <p className="font-bold text-slate-700">
                                          {item.how}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </ReportSection>

                          {/* DO */}
                          <ReportSection title="DO (Executar)" color="amber">
                            <div className="space-y-4">
                              {(cycle.plan?.actionPlan || [])
                                .filter(
                                  (item) =>
                                    item.status !== "Cancelado" &&
                                    item.ativo !== false,
                                )
                                .map((item, idx) => (
                                  <div
                                    key={item.id}
                                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3"
                                  >
                                    <div className="flex justify-between items-start">
                                      <p className="font-bold text-slate-800">
                                        {idx + 1}. {item.what}
                                      </p>
                                      <StatusBadge
                                        status={item.status as any}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px]">
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Responsável
                                        </p>
                                        <p className="font-bold text-slate-600">
                                          {item.who}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Início
                                        </p>
                                        <p className="font-bold text-slate-600">
                                          {item.startDate
                                            ? format(
                                                new Date(item.startDate),
                                                "dd/MM/yyyy",
                                              )
                                            : "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Conclusão
                                        </p>
                                        <p className="font-bold text-slate-600">
                                          {item.endDate
                                            ? format(
                                                new Date(item.endDate),
                                                "dd/MM/yyyy",
                                              )
                                            : "N/A"}
                                        </p>
                                      </div>
                                    </div>
                                    {item.executionLogs && item.executionLogs.length > 0 && (
                                      <div className="pt-2 border-t border-slate-200">
                                        <p className="font-extrabold text-slate-400 uppercase text-[8px] mb-2 tracking-wider">
                                          Histórico de Atualizações
                                        </p>
                                        <div className="space-y-2">
                                          {[...item.executionLogs]
                                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                            .map((log) => (
                                              <div
                                                key={log.id}
                                                className="p-2.5 bg-white border border-slate-100 rounded-xl space-y-1 shadow-sm leading-relaxed"
                                              >
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                                  <span>
                                                    [{log.timestamp ? format(new Date(log.timestamp), "dd/MM/yyyy HH:mm") : "---"}]
                                                  </span>
                                                  {log.responsible && (
                                                    <span>- {log.responsible}</span>
                                                  )}
                                                </div>
                                                {log.status && (
                                                  <div className="text-[10px] text-slate-600 font-semibold">
                                                    Status: {log.status}
                                                  </div>
                                                )}
                                                {log.observation && log.observation.trim() !== "" && (
                                                  <div className="text-[10px] text-slate-600 pl-1.5 border-l-2 border-slate-200 whitespace-pre-wrap italic">
                                                    Observação: {log.observation}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </ReportSection>

                          {/* CHECK */}
                          <ReportSection
                            title="CHECK (Verificar)"
                            color="emerald"
                          >
                            <div className="space-y-4">
                              {(cycle.plan?.actionPlan || [])
                                .filter(
                                  (item) =>
                                    item.status !== "Cancelado" &&
                                    item.ativo !== false,
                                )
                                .map((item, idx) => (
                                  <div
                                    key={item.id}
                                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3"
                                  >
                                    <p className="font-bold text-slate-800">
                                      {idx + 1}. {item.what}
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px]">
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Observações do Acompanhamento
                                        </p>
                                        <p className="font-bold text-slate-600 whitespace-pre-wrap">
                                          {item.monitoringPeriod && item.monitoringMode ? `${item.monitoringPeriod} ${item.monitoringMode}` : ''}
                                          {item.monitoringTool ? (item.monitoringPeriod ? ` – ${item.monitoringTool}` : item.monitoringTool) : '---'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Funcionou?
                                        </p>
                                        <p
                                          className={cn(
                                            "font-bold",
                                            item.worked === "Sim"
                                              ? "text-emerald-600"
                                              : "text-rose-600",
                                          )}
                                        >
                                          {item.worked}
                                        </p>
                                      </div>
                                      {(item.worked === "Não" ||
                                        item.worked === "Parcial") && (
                                        <div className="col-span-2">
                                          <p className="font-black text-slate-400 uppercase">
                                            Motivo
                                          </p>
                                          <p className="font-bold text-slate-600">
                                            {item.failureReason || "N/A"}
                                          </p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Impacto de Ganho
                                        </p>
                                        {(() => {
                                          const totalGain = (
                                            item.realGains?.tangible || []
                                          ).reduce(
                                            (acc, t) => acc + (t.value || 0),
                                            0,
                                          );
                                          return (
                                            <p
                                              className={cn(
                                                "font-bold",
                                                totalGain < 0
                                                  ? "text-rose-600 dark:text-rose-400"
                                                  : "text-emerald-600 dark:text-emerald-400",
                                              )}
                                            >
                                              R${" "}
                                              {totalGain.toLocaleString("pt-BR", {
                                                minimumFractionDigits: 2,
                                              })}
                                            </p>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </ReportSection>

                          {/* ACT */}
                          <ReportSection title="ACT (Agir)" color="rose">
                            <div className="space-y-4">
                              {(cycle.plan?.actionPlan || [])
                                .filter(
                                  (item) =>
                                    item.status !== "Cancelado" &&
                                    item.ativo !== false,
                                )
                                .map((item, idx) => (
                                  <div
                                    key={item.id}
                                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3"
                                  >
                                    <p className="font-bold text-slate-800">
                                      {idx + 1}. {item.what}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px]">
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Status Final
                                        </p>
                                        <p
                                          className={cn(
                                            "font-bold",
                                            item.finalProblemStatus ===
                                              "Resolvido"
                                              ? "text-emerald-600"
                                              : "text-rose-600",
                                          )}
                                        >
                                          {item.finalProblemStatus}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-400 uppercase">
                                          Ação Final
                                        </p>
                                        <p className="font-bold text-slate-600">
                                          {item.finalAction}
                                        </p>
                                      </div>
                                      {item.finalAction ===
                                        "Padronizar processo" && (
                                        <div>
                                          <p className="font-black text-slate-400 uppercase">
                                            Padronização
                                          </p>
                                          <p className="font-bold text-indigo-600">
                                            {(
                                              item.standardizationModels || []
                                            ).join(", ")}
                                          </p>
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
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  Finalizar Plano de Ação?
                </h3>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Tem certeza que deseja marcar este plano de ação como
                  concluído?
                  <span className="block mt-2 font-bold text-rose-500 italic">
                    Após essa ação, não será mais possível editar este registro
                    no histórico.
                  </span>
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
                      const obsInput = document.getElementById(
                        confirmingLog.obsInputId,
                      ) as HTMLInputElement;
                      if (obsInput) obsInput.value = "";
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

        {cycleToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-left"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-3">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                  <Trash2 size={22} />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                  Excluir ciclo PDCA
                </h3>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-6">
                Deseja realmente excluir este ciclo PDCA?{"\n\n"}
                Essa ação não poderá ser desfeita.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCycleToDelete(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDeleteCycle(cycleToDelete.id)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shadow-md transition-all"
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
}

function ReportSection({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
    rose: "bg-rose-50 border-rose-100 text-rose-800",
    slate: "bg-theme-background border-theme-border text-theme-foreground",
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div
        className={cn(
          "px-6 py-4 border-b font-black text-xs uppercase tracking-widest",
          colorClasses[color],
        )}
      >
        {title}
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </div>
  );
}

function ReportField({ label, value }: { label: string; value: any }) {
  const isLink = value && typeof value === "string" && isValidUrl(value);

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </p>
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
        <p className="text-sm font-bold text-slate-700">{value || "N/A"}</p>
      )}
    </div>
  );
}

function PlanStepButton({
  active,
  completed,
  onClick,
  number,
  label,
}: {
  active: boolean;
  completed?: boolean;
  onClick: () => void;
  number: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center gap-3 px-6 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest relative whitespace-nowrap",
        active
          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 ring-2 ring-indigo-600 ring-offset-2"
          : completed
            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100"
            : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-100",
      )}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border shrink-0",
          active
            ? "bg-white text-indigo-600 border-white"
            : completed
              ? "bg-white text-emerald-600 border-emerald-200"
              : "bg-white text-slate-300 border-slate-200",
        )}
      >
        {completed && !active ? <CheckCircle2 size={12} /> : number}
      </div>
      <span className="truncate">{label}</span>
      {active && (
        <motion.div
          layoutId="plan-step-pill"
          className="absolute inset-0 bg-indigo-600 rounded-2xl -z-10"
        />
      )}
    </button>
  );
}

function ParetoInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function PhaseSection({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
}) {
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
