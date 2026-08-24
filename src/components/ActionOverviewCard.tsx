import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User as UserIcon, 
  MoreVertical, 
  Save, 
  X, 
  Trash2, 
  History, 
  Check, 
  AlertCircle,
  Folder,
  Layers,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { OperationalAction, ProjectPriority } from '../types';
import { cn } from '../lib/utils';
import { calculateActionAlert } from '../utils/calculations';

interface ActionOverviewCardProps {
  key?: string;
  action: OperationalAction;
  isEditing: boolean;
  tempUpdates: Partial<OperationalAction>;
  onStartEditing: (action: OperationalAction) => void;
  onCancelEditing: () => void;
  onTempUpdateChange: (updates: Partial<OperationalAction>) => void;
  onSaveAction: (id: string, updates: Partial<OperationalAction>) => void;
  onDeleteClick: (action: OperationalAction) => void;
  onQuickComplete: (action: OperationalAction) => void;
  isTarget?: boolean;
}

export default function ActionOverviewCard({
  action,
  isEditing,
  tempUpdates,
  onStartEditing,
  onCancelEditing,
  onTempUpdateChange,
  onSaveAction,
  onDeleteClick,
  onQuickComplete,
  isTarget = false
}: ActionOverviewCardProps) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const currentStatus = isEditing ? (tempUpdates.status || action.status) : action.status;
  const currentFeedback = isEditing ? (tempUpdates.feedback || action.feedback) : action.feedback;
  const currentCompletionDate = isEditing ? (tempUpdates.completionDate || action.completionDate) : action.completionDate;

  const alert = calculateActionAlert(action);

  // Alerta badge style
  let alertBadgeStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
  let alertDotColor = "bg-slate-400";
  if (alert === 'Dentro do prazo') {
    alertBadgeStyle = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    alertDotColor = "bg-emerald-500";
  } else if (alert === 'Próximo do vencimento') {
    alertBadgeStyle = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
    alertDotColor = "bg-amber-500";
  } else if (alert === 'Atrasado') {
    alertBadgeStyle = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25";
    alertDotColor = "bg-rose-500 animate-pulse";
  } else if (alert === 'Concluído no prazo') {
    alertBadgeStyle = "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    alertDotColor = "bg-blue-500";
  } else if (alert === 'Concluído fora do prazo') {
    alertBadgeStyle = "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20";
    alertDotColor = "bg-violet-500";
  }

  // Priority badge style
  let priorityBadge = "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700";
  if (action.priority === 'Urgente') {
    priorityBadge = "bg-red-500/15 text-red-600 dark:text-red-400 font-black border-red-500/30";
  } else if (action.priority === 'Alta') {
    priorityBadge = "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border-rose-500/20";
  } else if (action.priority === 'Média') {
    priorityBadge = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border-indigo-500/20";
  }

  // Status badge style
  let statusBadge = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  if (currentStatus === 'Concluído') {
    statusBadge = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  } else if (currentStatus === 'Em andamento') {
    statusBadge = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  } else if (currentStatus === 'Pausado') {
    statusBadge = "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30";
  }

  return (
    <div 
      id={`action-card-${action.id}`}
      className={cn(
        "bg-theme-card rounded-2xl border p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md group",
        isEditing ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10" : "border-theme-border hover:border-indigo-200 dark:hover:border-indigo-800",
        isTarget && "ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
      )}
    >
      {/* Top badges: Subtarefa, Prioridade, Alerta de Prazo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {action.subtaskTitle ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate max-w-[220px]" title={action.subtaskTitle}>
              <Layers size={12} className="text-indigo-500 shrink-0" />
              <span className="truncate">{action.subtaskTitle}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-slate-400">
              Geral do Projeto
            </span>
          )}

          {/* Prioridade */}
          <span className={cn("px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider border", priorityBadge)}>
            {action.priority}
          </span>
        </div>

        {/* Alerta de Prazo Badge */}
        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border", alertBadgeStyle)}>
          <span className={cn("w-2 h-2 rounded-full shrink-0", alertDotColor)} />
          <span>{alert}</span>
        </div>
      </div>

      {/* Descrição Principal da Ação */}
      <div className="bg-theme-background/60 p-3.5 rounded-xl border border-theme-border/60">
        <p className="text-sm font-semibold text-theme-foreground leading-relaxed">
          {action.action}
        </p>
      </div>

      {/* Grid de Metadados: Responsável, Previsão, Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        {/* Responsável */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 min-w-0">
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
            {(action.responsibleName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Responsável</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate block" title={action.responsibleName}>
              {action.responsibleName}
            </span>
          </div>
        </div>

        {/* Previsão de Conclusão */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80">
          <Calendar size={15} className="text-indigo-500 shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Previsão</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {action.forecastDate ? format(new Date(action.forecastDate), 'dd/MM/yyyy') : '-'}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80">
          {isEditing ? (
            <div className="w-full">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Status</span>
              <select
                value={currentStatus}
                onChange={(e) => onTempUpdateChange({ status: e.target.value as any })}
                className="w-full text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-1 outline-none"
              >
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Pausado">Pausado</option>
              </select>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Status</span>
              <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black uppercase inline-block border", statusBadge)}>
                {currentStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Retorno da Tratativa (Feedback) & Histórico */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Retorno da Tratativa
          </span>
          {action.historicoTratativas && action.historicoTratativas.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <History size={12} />
              <span>{isHistoryExpanded ? 'Ocultar Histórico' : `Histórico (${action.historicoTratativas.length})`}</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={currentFeedback || ''}
              onChange={(e) => onTempUpdateChange({ feedback: e.target.value })}
              placeholder="Descreva o retorno ou andamento da tratativa..."
              className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 outline-none border border-slate-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none min-h-[70px]"
            />
            {currentStatus === 'Concluído' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Data de Conclusão:</span>
                <input
                  type="date"
                  value={currentCompletionDate || ''}
                  onChange={(e) => onTempUpdateChange({ completionDate: e.target.value })}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 min-h-[44px] flex items-center">
            {action.feedback ? (
              <p className="leading-relaxed whitespace-pre-wrap">{action.feedback}</p>
            ) : (
              <span className="text-slate-400 italic">Nenhum retorno registrado.</span>
            )}
          </div>
        )}

        {/* Histórico expandido */}
        <AnimatePresence>
          {isHistoryExpanded && action.historicoTratativas && action.historicoTratativas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 border-l-2 border-indigo-400 pl-3 py-1 mt-2 text-xs"
            >
              {action.historicoTratativas.map((item, hIdx) => (
                <div key={hIdx} className="bg-slate-50/80 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span className="text-slate-700 dark:text-slate-300">{item.usuario}</span>
                    <span>{item.data ? format(new Date(item.data), 'dd/MM/yyyy HH:mm') : ''}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] italic leading-relaxed">{item.texto}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botões de Ação do Card */}
      <div className="pt-2 border-t border-theme-border/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => onSaveAction(action.id, tempUpdates)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
              >
                <Save size={14} />
                Salvar
              </button>
              <button
                type="button"
                onClick={onCancelEditing}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <X size={14} />
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onStartEditing(action)}
                disabled={action.status === 'Concluído'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                title={action.status === 'Concluído' ? 'Ações concluídas não podem ser editadas' : 'Editar ação e tratativa'}
              >
                <MoreVertical size={14} />
                Editar Tratativa
              </button>

              {action.status !== 'Concluído' && (
                <button
                  type="button"
                  onClick={() => onQuickComplete(action)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer"
                  title="Concluir ação rapidamente"
                >
                  <Check size={14} />
                  Concluir
                </button>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDeleteClick(action)}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
          title="Excluir ação"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
