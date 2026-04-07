import React from 'react';
import { Project } from '../types';
import BPMNModeler from './BPMNModeler';

export default function MappingTab({ project, setProjects }: { project: Project, setProjects: (p: Project) => void }) {
  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(updatedProject);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <BPMNModeler 
        project={project} 
        onUpdateProject={handleUpdateProject} 
      />
    </div>
  );
}
