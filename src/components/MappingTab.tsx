import React from 'react';
import { Project, Subtask, SavedColor } from '../types';
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
  const handleUpdateMapping = (updatedMapping: any) => {
    if (readOnly) return;
    onUpdateSubtask({
      ...subtask,
      mapping: updatedMapping
    });
  };

  const handleDeletePdcaCycleForTask = (taskId: string, updatedCustomData?: any) => {
    if (readOnly) return;
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

  return (
    <div className="h-full flex flex-col bg-theme-background">
      <BPMNModeler 
        mapping={subtask.mapping} 
        onUpdateMapping={handleUpdateMapping} 
        onDeletePdcaCycleForTask={handleDeletePdcaCycleForTask}
        projectName={project.scope.title}
        savedColors={savedColors}
        onSaveGlobalColor={onSaveGlobalColor}
        onDeleteGlobalColor={onDeleteGlobalColor}
        readOnly={readOnly}
      />
    </div>
  );
}
