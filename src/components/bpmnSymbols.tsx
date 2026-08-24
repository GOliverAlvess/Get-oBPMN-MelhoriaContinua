import React from 'react';
import { cn } from '../lib/utils';

// Custom BPMN Diamond Base
export const BpmnDiamond = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" className={cn("overflow-visible shrink-0", className)}>
    <path 
      d="M16 2 L30 16 L16 30 L2 16 Z" 
      fill="white" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinejoin="round"
      className="fill-white dark:fill-slate-800"
    />
    {children}
  </svg>
);

// Gateways
export const ExclusiveGatewayIcon = ({ className }: { className?: string }) => (
  <BpmnDiamond className={cn("text-amber-500", className)}>
    <path d="M11 11 L21 21 M21 11 L11 21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </BpmnDiamond>
);

export const ParallelGatewayIcon = ({ className }: { className?: string }) => (
  <BpmnDiamond className={cn("text-emerald-500", className)}>
    <path d="M16 9 V23 M9 16 H23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </BpmnDiamond>
);

export const InclusiveGatewayIcon = ({ className }: { className?: string }) => (
  <BpmnDiamond className={cn("text-blue-500", className)}>
    <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
  </BpmnDiamond>
);

export const EventGatewayIcon = ({ className }: { className?: string }) => (
  <BpmnDiamond className={cn("text-indigo-500", className)}>
    <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <circle cx="16" cy="16" r="5.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <polygon points="16,11.5 19,13.5 19,16.5 16,18.5 13,16.5 13,13.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </BpmnDiamond>
);

export const ComplexGatewayIcon = ({ className }: { className?: string }) => (
  <BpmnDiamond className={cn("text-purple-500", className)}>
    <path d="M16 9 V23 M9 16 H23 M11 11 L21 21 M21 11 L11 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </BpmnDiamond>
);

// Event Base
export const BpmnEventBase = ({ 
  children, 
  colorClass, 
  strokeWidth = 1.5,
  isDouble = false,
  className
}: { 
  children?: React.ReactNode; 
  colorClass: string; 
  strokeWidth?: number;
  isDouble?: boolean;
  className?: string;
}) => (
  <svg width="32" height="32" viewBox="0 0 32 32" className={cn("overflow-visible shrink-0", colorClass, className)}>
    <circle cx="16" cy="16" r="14" fill="white" stroke="currentColor" strokeWidth={strokeWidth} className="fill-white dark:fill-slate-800" />
    {isDouble && <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth={1.5} />}
    {children}
  </svg>
);

// Start Events
export const StartEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-emerald-500" strokeWidth={1.5} className={className} />
);

export const MessageStartEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-emerald-500" strokeWidth={1.5} className={className}>
    <path d="M9 11 H23 V21 H9 Z M9 11 L16 16 L23 11" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </BpmnEventBase>
);

export const TimerStartEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-emerald-500" strokeWidth={1.5} className={className}>
    <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1 1.5" />
    <path d="M16 11 V16 L19 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </BpmnEventBase>
);

export const ConditionalStartEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-emerald-500" strokeWidth={1.5} className={className}>
    <rect x="10" y="10" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M12 13 H20 M12 16 H20 M12 19 H17" stroke="currentColor" strokeWidth="1" />
  </BpmnEventBase>
);

export const SignalStartEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-emerald-500" strokeWidth={1.5} className={className}>
    <polygon points="16,9 23,21 9,21" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </BpmnEventBase>
);

// Intermediate Events
export const IntermediateEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-amber-500" strokeWidth={1.5} isDouble={true} className={className} />
);

export const TimerIntermediateEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-amber-500" strokeWidth={1.5} isDouble={true} className={className}>
    <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M16 12 V16 L18.5 17.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </BpmnEventBase>
);

export const MessageIntermediateCatchIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-amber-500" strokeWidth={1.5} isDouble={true} className={className}>
    <path d="M10 12 H22 V20 H10 Z M10 12 L16 16 L22 12" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </BpmnEventBase>
);

export const MessageIntermediateThrowIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-amber-500" strokeWidth={1.5} isDouble={true} className={className}>
    <path d="M10 12 H22 V20 H10 Z" fill="currentColor" />
    <path d="M10 12 L16 16 L22 12" fill="none" stroke="white" strokeWidth="1.2" />
  </BpmnEventBase>
);

// End Events
export const EndEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3.5} className={className} />
);

export const MessageEndEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3} className={className}>
    <path d="M10 12 H22 V20 H10 Z" fill="currentColor" />
    <path d="M10 12 L16 16 L22 12" fill="none" stroke="white" strokeWidth="1.2" />
  </BpmnEventBase>
);

export const ErrorEndEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3} className={className}>
    <path d="M11 21 L14 11 L18 19 L21 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </BpmnEventBase>
);

export const TerminateEndEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3} className={className}>
    <circle cx="16" cy="16" r="8" fill="currentColor" />
  </BpmnEventBase>
);

export const SignalEndEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3} className={className}>
    <polygon points="16,9 23,21 9,21" fill="currentColor" />
  </BpmnEventBase>
);

export const EscalationEndEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3} className={className}>
    <path d="M16 9 L23 21 L16 18 L9 21 Z" fill="currentColor" />
  </BpmnEventBase>
);

export const CompensationEndEventIcon = ({ className }: { className?: string }) => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3} className={className}>
    <path d="M9 16 L16 11 V21 Z M16 16 L23 11 V21 Z" fill="currentColor" />
  </BpmnEventBase>
);

// Task Base
export const BpmnTaskBase = ({ 
  children, 
  className, 
  isCallActivity = false 
}: { 
  children?: React.ReactNode; 
  className?: string; 
  isCallActivity?: boolean;
}) => (
  <svg width="56" height="38" viewBox="0 0 56 38" className={cn("overflow-visible shrink-0 text-slate-700 dark:text-slate-200", className)}>
    <rect 
      x="2" y="2" width="52" height="34" rx="5" 
      fill="white" 
      stroke="currentColor" 
      strokeWidth={isCallActivity ? "3" : "1.5"} 
      className="fill-white dark:fill-slate-800"
    />
    {children}
  </svg>
);

// Tasks
export const GenericTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className} />
);

export const UserTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <path d="M7 10 c0 -1.8 1.2 -3 3 -3 s3 1.2 3 3 s-1.2 3 -3 3 s-3 -1.2 -3 -3 Z M5 17 c0 -2.5 2 -3.8 5 -3.8 s5 1.3 5 3.8 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </BpmnTaskBase>
);

export const ManualTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <path d="M6 14 v-4 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.5 M7.6 10 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.5 M9.2 10.3 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.2 M10.8 11 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.5 c0 1.5-1.5 2.8-3 2.8 h-1 c-.8 0-1.5-.5-1.8-1.2 l-.8-1.2" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </BpmnTaskBase>
);

export const ServiceTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M10 6.5 v1.5 M10 13.5 v1.5 M5.5 11 h1.5 M13 11 h1.5 M6.8 7.8 l1.1 1.1 M12.1 13.1 l1.1 1.1 M6.8 14.2 l1.1 -1.1 M12.1 8.9 l1.1 -1.1" stroke="currentColor" strokeWidth="1" />
  </BpmnTaskBase>
);

export const SendTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <rect x="5" y="7" width="11" height="8" rx="0.5" fill="currentColor" />
    <path d="M5 7 L10.5 11 L16 7" fill="none" stroke="white" strokeWidth="1" />
  </BpmnTaskBase>
);

export const ReceiveTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <rect x="5" y="7" width="11" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 7 L10.5 11 L16 7" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </BpmnTaskBase>
);

export const BusinessRuleTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <rect x="5" y="7" width="11" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 10 h11 M5 13 h11 M8.5 7 v8" stroke="currentColor" strokeWidth="1" />
  </BpmnTaskBase>
);

export const ScriptTaskIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <path d="M6 7 h8 a1.5 1.5 0 0 1 1.5 1.5 v5 a1.5 1.5 0 0 1 -1.5 1.5 h-8 a1.5 1.5 0 0 1 -1.5 -1.5 v-5 a1.5 1.5 0 0 1 1.5 -1.5 M7 9.5 h6 M7 11.5 h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </BpmnTaskBase>
);

export const CallActivityIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className} isCallActivity={true} />
);

export const SubProcessIcon = ({ className }: { className?: string }) => (
  <BpmnTaskBase className={className}>
    <rect x="23" y="28" width="10" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d="M25 32 H31 M28 29.5 V34.5" stroke="currentColor" strokeWidth="1" />
  </BpmnTaskBase>
);

// Participant, Lanes & Flows
export const PoolIcon = ({ className }: { className?: string }) => (
  <svg width="48" height="32" viewBox="0 0 48 32" className={cn("overflow-visible shrink-0 text-indigo-500", className)}>
    <rect x="2" y="2" width="44" height="28" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5" className="fill-white dark:fill-slate-800" />
    <line x1="12" y1="2" x2="12" y2="30" stroke="currentColor" strokeWidth="1.5" />
    <text x="7" y="18" fontSize="8" fill="currentColor" transform="rotate(-90 7 18)" textAnchor="middle" fontWeight="bold">Pool</text>
  </svg>
);

export const LaneIcon = ({ className }: { className?: string }) => (
  <svg width="48" height="32" viewBox="0 0 48 32" className={cn("overflow-visible shrink-0 text-indigo-400", className)}>
    <rect x="2" y="2" width="44" height="28" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5" className="fill-white dark:fill-slate-800" />
    <line x1="10" y1="2" x2="10" y2="30" stroke="currentColor" strokeWidth="1.2" />
    <line x1="10" y1="16" x2="46" y2="16" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
  </svg>
);

export const SequenceFlowIcon = ({ className }: { className?: string }) => (
  <svg width="40" height="20" viewBox="0 0 40 20" className={cn("overflow-visible shrink-0 text-slate-600 dark:text-slate-300", className)}>
    <line x1="2" y1="10" x2="32" y2="10" stroke="currentColor" strokeWidth="2" />
    <polygon points="32,6 38,10 32,14" fill="currentColor" />
  </svg>
);

export const MessageFlowIcon = ({ className }: { className?: string }) => (
  <svg width="44" height="20" viewBox="0 0 44 20" className={cn("overflow-visible shrink-0 text-slate-400", className)}>
    <circle cx="5" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <line x1="8" y1="10" x2="36" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
    <polygon points="36,7 42,10 36,13" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const DataObjectIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="32" viewBox="0 0 24 32" className={cn("overflow-visible shrink-0 text-indigo-400", className)}>
    <path d="M2 2 H15 L22 9 V30 H2 Z" fill="white" stroke="currentColor" strokeWidth="1.5" className="fill-white dark:fill-slate-800" />
    <path d="M15 2 V9 H22" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const DataStoreIcon = ({ className }: { className?: string }) => (
  <svg width="30" height="32" viewBox="0 0 30 32" className={cn("overflow-visible shrink-0 text-indigo-500", className)}>
    <path d="M3 7 Q3 3 15 3 Q27 3 27 7 V25 Q27 29 15 29 Q3 29 3 25 Z" fill="white" stroke="currentColor" strokeWidth="1.5" className="fill-white dark:fill-slate-800" />
    <path d="M3 7 Q3 11 15 11 Q27 11 27 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 15 Q3 19 15 19 Q27 19 27 15" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export const AnnotationIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="30" viewBox="0 0 20 30" className={cn("overflow-visible shrink-0 text-slate-400", className)}>
    <path d="M18 4 H4 V26 H18" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
