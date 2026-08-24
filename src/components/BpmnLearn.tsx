import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Compass, 
  Target, 
  Layers, 
  GitBranch, 
  Clock, 
  ShieldCheck, 
  Lightbulb, 
  ChevronRight,
  BookOpen,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  ExclusiveGatewayIcon,
  ParallelGatewayIcon,
  InclusiveGatewayIcon,
  EventGatewayIcon,
  StartEventIcon,
  TimerStartEventIcon,
  MessageStartEventIcon,
  ConditionalStartEventIcon,
  SignalStartEventIcon,
  IntermediateEventIcon,
  TimerIntermediateEventIcon,
  MessageIntermediateCatchIcon,
  EndEventIcon,
  MessageEndEventIcon,
  ErrorEndEventIcon,
  TerminateEndEventIcon,
  GenericTaskIcon,
  UserTaskIcon,
  ManualTaskIcon,
  ServiceTaskIcon,
  SendTaskIcon,
  ReceiveTaskIcon,
  BusinessRuleTaskIcon,
  ScriptTaskIcon,
  CallActivityIcon,
  SubProcessIcon,
  PoolIcon,
  LaneIcon,
  SequenceFlowIcon,
  MessageFlowIcon,
  DataStoreIcon,
  DataObjectIcon,
  AnnotationIcon
} from './bpmnSymbols';

interface BpmnLearnProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  initialTargetElement?: string;
}

export interface ScenarioItem {
  id: string;
  question: string;
  recommendation: string;
  category: string;
  icon: React.ReactNode;
  summary: string;
  detail: string;
  rule: string;
  example: string;
}

export default function BpmnLearn({ 
  isOpen, 
  onClose,
  initialTab = 'start',
  initialTargetElement
}: BpmnLearnProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Sync initial tab when opened with a target
  React.useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (initialTargetElement) {
        setSearchTerm('');
        setExpandedSection(initialTargetElement);
      }
    }
  }, [isOpen, initialTab, initialTargetElement]);

  const scenarios: ScenarioItem[] = [
    {
      id: 'sc-start',
      question: 'Quero representar onde o processo começa',
      recommendation: 'Evento de Início (Start Event)',
      category: 'Início',
      icon: <StartEventIcon />,
      summary: 'Indica o ponto de entrada ou disparo do processo (ex: recebimento de pedido, solicitação de frete).',
      detail: 'Todo fluxo executável deve ter ao menos um Evento de Início. Ele não possui fluxos de entrada, apenas de saída.',
      rule: 'Todo fluxo começa em um círculo de borda fina.',
      example: 'Exemplo: "Chegada do caminhão na filial" ou "Pedido de cotação emitido pelo cliente".'
    },
    {
      id: 'sc-task',
      question: 'Quero representar uma atividade executada',
      recommendation: 'Task / Tarefa (User, Manual, Service)',
      category: 'Atividades',
      icon: <UserTaskIcon />,
      summary: 'Representa um trabalho ou etapa que transforma entradas em saídas.',
      detail: 'Escolha User Task (ação humana em sistema), Manual Task (ação física offline) ou Service Task (automação do sistema).',
      rule: 'Use sempre verbo no infinitivo + objeto (Ex: Conferir nota fiscal, Carregar veículo).',
      example: 'Exemplo: "Conferir lacre do contêiner" ou "Validar dados cadastrais no ERP".'
    },
    {
      id: 'sc-lane',
      question: 'Quero representar quem executa determinada atividade',
      recommendation: 'Lane (Raia de Responsabilidade)',
      category: 'Participantes',
      icon: <LaneIcon />,
      summary: 'Delimita a responsabilidade de uma área, cargo ou sistema dentro da mesma empresa/organização.',
      detail: 'As Lanes dividem uma Pool horizontal ou verticalmente (ex: Expedição, Financeiro, SAC, Sistema).',
      rule: 'Atividades dentro da mesma Lane são de responsabilidade daquele mesmo departamento.',
      example: 'Exemplo: Raia "Recebimento", Raia "Conferência Física", Raia "Faturamento".'
    },
    {
      id: 'sc-xor',
      question: 'Preciso tomar uma decisão onde apenas UM caminho poderá acontecer',
      recommendation: 'Gateway Exclusivo — XOR',
      category: 'Decisões',
      icon: <ExclusiveGatewayIcon />,
      summary: 'Ponto de bifurcação onde as condições são mutuamente excludentes. Apenas uma rota será seguida.',
      detail: 'Avalia uma pergunta ou condição e direciona para uma única saída (ex: Aprovado vs Reprovado, Avariado vs Íntegro).',
      rule: 'XOR = Escolha de apenas UM caminho.',
      example: 'Exemplo: "Mercadoria avariada?" Se SIM ➔ Abrir Ocorrência; Se NÃO ➔ Liberar Expedição.'
    },
    {
      id: 'sc-and',
      question: 'Preciso que TODOS os caminhos sejam executados simultaneamente',
      recommendation: 'Gateway Paralelo — AND',
      category: 'Decisões',
      icon: <ParallelGatewayIcon />,
      summary: 'Divide o fluxo para que todas as ramificações ocorram ao mesmo tempo, sem condições de escolha.',
      detail: 'Também é usado para sincronizar (juntar) múltiplos caminhos antes de avançar para a próxima etapa.',
      rule: 'AND = TODOS os caminhos sem exceção (não há condição de teste).',
      example: 'Exemplo: "Emitir CT-e" E "Conferir Carga Física" acontecendo simultaneamente.'
    },
    {
      id: 'sc-or',
      question: 'Preciso que UM OU MAIS caminhos possam acontecer',
      recommendation: 'Gateway Inclusivo — OR',
      category: 'Decisões',
      icon: <InclusiveGatewayIcon />,
      summary: 'Permite que uma, duas ou todas as opções sejam executadas, dependendo das condições satisfeitas.',
      detail: 'Cada rota de saída possui sua própria condição independente. Se mais de uma for verdadeira, múltiplos fluxos ocorrem.',
      rule: 'OR = UM OU MAIS caminhos possíveis.',
      example: 'Exemplo: Tratativas de sinistro: "Notificar Seguradora" e/ou "Acionar Gerenciamento de Risco" e/ou "Comunicar Cliente".'
    },
    {
      id: 'sc-timer',
      question: 'Preciso aguardar determinado prazo, horário ou período',
      recommendation: 'Evento Timer (Temporizador)',
      category: 'Eventos',
      icon: <TimerIntermediateEventIcon />,
      summary: 'Pausa a execução do processo até que uma data específica, duração ou ciclo seja atingido.',
      detail: 'Pode ser usado como Evento Intermediário de Espera (pausa no fluxo) ou Evento de Borda (limite de SLA em uma tarefa).',
      rule: 'Timer indica espera temporizada ou vencimento de prazo.',
      example: 'Exemplo: "Aguardar 24h para retorno da cotação" ou "Disparar cobrança todo dia 5".'
    },
    {
      id: 'sc-msg',
      question: 'Preciso representar envio ou recebimento de comunicação',
      recommendation: 'Evento de Mensagem / Tarefa de Envio e Recebimento',
      category: 'Eventos',
      icon: <MessageIntermediateCatchIcon />,
      summary: 'Indica a troca de informações entre participantes externos (e-mail, webhook, EDI, aviso do cliente).',
      detail: 'Use Tarefa de Envio/Recebimento ou Evento de Mensagem quando o fluxo depender de uma comunicação explícita.',
      rule: 'Mensagem conecta dados entre diferentes participantes.',
      example: 'Exemplo: "Receber comprovante de entrega do motorista via app" ou "Enviar e-mail de rastreamento ao cliente".'
    },
    {
      id: 'sc-pool',
      question: 'Preciso representar interação entre participantes/empresas independentes',
      recommendation: 'Pool + Message Flow (Fluxo de Mensagem)',
      category: 'Participantes',
      icon: <MessageFlowIcon />,
      summary: 'Utilize Pools distintas para entidades autônomas (ex: Transportadora vs Embarcador vs Cliente final).',
      detail: 'A comunicação entre Pools é feita exclusivamente via Message Flow (linha tracejada com envelope).',
      rule: 'Sequence Flow NUNCA cruza limites de Pools; use Message Flow.',
      example: 'Exemplo: Pool "Embarcador" enviando solicitação para Pool "Operador Logístico".'
    },
    {
      id: 'sc-end',
      question: 'Quero representar onde o processo termina',
      recommendation: 'Evento de Fim (End Event)',
      category: 'Fim',
      icon: <EndEventIcon />,
      summary: 'Indica a conclusão de um ramo ou o encerramento do processo.',
      detail: 'Pode ser Simples (fim normal), Mensagem (fim notificando), Erro (fim com falha) ou Terminativo (interrompe tudo no processo).',
      rule: 'Todo fluxo deve convergir para ao menos um círculo de borda grossa (Fim).',
      example: 'Exemplo: "Mercadoria entregue com sucesso" ou "Processo cancelado por recusa do destinatário".'
    }
  ];

  // Filtered search results across all content
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const term = searchTerm.toLowerCase();
    return scenarios.filter(s => 
      s.question.toLowerCase().includes(term) ||
      s.recommendation.toLowerCase().includes(term) ||
      s.summary.toLowerCase().includes(term) ||
      s.detail.toLowerCase().includes(term) ||
      s.example.toLowerCase().includes(term) ||
      s.category.toLowerCase().includes(term)
    );
  }, [searchTerm, scenarios]);

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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110]"
          />

          {/* Learn Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="fixed inset-4 sm:inset-6 md:inset-8 lg:inset-10 bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl z-[111] flex flex-col font-sans overflow-hidden border border-slate-200/80 dark:border-slate-800 transition-colors"
          >
            {/* Top Bar / Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50 shrink-0">
                  <BookOpen size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                      GIP Flow • BPMN 2.0
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Guia Didático & Prático</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mt-0.5">
                    Aprenda BPMN
                  </h2>
                </div>
              </div>

              {/* Quick Search */}
              <div className="flex items-center gap-3 flex-1 max-w-md ml-auto">
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Buscar elemento ou dúvida... (ex: gateway, prazo, XOR, lane)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <button 
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-900 rounded-xl transition-all shadow-sm shrink-0"
                  title="Fechar manual"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-4 sm:px-6 overflow-x-auto flex items-center gap-1.5 scrollbar-none shrink-0">
              <button 
                onClick={() => { setActiveTab('start'); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-all",
                  activeTab === 'start' && !searchTerm
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Compass size={14} />
                Comece por aqui
              </button>

              <button 
                onClick={() => { setActiveTab('scenarios'); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-all",
                  activeTab === 'scenarios' && !searchTerm
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Target size={14} />
                O que você quer representar?
              </button>

              <button 
                onClick={() => { setActiveTab('gateways'); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-black whitespace-nowrap transition-all",
                  activeTab === 'gateways' && !searchTerm
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : "border-transparent text-slate-500 hover:text-amber-600 dark:hover:text-amber-400"
                )}
              >
                <GitBranch size={14} className="text-amber-500" />
                Decisões (Gateways)
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  Importante
                </span>
              </button>

              <button 
                onClick={() => { setActiveTab('tasks'); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-all",
                  activeTab === 'tasks' && !searchTerm
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <CheckCircle2 size={14} />
                Atividades & Tarefas
              </button>

              <button 
                onClick={() => { setActiveTab('events'); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-all",
                  activeTab === 'events' && !searchTerm
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Clock size={14} />
                Eventos
              </button>

              <button 
                onClick={() => { setActiveTab('participants'); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-all",
                  activeTab === 'participants' && !searchTerm
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Layers size={14} />
                Pool & Lane
              </button>

              <button 
                onClick={() => { setActiveTab('practices'); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-all",
                  activeTab === 'practices' && !searchTerm
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <ShieldCheck size={14} />
                Boas Práticas
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-8 custom-scrollbar bg-slate-50/40 dark:bg-[#0b1120]">

              {/* SEARCH RESULTS VIEW */}
              {searchResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Search size={16} className="text-indigo-500" />
                      Resultados para &quot;{searchTerm}&quot; ({searchResults.length})
                    </h3>
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      Limpar busca
                    </button>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {searchResults.map((item) => (
                        <div 
                          key={item.id}
                          className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                              {item.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-md">
                                {item.category}
                              </span>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                                {item.question}
                              </h4>
                              <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                ➔ {item.recommendation}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                            {item.summary}
                          </p>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">💡 {item.rule}</p>
                            <p className="italic">{item.example}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <HelpCircle size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum resultado encontrado para &quot;{searchTerm}&quot;</p>
                      <p className="text-xs text-slate-400 mt-1">Tente pesquisar por &quot;gateway&quot;, &quot;decisão&quot;, &quot;tarefa&quot;, &quot;espera&quot;, &quot;raia&quot; ou &quot;XOR&quot;.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 1: COMECE POR AQUI */}
              {!searchTerm && activeTab === 'start' && (
                <div className="space-y-8">
                  {/* Hero Box */}
                  <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl relative overflow-hidden shadow-xl border border-indigo-500/20">
                    <div className="relative z-10 max-w-3xl space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold">
                        <Sparkles size={14} />
                        Pensando em Processos
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                        Como estruturar qualquer processo em 6 passos simples
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Mapear um processo em BPMN 2.0 não é apenas desenhar caixas e setas. É registrar como o trabalho flui entre pessoas, decisões e sistemas. Comece respondendo às 6 perguntas fundamentais:
                      </p>
                    </div>
                  </div>

                  {/* 6 Core Questions Guide */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center justify-center">1</span>
                        <StartEventIcon />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">Onde o processo começa?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Identifique o <strong>gatilho inicial</strong> que dispara a necessidade do processo (ex: chegada de carga, pedido de compra ou chamado de suporte).
                      </p>
                      <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                        ➔ Use: Evento de Início
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center">2</span>
                        <UserTaskIcon />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">O que acontece?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Liste as <strong>atividades de transformação</strong> executadas por pessoas ou sistemas para produzir o resultado esperado.
                      </p>
                      <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 pt-1">
                        ➔ Use: Tasks / Tarefas
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center justify-center">3</span>
                        <LaneIcon />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">Quem executa?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Organize as atividades por <strong>departamentos, funções ou sistemas</strong> utilizando raias (Lanes) para deixar as responsabilidades evidentes.
                      </p>
                      <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 pt-1">
                        ➔ Use: Raias (Lanes)
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-xs font-black flex items-center justify-center">4</span>
                        <ExclusiveGatewayIcon />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">Existe alguma decisão?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Identifique <strong>bifurcações</strong> onde o fluxo muda conforme condições (somente um caminho, todos os caminhos ou múltiplos caminhos).
                      </p>
                      <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 pt-1">
                        ➔ Use: Gateways (XOR, AND, OR)
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 text-xs font-black flex items-center justify-center">5</span>
                        <TimerIntermediateEventIcon />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">Existe espera ou evento?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        O processo precisa <strong>aguardar um prazo</strong> (Timer), retorno de e-mail do cliente (Mensagem) ou autorização externa?
                      </p>
                      <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 pt-1">
                        ➔ Use: Eventos Intermediários
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center justify-center">6</span>
                        <EndEventIcon />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">Onde o processo termina?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Defina o <strong>resultado conclusivo</strong> entregue pelo fluxo (sucesso, cancelamento, recusa ou erro).
                      </p>
                      <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 pt-1">
                        ➔ Use: Evento de Fim
                      </div>
                    </div>
                  </div>

                  {/* Visual Journey Flow Representation */}
                  <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Lightbulb size={16} className="text-amber-500" />
                      A Anatomia Visual de um Fluxo BPMN
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Observe como os símbolos BPMN reais se encadeiam naturalmente da esquerda para a direita:
                    </p>

                    <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <StartEventIcon />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">1. Início</span>
                      </div>
                      <SequenceFlowIcon />
                      <div className="flex flex-col items-center gap-1.5">
                        <UserTaskIcon />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">2. Atividade</span>
                      </div>
                      <SequenceFlowIcon />
                      <div className="flex flex-col items-center gap-1.5">
                        <ExclusiveGatewayIcon />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">3. Decisão (XOR)</span>
                      </div>
                      <SequenceFlowIcon />
                      <div className="flex flex-col items-center gap-1.5">
                        <TimerIntermediateEventIcon />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">4. Espera / Evento</span>
                      </div>
                      <SequenceFlowIcon />
                      <div className="flex flex-col items-center gap-1.5">
                        <EndEventIcon />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">5. Fim</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: O QUE VOCÊ QUER REPRESENTAR? */}
              {!searchTerm && activeTab === 'scenarios' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      O que você quer representar?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Encontre a situação do seu dia a dia e descubra exatamente qual símbolo BPMN utilizar:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scenarios.map((s) => (
                      <motion.div 
                        layout
                        key={s.id}
                        onClick={() => setExpandedSection(expandedSection === s.id ? null : s.id)}
                        className={cn(
                          "p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md",
                          expandedSection === s.id
                            ? "border-indigo-500 ring-2 ring-indigo-500/20"
                            : "border-slate-200/80 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700"
                        )}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                            {s.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-md">
                              {s.category}
                            </span>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                              {s.question}
                            </h4>
                            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                              ➔ {s.recommendation}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium mt-3">
                          {s.summary}
                        </p>

                        {expandedSection === s.id && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs"
                          >
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                              {s.detail}
                            </p>
                            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100/80 dark:border-indigo-900/40 space-y-1 text-slate-700 dark:text-slate-300">
                              <p className="font-bold text-indigo-950 dark:text-indigo-200">
                                📌 Regra Prática: {s.rule}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                {s.example}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: DECISÕES E CAMINHOS (GATEWAYS) — ÁREA PRIORITÁRIA */}
              {!searchTerm && activeTab === 'gateways' && (
                <div className="space-y-8">
                  {/* Highlight Header */}
                  <div className="p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-amber-200 dark:shadow-none shrink-0">
                        <GitBranch size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-amber-950 dark:text-amber-200">
                          Guia Definitivo de Gateways (Decisões e Conexões)
                        </h3>
                        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 font-medium">
                          O erro mais comum ao migrar de diagramas simples para BPMN é confundir quando usar XOR, AND e OR.
                        </p>
                      </div>
                    </div>

                    {/* Quick Comparison Formula */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-slate-800 text-center space-y-1">
                        <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Gateway Exclusivo</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white">XOR ➔ UM</div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Apenas 1 caminho será seguido</p>
                      </div>

                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 text-center space-y-1">
                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Gateway Paralelo</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white">AND ➔ TODOS</div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Todos os caminhos ao mesmo tempo</p>
                      </div>

                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-slate-800 text-center space-y-1">
                        <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Gateway Inclusivo</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white">OR ➔ 1 OU MAIS</div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Um, vários ou todos os caminhos</p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Gateways Grid */}
                  <div className="space-y-4">
                    {/* 1. Exclusive Gateway (XOR) */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/40">
                          <ExclusiveGatewayIcon />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-slate-900 dark:text-white">Gateway Exclusivo (XOR)</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded">Padrão</span>
                          </div>
                          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            Regra Principal: Apenas UM dos caminhos de saída será escolhido.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Quando utilizar:</span>
                          <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            Quando o fluxo depende de uma pergunta cuja resposta é binária (Sim/Não) ou seleciona apenas uma opção entre várias possíveis.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Exemplo Prático (Logística / Transportes):</span>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            <strong>Mercadoria está avariada?</strong><br />
                            • SIM ➔ Abrir ocorrência de avaria<br />
                            • NÃO ➔ Prosseguir com expedição normal
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                        <span><strong>Evite utilizar quando:</strong> Houver a possibilidade de executar mais de uma atividade simultaneamente.</span>
                      </div>
                    </div>

                    {/* 2. Parallel Gateway (AND) */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/40">
                          <ParallelGatewayIcon />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-slate-900 dark:text-white">Gateway Paralelo (AND)</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded">Simultâneo</span>
                          </div>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Regra Principal: TODOS os caminhos conectados são executados obrigatoriamente.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Quando utilizar:</span>
                          <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            Quando o processo se divide em tarefas independentes que devem acontecer ao mesmo tempo sem depender de nenhuma condição de teste. Também usado para reunir (join) fluxos paralelos.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Exemplo Prático (Operação):</span>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            <strong>Após a chegada do caminhão no pátio:</strong><br />
                            • Caminho A ➔ Conferir documentação fiscal (CT-e/NF-e)<br />
                            • Caminho B ➔ Realizar conferência física da carga
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        <span><strong>Lembre-se:</strong> O Gateway Paralelo NÃO é uma decisão condicional! Ele não avalia respostas, apenas divide ou junta fluxos.</span>
                      </div>
                    </div>

                    {/* 3. Inclusive Gateway (OR) */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/40">
                          <InclusiveGatewayIcon />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-slate-900 dark:text-white">Gateway Inclusivo (OR)</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded">Flexível</span>
                          </div>
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                            Regra Principal: UM OU MAIS caminhos podem ser executados com base nas condições verdadeiras.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Quando utilizar:</span>
                          <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            Quando múltiplas opções podem ser necessárias ao mesmo tempo, mas não necessariamente todas (ex: tratativas de sinistro, serviços opcionais contratados).
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Exemplo Prático (Atendimento / SAC):</span>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            <strong>Quais tratativas são necessárias para o cliente?</strong><br />
                            • [ ] Comunicar cliente via WhatsApp<br />
                            • [ ] Solicitar evidências fotográficas<br />
                            • [ ] Acionar transportadora responsável
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Event-Based Gateway */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/40">
                          <EventGatewayIcon />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-base font-black text-slate-900 dark:text-white">Gateway Baseado em Eventos</h4>
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            Regra Principal: A decisão segue o PRIMEIRO evento externo que acontecer.
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Diferente do XOR (onde o sistema já sabe o dado no momento da decisão), o Gateway por Evento aguarda eventos subsequentes (ex: aguarda e-mail de confirmação OU timeout de 48h; o que ocorrer primeiro vence a corrida).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ATIVIDADES & TAREFAS */}
              {!searchTerm && activeTab === 'tasks' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Atividades e Tipos de Tarefas
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Identifique a natureza do trabalho executado em cada etapa do seu processo:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Task */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                          <UserTaskIcon />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">Tarefa do Usuário (User Task)</h4>
                          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Interação Humana + Software</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        Realizada por uma pessoa com o auxílio de um software ou sistema computacional (ex: digitar informações, aprovar chamado no portal).
                      </p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Exemplo:</p>
                        <p className="italic">&quot;Cadastrar cotação de frete no sistema TMS&quot; ou &quot;Aprovar solicitação de compra&quot;.</p>
                      </div>
                    </div>

                    {/* Manual Task */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                          <ManualTaskIcon />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">Tarefa Manual (Manual Task)</h4>
                          <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Ação Física / Fora do Sistema</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        Atividade física realizada sem o controle direto de um software de computador (ex: movimentação física, colagem de etiquetas).
                      </p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Exemplo:</p>
                        <p className="italic">&quot;Carregar pallets no caminhão&quot; ou &quot;Colar etiqueta física no volume&quot;.</p>
                      </div>
                    </div>

                    {/* Service Task */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                          <ServiceTaskIcon />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">Tarefa Automática (Service Task)</h4>
                          <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">100% Automatizada</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        Executada automaticamente por um sistema ou serviço web (API), sem nenhuma intervenção humana.
                      </p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Exemplo:</p>
                        <p className="italic">&quot;Transmitir CT-e para a SEFAZ&quot; ou &quot;Consultar status do CNPJ na Receita Federal&quot;.</p>
                      </div>
                    </div>

                    {/* Send & Receive Tasks */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                          <SendTaskIcon />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">Tarefas de Envio e Recebimento</h4>
                          <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Mensagens / Webhooks / EDI</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        <strong>Send Task:</strong> envia uma mensagem para outro participante externo. <br />
                        <strong>Receive Task:</strong> o processo aguarda a mensagem chegar para continuar.
                      </p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Exemplo:</p>
                        <p className="italic">&quot;Enviar arquivo EDI PROCEDA NOTFIS para embarcador&quot;.</p>
                      </div>
                    </div>

                    {/* Business Rule Task */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                          <BusinessRuleTaskIcon />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">Regra de Negócio (Business Rule)</h4>
                          <span className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">Tabelas e Cálculos DMN</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        Calcula regras complexas como tabelas de frete, alíquotas de ICMS ou níveis de SLA para o cliente.
                      </p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Exemplo:</p>
                        <p className="italic">&quot;Calcular valor do pedágio e frete peso conforme tabela da rota&quot;.</p>
                      </div>
                    </div>

                    {/* Call Activity & Sub-Process */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                          <CallActivityIcon />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">Subprocesso & Chamada (Call Activity)</h4>
                          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Modularização de Processos</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        Permite invocar um processo independente já mapeado ou encapsular dezenas de tarefas em um único bloco limpo.
                      </p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Exemplo:</p>
                        <p className="italic">&quot;Processo de Gestão de Sinistros&quot; ou &quot;Processo de Faturamento Mensal&quot;.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: EVENTOS */}
              {!searchTerm && activeTab === 'events' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Eventos BPMN 2.0
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Eventos representam algo que acontece (ao invés de algo que é feito).
                    </p>
                  </div>

                  {/* 3 Core Stages */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-sm">
                        <StartEventIcon />
                        <span>Evento de Início</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong>Pergunta orientadora:</strong> O que inicia este processo?
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Borda fina única. Dispara a primeira atividade do fluxo.
                      </p>
                    </div>

                    <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 space-y-2">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-sm">
                        <IntermediateEventIcon />
                        <span>Evento Intermediário</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong>Pergunta orientadora:</strong> Algo precisa ser aguardado durante a execução?
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Borda dupla concêntrica. Ocorre durante o andamento do fluxo.
                      </p>
                    </div>

                    <div className="p-5 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 space-y-2">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-sm">
                        <EndEventIcon />
                        <span>Evento de Fim</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong>Pergunta orientadora:</strong> O que representa o encerramento deste fluxo?
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Borda grossa sólida. Conclui ou interrompe o caminho.
                      </p>
                    </div>
                  </div>

                  {/* Specialized Event Triggers */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Gatilhos de Eventos Mais Utilizados
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                        <TimerIntermediateEventIcon />
                        <div>
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">Timer (Temporizador)</h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Aguardar prazo (ex: 2 horas, 5 dias úteis) ou aguardar data fixa (ex: todo dia 1º).
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                        <MessageIntermediateCatchIcon />
                        <div>
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">Mensagem (Message Event)</h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Chegada de e-mail, notificação push, mensagem EDI ou retorno de webhook de terceiro.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                        <ErrorEndEventIcon />
                        <div>
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">Erro (Error End Event)</h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Interrompe o fluxo devido a uma falha irrecuperável e pode acionar tratamento de exceção.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                        <TerminateEndEventIcon />
                        <div>
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">Terminativo (Terminate End Event)</h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Encerra imediatamente todas as tarefas ativas em todas as raias do processo.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: PARTICIPANTES (POOL & LANE) */}
              {!searchTerm && activeTab === 'participants' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Participantes: Pool vs Lane
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Entenda como estruturar responsabilidades entre empresas e departamentos:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pool */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <PoolIcon />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-900 dark:text-white">Pool (Participante)</h4>
                          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Entidade Organizacional Independente</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        Representa uma <strong>empresa inteira, parceiro comercial externo, cliente ou sistema autônomo</strong>.
                      </p>
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Exemplos de Pool:</span>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          • Transportadora GipExpress<br />
                          • Embarcador / Indústria Cliente<br />
                          • Destinatário Final
                        </p>
                      </div>
                    </div>

                    {/* Lane */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-300">
                          <LaneIcon />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-900 dark:text-white">Lane (Raia)</h4>
                          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Setor / Função Interna</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        Divide as <strong>responsabilidades operacionais dentro de uma mesma empresa (Pool)</strong>.
                      </p>
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Exemplos de Lane:</span>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          • Recebimento / Portaria<br />
                          • Expedição & Carregamento<br />
                          • Soluções / SAC<br />
                          • Financeiro / Faturamento<br />
                          • Sistema Integrado (TMS/ERP)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Flow Types: Sequence vs Message */}
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <ArrowRight size={16} className="text-indigo-500" />
                      Regra de Ouro: Sequence Flow vs Message Flow
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                          <SequenceFlowIcon />
                          <span>Sequence Flow (Linha Contínua)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Conecta etapas <strong>dentro da mesma Pool</strong> (inclusive entre diferentes Lanes da mesma empresa). NUNCA cruza para fora da Pool.
                        </p>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                          <MessageFlowIcon />
                          <span>Message Flow (Linha Tracejada)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Liga exclusivamente <strong>duas Pools distintas</strong> para representar troca de e-mails, arquivos ou comunicações externas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: BOAS PRÁTICAS */}
              {!searchTerm && activeTab === 'practices' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Boas Práticas de Mapeamento BPMN
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Diretrizes práticas para manter seus fluxogramas profissionais, legíveis e fáceis de auditar:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">Use verbos de ação nas tarefas</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Nomeie tarefas sempre com Verbo no Infinitivo + Substantivo (ex: &quot;Conferir nota fiscal&quot;, &quot;Emitir CT-e&quot;, e não apenas &quot;Nota fiscal&quot;).
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">Gateways sempre com saídas claras</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Rotule as setas que saem de uma decisão (ex: &quot;Sim&quot; / &quot;Não&quot;, &quot;Aprovado&quot; / &quot;Reprovado&quot;).
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">Evite fluxogramas gigantes e complexos</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Se um processo tiver mais de 15 a 20 atividades, agrupe partes em Subprocessos (Sub-Process) para manter a visão limpa.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">Evite cruzamento excessivo de setas</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Posicione os nós de forma lógica, da esquerda para a direita ou de cima para baixo, minimizando linhas que se cruzam.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">Escolha elementos pela semântica real</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Não utilize símbolos diferentes apenas por estética. Cada ícone tem um significado padronizado e auditável no padrão BPMN 2.0.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">Defina claramente Início e Fim</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Nenhum fluxo deve ficar &quot;solto&quot;. Toda ramificação deve convergir para um Evento de Fim conclusivo.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer Bar */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span className="hidden sm:inline">Padrão BPMN 2.0 internacional compatível com motor Camunda.</span>
                <span className="sm:hidden">Padrão BPMN 2.0 Camunda.</span>
              </div>
              <button 
                onClick={onClose}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-none"
              >
                Voltar ao Fluxograma
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
