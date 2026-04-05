import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AlertCircle, User } from 'lucide-react';
import { BPMNTaskData } from '../types';
import { cn } from '../lib/utils';

const BPMNTaskNode = ({ data, selected }: NodeProps<BPMNTaskData>) => {
  return (
    <div 
      className={cn(
        "px-4 py-3 rounded-lg border-2 shadow-sm transition-all min-w-[180px]",
        selected ? "ring-2 ring-indigo-400 ring-offset-2" : ""
      )}
      style={{ 
        backgroundColor: data.backgroundColor || '#ffffff',
        borderColor: data.borderColor || '#e2e8f0'
      }}
    >
      {data.isProblemStep && (
        <div className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md animate-pulse">
          <AlertCircle size={14} />
        </div>
      )}
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate max-w-[100px]">
            {data.responsibleRole || 'Sem Cargo'}
          </span>
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {data.timeInMinutes} min
          </div>
        </div>
        
        <p className="text-sm font-semibold text-slate-800 leading-tight">
          {data.label}
        </p>
      </div>

      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
};

export default memo(BPMNTaskNode);
