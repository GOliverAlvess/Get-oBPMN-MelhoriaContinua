import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AlertCircle, User } from 'lucide-react';
import { BPMNTaskData } from '../types';
import { cn } from '../lib/utils';

const BPMNTaskNode = ({ data, selected }: NodeProps<BPMNTaskData>) => {
  const renderShape = () => {
    const commonProps = {
      className: "w-full h-full",
      style: { 
        fill: data.backgroundColor || '#ffffff',
        stroke: data.borderColor || '#e2e8f0',
        strokeWidth: 2
      }
    };

    switch (data.shapeType) {
      case 'circle':
        return <circle cx="50%" cy="50%" r="45%" {...commonProps} />;
      case 'diamond':
        return <path d="M 50 5 L 95 50 L 50 95 L 5 50 Z" {...commonProps} />;
      case 'hexagon':
        return <path d="M 25 5 L 75 5 L 95 50 L 75 95 L 25 95 L 5 50 Z" {...commonProps} />;
      case 'triangle':
        return <path d="M 50 5 L 95 95 L 5 95 Z" {...commonProps} />;
      case 'cylinder':
        return (
          <g>
            <ellipse cx="50" cy="20" rx="45" ry="15" {...commonProps} />
            <rect x="5" y="20" width="90" height="60" {...commonProps} stroke="none" />
            <path d="M 5 20 L 5 80 A 45 15 0 0 0 95 80 L 95 20" fill="none" stroke={data.borderColor || '#e2e8f0'} strokeWidth="2" />
            <line x1="5" y1="20" x2="5" y2="80" stroke={data.borderColor || '#e2e8f0'} strokeWidth="2" />
            <line x1="95" y1="20" x2="95" y2="80" stroke={data.borderColor || '#e2e8f0'} strokeWidth="2" />
          </g>
        );
      case 'cloud':
        return <path d="M 25 40 A 15 15 0 0 1 50 30 A 20 20 0 0 1 85 45 A 15 15 0 0 1 75 75 A 15 15 0 0 1 25 75 A 15 15 0 0 1 15 55 A 15 15 0 0 1 25 40 Z" {...commonProps} />;
      case 'document':
        return <path d="M 10 5 L 70 5 L 90 25 L 90 95 L 10 95 Z M 70 5 L 70 25 L 90 25" {...commonProps} />;
      case 'data-storage':
        return (
          <g>
            <path d="M 5 15 A 45 10 0 0 1 95 15 L 95 85 A 45 10 0 0 1 5 85 Z" {...commonProps} />
            <path d="M 5 15 A 45 10 0 0 0 95 15" fill="none" stroke={data.borderColor || '#e2e8f0'} strokeWidth="2" />
          </g>
        );
      case 'rounded-rectangle':
        return <rect x="5" y="5" width="90" height="90" rx="15" ry="15" {...commonProps} />;
      case 'rectangle':
      default:
        return <rect x="5" y="5" width="90" height="90" {...commonProps} />;
    }
  };

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center transition-all",
        selected ? "ring-2 ring-indigo-400 ring-offset-4 rounded-lg" : ""
      )}
      style={{ width: 150, height: 100 }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
        {renderShape()}
      </svg>
      
      {data.isProblemStep && (
        <div className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1.5 shadow-md animate-pulse z-10">
          <AlertCircle size={16} />
        </div>
      )}
      
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-4 w-full h-full pointer-events-none">
        {data.responsibleRole && (
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1 opacity-70">
            {data.responsibleRole}
          </span>
        )}
        
        <p className="text-xs font-bold text-slate-800 leading-tight break-words w-full px-2">
          {data.label}
        </p>

        {data.timeInMinutes > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-white/50 px-1 py-0.5 rounded border border-slate-200/30">
            {data.timeInMinutes} min
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400 !opacity-0 hover:!opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400 !opacity-0 hover:!opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-slate-400 !opacity-0 hover:!opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-400 !opacity-0 hover:!opacity-100 transition-opacity" />
    </div>
  );
};

export default memo(BPMNTaskNode);
