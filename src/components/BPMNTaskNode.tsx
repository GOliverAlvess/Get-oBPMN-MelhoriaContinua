import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import { AlertCircle } from 'lucide-react';
import { BPMNTaskData } from '../types';
import { cn } from '../lib/utils';

const BPMNTaskNode = ({ data, selected }: NodeProps<BPMNTaskData>) => {
  const nodeWidth = data.width || 150;
  const nodeHeight = data.height || 100;

  const renderShape = () => {
    const backgroundColor = data.backgroundColor || '#ffffff';
    const borderColor = data.borderColor || '#333333';

    const commonProps = {
      fill: backgroundColor,
      stroke: borderColor,
      strokeWidth: 2
    };

    switch (data.shapeType) {
      case 'startEvent':
        return <circle cx="50" cy="50" r="40" {...commonProps} stroke={borderColor === '#333333' ? '#2ecc71' : borderColor} />;
      case 'endEvent':
        return <circle cx="50" cy="50" r="40" {...commonProps} stroke={borderColor === '#333333' ? '#e74c3c' : borderColor} strokeWidth="4" />;
      case 'gateway':
        return <path d="M 50 5 L 95 50 L 50 95 L 5 50 Z" {...commonProps} stroke={borderColor === '#333333' ? '#f1c40f' : borderColor} />;
      case 'subprocess':
        return (
          <g>
            <rect x="5" y="5" width="90" height="90" rx="10" ry="10" {...commonProps} />
            <rect x="40" y="75" width="20" height="15" rx="2" ry="2" fill="none" stroke={borderColor} strokeWidth="1" />
            <line x1="50" y1="78" x2="50" y2="87" stroke={borderColor} strokeWidth="1" />
            <line x1="45" y1="82" x2="55" y2="82" stroke={borderColor} strokeWidth="1" />
          </g>
        );
      case 'document':
        return <path d="M 10 5 L 70 5 L 90 25 L 90 95 L 10 95 Z M 70 5 L 70 25 L 90 25" {...commonProps} />;
      case 'data-storage':
        return (
          <g>
            <path d="M 5 15 A 45 10 0 0 1 95 15 L 95 85 A 45 10 0 0 1 5 85 Z" {...commonProps} />
            <path d="M 5 15 A 45 10 0 0 0 95 15" fill="none" stroke={borderColor} strokeWidth="2" />
          </g>
        );
      case 'task':
      default:
        return <rect x="5" y="5" width="90" height="90" rx="10" ry="10" {...commonProps} />;
    }
  };

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center transition-all",
        selected ? "ring-2 ring-indigo-400 ring-offset-4 rounded-lg" : ""
      )}
      style={{ width: nodeWidth, height: nodeHeight }}
    >
      <NodeResizer 
        isVisible={selected} 
        minWidth={50} 
        minHeight={50} 
        lineStyle={{ border: '2px solid #6366f1' }}
        handleStyle={{ width: 8, height: 8, background: '#6366f1', border: '2px solid white' }}
        onResize={(_: any, { width, height }: any) => {
          if (data.onResize) {
            data.onResize(width, height);
          }
        }}
      />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
        {renderShape()}
      </svg>
      
      {data.isProblemStep && (
        <div className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1.5 shadow-md animate-pulse z-20">
          <AlertCircle size={16} />
        </div>
      )}
      
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-4 w-full h-full pointer-events-none overflow-hidden">
        {data.responsibleRole && (
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1 opacity-70 truncate w-full">
            {data.responsibleRole}
          </span>
        )}
        
        <p className="text-xs font-bold text-slate-800 leading-tight break-words w-full px-2 line-clamp-2">
          {data.label}
        </p>

        {data.description && (
          <p className="text-[9px] text-slate-500 mt-1 line-clamp-1 opacity-60">
            {data.description}
          </p>
        )}

        {data.timeInMinutes > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-white/50 px-1 py-0.5 rounded border border-slate-200/30">
            {data.timeInMinutes} min
          </div>
        )}
      </div>

      <Handle 
        type="target" 
        position={Position.Top} 
        className={cn(
          "w-3 h-3 !bg-indigo-500 transition-opacity !border-2 !border-white",
          selected ? "!opacity-100" : "!opacity-0 hover:!opacity-100"
        )} 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className={cn(
          "w-3 h-3 !bg-indigo-500 transition-opacity !border-2 !border-white",
          selected ? "!opacity-100" : "!opacity-0 hover:!opacity-100"
        )} 
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className={cn(
          "w-3 h-3 !bg-indigo-500 transition-opacity !border-2 !border-white",
          selected ? "!opacity-100" : "!opacity-0 hover:!opacity-100"
        )} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={cn(
          "w-3 h-3 !bg-indigo-500 transition-opacity !border-2 !border-white",
          selected ? "!opacity-100" : "!opacity-0 hover:!opacity-100"
        )} 
      />
    </div>
  );
};

export default memo(BPMNTaskNode);
