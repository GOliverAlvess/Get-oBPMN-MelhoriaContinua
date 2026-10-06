import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HelpCircle, 
  X, 
  BookOpen, 
  Info, 
  Target, 
  CheckCircle2, 
  Lightbulb, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { HELP_CONTENT, HelpItemContent } from '../data/helpContent';
import { cn } from '../lib/utils';

export interface ContextHelpProps {
  contentKey?: keyof typeof HELP_CONTENT | string;
  title?: string;
  whatIs?: string;
  whatToDo?: string;
  objective?: string;
  tip?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
  buttonClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  iconOnly?: boolean;
  label?: string;
  tooltipText?: string;
}

export default function ContextHelp({
  contentKey,
  title,
  whatIs,
  whatToDo,
  objective,
  tip,
  actionText,
  onAction,
  className,
  buttonClassName,
  size = 'sm',
  iconOnly = true,
  label,
  tooltipText
}: ContextHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Resgata o conteúdo a partir da chave centralizada ou utiliza propriedades customizadas
  const presetContent: Partial<HelpItemContent> = contentKey && HELP_CONTENT[contentKey] 
    ? HELP_CONTENT[contentKey] 
    : {};

  const displayTitle = title || presetContent.title || 'Ajuda Contextual';
  const displayWhatIs = whatIs || presetContent.whatIs;
  const displayWhatToDo = whatToDo || presetContent.whatToDo;
  const displayObjective = objective || presetContent.objective;
  const displayTip = tip || presetContent.tip;
  const displayActionText = actionText || presetContent.actionText;

  // Fechamento ao pressionar a tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(true);
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsOpen(false);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    if (onAction) {
      onAction();
    }
  };

  const sizeClasses = {
    xs: 'w-4 h-4 text-[10px]',
    sm: 'w-5 h-5 text-xs',
    md: 'w-6 h-6 text-sm'
  };

  const iconSizes = {
    xs: 11,
    sm: 13,
    md: 15
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={tooltipText || `Ajuda: ${displayTitle}`}
        aria-label={`Ajuda: ${displayTitle}`}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-black select-none transition-all cursor-pointer shrink-0",
          "border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:text-indigo-700 dark:hover:text-indigo-300 hover:scale-105 active:scale-95 shadow-2xs",
          sizeClasses[size],
          !iconOnly && "px-2.5 py-1 w-auto rounded-xl gap-1.5",
          buttonClassName,
          className
        )}
      >
        <span className="font-extrabold leading-none">?</span>
        {!iconOnly && label && (
          <span className="text-[11px] font-bold tracking-tight">{label}</span>
        )}
      </button>

      {/* Modal / Dialog de Ajuda Contextual (Renderizado via Portal para garantir posicionamento na viewport) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div 
              className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen"
              onClick={() => handleClose()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] m-auto shrink-0"
                role="dialog"
                aria-modal="true"
                aria-labelledby="context-help-title"
              >
                {/* Header do Card de Ajuda */}
                <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-indigo-50/70 via-slate-50/40 to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 flex items-start justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-indigo-200 dark:shadow-none shrink-0">
                      ?
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900">
                          Ajuda Contextual
                        </span>
                      </div>
                      <h3 
                        id="context-help-title"
                        className="text-lg md:text-xl font-black text-slate-900 dark:text-white mt-1 tracking-tight"
                      >
                        {displayTitle}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClose()}
                    aria-label="Fechar ajuda"
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Corpo de Conteúdo */}
                <div className="p-5 md:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
                  {/* 1. O que é? */}
                  {displayWhatIs && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Info size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <h4 className="text-xs font-black uppercase tracking-wider">O que é?</h4>
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed pl-5.5">
                        {displayWhatIs}
                      </p>
                    </div>
                  )}

                  {/* 2. O que fazer aqui? */}
                  {displayWhatToDo && (
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/40 rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                        <CheckCircle2 size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">O que fazer aqui?</h4>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed pl-5.5">
                        {displayWhatToDo}
                      </p>
                    </div>
                  )}

                  {/* 3. Objetivo */}
                  {displayObjective && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Target size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <h4 className="text-xs font-black uppercase tracking-wider">Objetivo</h4>
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed pl-5.5">
                        {displayObjective}
                      </p>
                    </div>
                  )}

                  {/* 4. Dica (quando aplicável) */}
                  {displayTip && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                        <Lightbulb size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">Dica</h4>
                      </div>
                      <p className="text-sm font-medium text-amber-900/90 dark:text-amber-200/90 leading-relaxed pl-5.5">
                        {displayTip}
                      </p>
                    </div>
                  )}

                  {/* Botão de Ação / Link Educacional (ex: Aprenda BPMN) */}
                  {displayActionText && onAction && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleActionClick}
                        className="w-full flex items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <BookOpen size={16} className="text-indigo-200" />
                          <span>{displayActionText}</span>
                        </div>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Rodapé com botão de fechar */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => handleClose()}
                    className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    Entendi
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
