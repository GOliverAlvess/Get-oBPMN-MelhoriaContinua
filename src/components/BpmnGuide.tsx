import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Info, 
  Circle, 
  Square, 
  ArrowRight, 
  MessageSquare, 
  Layout,
  Layers,
  HelpCircle,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface BpmnGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BpmnItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

// Custom BPMN Symbol Components for better accuracy
const BpmnDiamond = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" className={cn("overflow-visible", className)}>
    <path 
      d="M16 2 L30 16 L16 30 L2 16 Z" 
      fill="white" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinejoin="round"
    />
    {children}
  </svg>
);

const ExclusiveGatewayIcon = () => (
  <BpmnDiamond className="text-amber-600">
    <path d="M11 11 L21 21 M21 11 L11 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </BpmnDiamond>
);

const ParallelGatewayIcon = () => (
  <BpmnDiamond className="text-amber-600">
    <path d="M16 9 V23 M9 16 H23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </BpmnDiamond>
);

const InclusiveGatewayIcon = () => (
  <BpmnDiamond className="text-amber-600">
    <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
  </BpmnDiamond>
);

const EventGatewayIcon = () => (
  <BpmnDiamond className="text-amber-600">
    <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="1" fill="none" />
    <circle cx="16" cy="16" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
    <polygon points="16,11.5 19,13.5 19,16.5 16,18.5 13,16.5 13,13.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
  </BpmnDiamond>
);

const MessageIcon = ({ className }: { className?: string }) => (
  <path d="M8 10 H24 V22 H8 Z M8 10 L16 16 L24 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} />
);

const ErrorIcon = ({ className }: { className?: string }) => (
  <path d="M10 22 L14 10 L18 20 L22 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} />
);

const SignalIcon = ({ className }: { className?: string }) => (
  <polygon points="16,8 24,22 8,22" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} />
);

const EscalationIcon = ({ className }: { className?: string }) => (
  <path d="M16 8 L24 22 L16 18 L8 22 Z" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} />
);

const CompensationIcon = ({ className }: { className?: string }) => (
  <path d="M8 16 L16 10 V22 Z M16 16 L24 10 V22 Z" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} />
);

const BpmnEventBase = ({ children, colorClass, strokeWidth = 1.5 }: { children?: React.ReactNode; colorClass: string; strokeWidth?: number }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" className={cn("overflow-visible", colorClass)}>
    <circle cx="16" cy="16" r="14" fill="white" stroke="currentColor" strokeWidth={strokeWidth} />
    {children}
  </svg>
);

const MessageEndEventIcon = () => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3}>
    <g transform="translate(0, 1)">
      <MessageIcon className="scale-75 origin-center" />
    </g>
  </BpmnEventBase>
);

const ErrorEndEventIcon = () => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3}>
    <ErrorIcon className="scale-75 origin-center" />
  </BpmnEventBase>
);

const TerminateEndEventIcon = () => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3}>
    <circle cx="16" cy="16" r="8" fill="currentColor" />
  </BpmnEventBase>
);

const SignalEndEventIcon = () => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3}>
    <SignalIcon className="scale-75 origin-center" />
  </BpmnEventBase>
);

const CompensationEndEventIcon = () => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3}>
    <CompensationIcon className="scale-75 origin-center" />
  </BpmnEventBase>
);

const EscalationEndEventIcon = () => (
  <BpmnEventBase colorClass="text-rose-500" strokeWidth={3}>
    <EscalationIcon className="scale-75 origin-center" />
  </BpmnEventBase>
);

const IntermediateEventIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" className="text-amber-500 overflow-visible">
    <circle cx="16" cy="16" r="14" fill="white" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BpmnTaskBase = ({ children, className, isCallActivity = false }: { children?: React.ReactNode; className?: string; isCallActivity?: boolean }) => (
  <svg width="60" height="40" viewBox="0 0 60 40" className={cn("overflow-visible", className)}>
    <rect 
      x="2" y="2" width="56" height="36" rx="5" 
      fill="white" 
      stroke="currentColor" 
      strokeWidth={isCallActivity ? "3.5" : "1.5"} 
    />
    {children}
  </svg>
);

const UserTaskIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <path d="M7 10 c0 -1.8 1.2 -3 3 -3 s3 1.2 3 3 s-1.2 3 -3 3 s-3 -1.2 -3 -3 Z M5 17 c0 -2.5 2 -3.8 5 -3.8 s5 1.3 5 3.8 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </BpmnTaskBase>
);

const ServiceTaskIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M10 6.5 v1.5 M10 13.5 v1.5 M5.5 11 h1.5 M13 11 h1.5 M6.8 7.8 l1.1 1.1 M12.1 13.1 l1.1 1.1 M6.8 14.2 l1.1 -1.1 M12.1 8.9 l1.1 -1.1" stroke="currentColor" strokeWidth="1" />
  </BpmnTaskBase>
);

const SendTaskIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <rect x="5" y="7" width="11" height="8" rx="0.5" fill="currentColor" />
    <path d="M5 7 L10.5 11 L16 7" fill="none" stroke="white" strokeWidth="1" />
  </BpmnTaskBase>
);

const ReceiveTaskIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <rect x="5" y="7" width="11" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 7 L10.5 11 L16 7" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </BpmnTaskBase>
);

const ManualTaskIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <path d="M6 14 v-4 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.5 M7.6 10 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.5 M9.2 10.3 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.2 M10.8 11 c0-.5.4-.8.8-.8 s.8.3.8.8 v2.5 c0 1.5-1.5 2.8-3 2.8 h-1 c-.8 0-1.5-.5-1.8-1.2 l-.8-1.2" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </BpmnTaskBase>
);

const BusinessRuleTaskIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <rect x="5" y="7" width="11" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 10 h11 M5 13 h11 M8.5 7 v8" stroke="currentColor" strokeWidth="1" />
  </BpmnTaskBase>
);

const ScriptTaskIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <path d="M6 7 h8 a1.5 1.5 0 0 1 1.5 1.5 v5 a1.5 1.5 0 0 1 -1.5 1.5 h-8 a1.5 1.5 0 0 1 -1.5 -1.5 v-5 a1.5 1.5 0 0 1 1.5 -1.5 M7 9.5 h6 M7 11.5 h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </BpmnTaskBase>
);

const CallActivityIcon = () => (
  <BpmnTaskBase className="text-slate-700" isCallActivity={true} />
);

const TransactionIcon = () => (
  <svg width="60" height="40" viewBox="0 0 60 40" className="text-slate-700 overflow-visible">
    <rect x="2" y="2" width="56" height="36" rx="5" fill="white" stroke="currentColor" strokeWidth="1.5" />
    <rect x="5" y="5" width="50" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const EventSubProcessIcon = () => (
  <svg width="60" height="40" viewBox="0 0 60 40" className="text-slate-700 overflow-visible">
    <rect x="2" y="2" width="56" height="36" rx="5" fill="white" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
  </svg>
);

const AdHocSubProcessIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <path d="M25 32 Q30 28 35 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </BpmnTaskBase>
);

const DataStoreIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" className="text-indigo-500 overflow-visible">
    <path d="M4 8 Q4 4 16 4 Q28 4 28 8 V24 Q28 28 16 28 Q4 28 4 24 Z" fill="white" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 8 Q4 12 16 12 Q28 12 28 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 16 Q4 20 16 20 Q28 20 28 16" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const DataObjectIcon = () => (
  <svg width="24" height="32" viewBox="0 0 24 32" className="text-indigo-400 overflow-visible">
    <path d="M2 2 H16 L22 8 V30 H2 Z" fill="white" stroke="currentColor" strokeWidth="1.5" />
    <path d="M16 2 V8 H22" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const GroupIcon = () => (
  <svg width="40" height="32" viewBox="0 0 40 32" className="text-slate-300 overflow-visible">
    <rect x="2" y="2" width="36" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 4" />
  </svg>
);

const AnnotationIcon = () => (
  <svg width="20" height="32" viewBox="0 0 20 32" className="text-slate-400 overflow-visible">
    <path d="M18 4 H4 V28 H18" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const SubProcessIcon = () => (
  <BpmnTaskBase className="text-slate-700">
    <rect x="25" y="30" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d="M27 35 H33 M30 32 V38" stroke="currentColor" strokeWidth="1" />
  </BpmnTaskBase>
);

const StartEventIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" className="text-emerald-500 overflow-visible">
    <circle cx="16" cy="16" r="14" fill="white" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const EndEventIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" className="text-rose-500 overflow-visible">
    <circle cx="16" cy="16" r="13" fill="white" stroke="currentColor" strokeWidth="3.5" />
  </svg>
);

const BPMN_GUIDE_DATA: BpmnItem[] = [
  // 1. Eventos
  {
    id: 'start-event',
    name: 'Evento de Início',
    description: 'Marca o ponto onde um processo se inicia. Exemplo: chegada de um e-mail ou pedido.',
    icon: <StartEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'end-event',
    name: 'Evento de Fim',
    description: 'Indica o término de um caminho do processo ou do processo completo.',
    icon: <EndEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'intermediate-event',
    name: 'Evento Intermediário',
    description: 'Ocorre durante o fluxo, indicando uma espera ou evento que altera o andamento.',
    icon: <IntermediateEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'message-end-event',
    name: 'Evento de Fim de Mensagem',
    description: 'Finaliza o processo enviando uma mensagem ou notificação externa.',
    icon: <MessageEndEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'error-end-event',
    name: 'Evento de Fim de Erro',
    description: 'Indica um término devido a um erro, disparando um fluxo de exceção.',
    icon: <ErrorEndEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'terminate-end-event',
    name: 'Evento de Fim Terminativo',
    description: 'Encerra imediatamente todas as atividades de todas as raias no processo.',
    icon: <TerminateEndEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'signal-end-event',
    name: 'Evento de Fim de Sinal',
    description: 'Finaliza o processo disparando um sinal que pode ser capturado por outros processos.',
    icon: <SignalEndEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'compensation-end-event',
    name: 'Evento de Fim de Compensação',
    description: 'Finaliza o processo disparando a reversão (compensação) de atividades anteriores.',
    icon: <CompensationEndEventIcon />,
    category: 'Eventos'
  },
  {
    id: 'escalation-end-event',
    name: 'Evento de Fim de Escalação',
    description: 'Indica que o processo terminou e escalou um problema ou situação para um nível superior.',
    icon: <EscalationEndEventIcon />,
    category: 'Eventos'
  },
  // 2. Tipos de Tarefas (Tasks)
  {
    id: 'user-task',
    name: 'Tarefa do Usuário',
    description: 'Uma tarefa que requer interação humana no sistema. Exemplo: preencher um formulário ou aprovar uma solicitação.',
    icon: <UserTaskIcon />,
    category: 'Tipos de Tarefas (Tasks)'
  },
  {
    id: 'service-task',
    name: 'Tarefa Automática',
    description: 'Executada automaticamente por um sistema ou serviço de software, sem intervenção humana.',
    icon: <ServiceTaskIcon />,
    category: 'Tipos de Tarefas (Tasks)'
  },
  {
    id: 'send-task',
    name: 'Tarefa de Envio',
    description: 'Envia uma mensagem ou dados para outro participante ou sistema externo.',
    icon: <SendTaskIcon />,
    category: 'Tipos de Tarefas (Tasks)'
  },
  {
    id: 'receive-task',
    name: 'Tarefa de Recebimento',
    description: 'O processo fica aguardando o recebimento de uma mensagem ou sinal externo para continuar.',
    icon: <ReceiveTaskIcon />,
    category: 'Tipos de Tarefas (Tasks)'
  },
  {
    id: 'manual-task',
    name: 'Tarefa Manual',
    description: 'Atividade realizada fora do sistema, de forma física ou offline. Exemplo: carregar um caminhão.',
    icon: <ManualTaskIcon />,
    category: 'Tipos de Tarefas (Tasks)'
  },
  {
    id: 'business-rule-task',
    name: 'Regra de Negócio',
    description: 'Avalia condições ou realiza cálculos baseados em regras pré-definidas para decidir o próximo passo.',
    icon: <BusinessRuleTaskIcon />,
    category: 'Tipos de Tarefas (Tasks)'
  },
  {
    id: 'script-task',
    name: 'Tarefa de Script',
    description: 'Executa uma lógica de programação personalizada diretamente no motor de processos.',
    icon: <ScriptTaskIcon />,
    category: 'Tipos de Tarefas (Tasks)'
  },
  {
    id: 'call-activity',
    name: 'Chamada de Processo',
    description: 'Invoca um outro processo independente que já foi mapeado separadamente.',
    icon: <CallActivityIcon />,
    category: 'Subprocessos e Contêineres'
  },
  // 4. Subprocessos e Contêineres
  {
    id: 'sub-process-box',
    name: 'Subprocesso',
    description: 'Um grupo de tarefas que representam uma parte detalhada do processo principal.',
    icon: <SubProcessIcon />,
    category: 'Subprocessos e Contêineres'
  },
  {
    id: 'transaction-subprocess',
    name: 'Transação',
    description: 'Subprocesso com garantia de que todas as tarefas ocorrem com sucesso ou nenhuma ocorre.',
    icon: <TransactionIcon />,
    category: 'Subprocessos e Contêineres'
  },
  {
    id: 'event-subprocess',
    name: 'Subprocesso por Evento',
    description: 'Iniciado apenas quando um evento específico ocorre dentro do processo pai.',
    icon: <EventSubProcessIcon />,
    category: 'Subprocessos e Contêineres'
  },
  {
    id: 'ad-hoc-subprocess',
    name: 'Subprocesso Ad-hoc',
    description: 'Contém atividades sem uma ordem pré-definida, executadas conforme a necessidade.',
    icon: <AdHocSubProcessIcon />,
    category: 'Subprocessos e Contêineres'
  },
  // 3. Gateways
  {
    id: 'exclusive-gateway',
    name: 'Gateway Exclusivo (XOR)',
    description: 'Ponto de decisão onde apenas UM dos caminhos de saída será seguido.',
    icon: <ExclusiveGatewayIcon />,
    category: 'Gateways (Decisões)'
  },
  {
    id: 'parallel-gateway',
    name: 'Gateway Paralelo (AND)',
    description: 'Ponto onde múltiplos caminhos são seguidos simultaneamente (fluxo divide ou une).',
    icon: <ParallelGatewayIcon />,
    category: 'Gateways (Decisões)'
  },
  {
    id: 'inclusive-gateway',
    name: 'Gateway Inclusivo (OR)',
    description: 'Um ou mais caminhos podem ser seguidos, baseados em condições avaliadas.',
    icon: <InclusiveGatewayIcon />,
    category: 'Gateways (Decisões)'
  },
  {
    id: 'event-gateway',
    name: 'Gateway por Evento',
    description: 'Ponto de decisão baseado na ocorrência de eventos externos subsequentes.',
    icon: <EventGatewayIcon />,
    category: 'Gateways (Decisões)'
  },
  // 4. Fluxos
  {
    id: 'sequence-flow',
    name: 'Fluxo de Sequência',
    description: 'Define a ordem em que as atividades são executadas no processo.',
    icon: <ArrowRight size={24} className="text-slate-600" />,
    category: 'Fluxos'
  },
  {
    id: 'message-flow',
    name: 'Fluxo de Mensagem',
    description: 'Comunicação entre diferentes participantes ou empresas (entre Pools).',
    icon: <MessageSquare size={20} className="text-slate-400" strokeDasharray="4 4" />,
    category: 'Fluxos'
  },
  // 5. Pools e Raias
  {
    id: 'pool',
    name: 'Pool',
    description: 'Representa uma entidade organizacional (ex: Empresa, Departamento, Sistema).',
    icon: <Layout size={24} className="text-indigo-400" />,
    category: 'Pools e Raias'
  },
  {
    id: 'lane',
    name: 'Raia (Lane)',
    description: 'Divide responsabilidades individuais ou grupos dentro de uma mesma Pool.',
    icon: <Layers size={21} className="text-indigo-300" />,
    category: 'Pools e Raias'
  },
  // 6. Artefatos (Objetos auxiliares)
  {
    id: 'data-store',
    name: 'Banco de Dados',
    description: 'Armazenamento persistente de informações que permanecem após o fim do processo.',
    icon: <DataStoreIcon />,
    category: 'Artefatos (Objetos auxiliares)'
  },
  {
    id: 'data-object',
    name: 'Objeto de Dados',
    description: 'Representa informações (físicas ou digitais) que entram ou saem das atividades.',
    icon: <DataObjectIcon />,
    category: 'Artefatos (Objetos auxiliares)'
  },
  {
    id: 'group-artifact',
    name: 'Grupo',
    description: 'Agrupamento visual de elementos para fins de documentação ou organização.',
    icon: <GroupIcon />,
    category: 'Artefatos (Objetos auxiliares)'
  },
  {
    id: 'text-annotation',
    name: 'Anotação de Texto',
    description: 'Comentário ou nota explicativa para adicionar contexto a um elemento do fluxo.',
    icon: <AnnotationIcon />,
    category: 'Artefatos (Objetos auxiliares)'
  }
];

export default function BpmnGuide({ isOpen, onClose }: BpmnGuideProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = BPMN_GUIDE_DATA.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(BPMN_GUIDE_DATA.map(item => item.category)));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />

          {/* Guide Sidebar */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[450px] bg-white dark:bg-[#111827] shadow-2xl z-[101] flex flex-col font-sans transition-colors"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 rotate-6">
                  <Info size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">Guia BPMN 2.0</h2>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">Manual de Referência Rápida</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:border-rose-100 dark:hover:border-rose-900 rounded-xl transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar símbolo ou definição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {categories.map(category => {
                const categoryItems = filteredItems.filter(item => item.category === category);
                if (categoryItems.length === 0) return null;

                return (
                  <div key={category} className="space-y-4">
                    <h3 className="text-xs font-black text-indigo-500 dark:text-blue-400 uppercase tracking-[0.2em] flex items-center gap-3">
                      <div className="h-px bg-indigo-100 dark:bg-slate-800 flex-1" />
                      {category}
                      <div className="h-px bg-indigo-100 dark:bg-slate-800 flex-1" />
                    </h3>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {categoryItems.map(item => (
                        <motion.div 
                          layout
                          key={item.id}
                          className="group p-4 bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-200 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-default"
                        >
                          <div className="flex gap-4">
                            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 group-hover:bg-indigo-50 dark:group-hover:bg-blue-900/20 group-hover:border-indigo-100 dark:group-hover:border-blue-900/30 transition-all">
                              {item.icon}
                            </div>
                            <div className="flex-1 space-y-1">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-blue-400 transition-colors">
                                {item.name}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                  <HelpCircle size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-600">Nenhum símbolo encontrado</p>
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="mt-4 text-xs font-black text-indigo-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                  >
                    Limpar Busca
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="p-2 bg-indigo-50 dark:bg-blue-900/20 text-indigo-600 dark:text-blue-400 rounded-lg">
                  <Info size={16} />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Este guia utiliza padrões universais do BPMN 2.0 (Business Process Model and Notation).
                  Consulte a documentação técnica para casos complexos.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        [data-theme="dark"] .BpmnDiamond path,
        [data-theme="dark"] circle,
        [data-theme="dark"] rect,
        [data-theme="dark"] polygon,
        [data-theme="dark"] path {
          /* Targeted overrides for the guide icons */
        }
        
        /* Guide icons use white fill by default in the components above */
        [data-theme="dark"] .BpmnDiamond path:first-child,
        [data-theme="dark"] circle[fill="white"],
        [data-theme="dark"] rect[fill="white"],
        [data-theme="dark"] polygon[fill="white"],
        [data-theme="dark"] path[fill="white"] {
          fill: #1e293b !important;
        }
      `}} />
    </AnimatePresence>
  );
}
