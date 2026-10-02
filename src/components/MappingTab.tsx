import React, { useState, useMemo } from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { Project, Subtask, SavedColor, SubtaskMapping } from '../types';
import { cn } from '../lib/utils';
import BPMNModeler from './BPMNModeler';

export default function MappingTab({ 
  project, 
  subtask, 
  onUpdateSubtask,
  savedColors,
  onSaveGlobalColor,
  onDeleteGlobalColor,
  readOnly = false
}: { 
  project: Project, 
  subtask: Subtask, 
  onUpdateSubtask: (s: Subtask) => void,
  savedColors: SavedColor[],
  onSaveGlobalColor: (color: SavedColor) => void,
  onDeleteGlobalColor: (id: string) => void,
  readOnly?: boolean
}) {
  // Controle da visualização ativa: 'as-is' (Processo Atual) ou 'to-be' (Processo Futuro)
  const [activeMode, setActiveMode] = useState<'as-is' | 'to-be'>('as-is');

  // Estrutura padrão inicial para o TO-BE caso ainda não tenha sido modelado
  const defaultToBeMapping: SubtaskMapping = useMemo(() => ({
    xml: undefined,
    customData: {},
    nodes: [],
    edges: [],
    orientation: 'horizontal',
    lastEdited: new Date().toISOString(),
    savedColors: []
  }), []);

  // Atualização estritamente isolada: altera apenas a estrutura ativa (AS-IS ou TO-BE)
  const handleUpdateMapping = (updatedMapping: any) => {
    if (readOnly) return;
    if (activeMode === 'as-is') {
      onUpdateSubtask({
        ...subtask,
        mapping: updatedMapping
      });
    } else {
      onUpdateSubtask({
        ...subtask,
        mappingToBe: updatedMapping
      });
    }
  };

  // Vínculo com PDCA é exclusivo da estrutura AS-IS (Processo Atual)
  const handleDeletePdcaCycleForTask = (taskId: string, updatedCustomData?: any) => {
    if (readOnly || activeMode !== 'as-is') return;
    const newCycles = (subtask.pdcaCycles || []).filter((c) => c.taskId !== taskId);
    if (updatedCustomData) {
      onUpdateSubtask({
        ...subtask,
        mapping: {
          ...subtask.mapping,
          customData: updatedCustomData,
          lastEdited: new Date().toISOString()
        },
        pdcaCycles: newCycles
      });
    } else {
      onUpdateSubtask({
        ...subtask,
        pdcaCycles: newCycles
      });
    }
  };

  const currentMapping = activeMode === 'as-is' 
    ? subtask.mapping 
    : (subtask.mappingToBe || defaultToBeMapping);

  return (
    <div className="h-full flex flex-col bg-theme-background">
      {/* Barra de Seleção de Estrutura: AS-IS (Processo Atual) vs TO-BE (Processo Futuro) */}
      <div className="bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-colors shrink-0">
        <div className="flex items-center gap-2">
          {/* Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveMode('as-is')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeMode === 'as-is'
                  ? "bg-[#003489] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Layers size={14} />
              <span>AS-IS — Processo Atual</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('to-be')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeMode === 'to-be'
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Sparkles size={14} />
              <span>TO-BE — Processo Futuro</span>
            </button>
          </div>
        </div>

        {/* Descrição conceitual contextual */}
        <div className="flex items-center gap-2 text-xs">
          {activeMode === 'as-is' ? (
            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span>Representa como o processo funciona atualmente, antes das melhorias.</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Representa como o processo deverá funcionar após a implantação das melhorias.</span>
            </span>
          )}
        </div>
      </div>

      {/* Editor BPMN - Reutilização com isolamento total via key */}
      <div className="flex-1 min-h-0 relative">
        <BPMNModeler 
          key={`bpmn-${activeMode}-${subtask.id}`}
          mapping={currentMapping} 
          onUpdateMapping={handleUpdateMapping} 
          onDeletePdcaCycleForTask={activeMode === 'as-is' ? handleDeletePdcaCycleForTask : undefined}
          projectName={project.scope.title}
          savedColors={savedColors}
          onSaveGlobalColor={onSaveGlobalColor}
          onDeleteGlobalColor={onDeleteGlobalColor}
          readOnly={readOnly}
          isToBe={activeMode === 'to-be'}
        />
      </div>
    </div>
  );
}
