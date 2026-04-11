import React from 'react';
import { Project, Subtask } from '../types';
import BPMNModeler from './BPMNModeler';

export default function MappingTab({ 
  project, 
  subtask, 
  onUpdateSubtask 
}: { 
  project: Project, 
  subtask: Subtask, 
  onUpdateSubtask: (s: Subtask) => void 
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
      />
    </div>
  );
}
