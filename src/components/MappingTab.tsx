import React from 'react';
import { Project, Subtask, SavedColor } from '../types';
import BPMNModeler from './BPMNModeler';

export default function MappingTab({ 
  project, 
  subtask, 
  onUpdateSubtask,
  savedColors,
  onSaveGlobalColor,
  onDeleteGlobalColor
}: { 
  project: Project, 
  subtask: Subtask, 
  onUpdateSubtask: (s: Subtask) => void,
  savedColors: SavedColor[],
  onSaveGlobalColor: (color: SavedColor) => void,
  onDeleteGlobalColor: (id: string) => void
}) {
  const handleUpdateMapping = (updatedMapping: any) => {
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
      />
    </div>
  );
}
