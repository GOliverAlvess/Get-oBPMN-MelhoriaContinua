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

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <BPMNModeler 
        mapping={subtask.mapping} 
        onUpdateMapping={handleUpdateMapping} 
        projectName={project.scope.title}
        savedColors={savedColors}
        onSaveGlobalColor={onSaveGlobalColor}
        onDeleteGlobalColor={onDeleteGlobalColor}
        readOnly={readOnly}
      />
    </div>
  );
}
