import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import logoGipflow from '../assets/logo-gipflow.svg';
import { getAssetUrl } from '../utils/apiUrl';
import Modeler from 'bpmn-js/lib/Modeler';
import Viewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-js.css';

import { 
  Settings2, 
  Trash2, 
  X, 
  Palette, 
  Maximize2, 
  Clock, 
  Layers, 
  Download, 
  Undo2, 
  Redo2,
  GitBranch,
  Search,
  AlertCircle,
  Plus,
  Minus,
  Move,
  BookOpen,
  Copy,
  Clipboard,
  GraduationCap,
  Sparkles,
  Lightbulb,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';

import { Project, BPMNTaskData, SavedColor } from '../types';
import { cn } from '../lib/utils';
import { logFeature, logAjuste } from '../lib/changelogService';
import BpmnGuide from './BpmnGuide';
import BpmnLearn from './BpmnLearn';
import ContextHelp from './ContextHelp';
import {
  ExclusiveGatewayIcon,
  ParallelGatewayIcon,
  InclusiveGatewayIcon,
  EventGatewayIcon,
  ComplexGatewayIcon,
  StartEventIcon,
  TimerStartEventIcon,
  MessageStartEventIcon,
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
  MessageFlowIcon
} from './bpmnSymbols';

const getElementContextualHelp = (element: any) => {
  if (!element) return null;
  const type = element.type || element.businessObject?.$type || '';
  const eventDef = element.businessObject?.eventDefinitions?.[0]?.$type || '';

  // Gateways
  if (type === 'bpmn:ExclusiveGateway') {
    return {
      title: 'Gateway Exclusivo (XOR)',
      badge: 'Apenas 1 Caminho',
      badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
      icon: <ExclusiveGatewayIcon />,
      rule: 'XOR = Escolha de apenas UM caminho de saída.',
      whenToUse: 'Utilize quando o fluxo depender de uma pergunta com resposta única (Sim/Não) ou rota mutuamente excludente.',
      example: 'Mercadoria avariada? SIM ➔ Abrir ocorrência; NÃO ➔ Liberar expedição.',
      tab: 'gateways',
      targetId: 'sc-xor'
    };
  }
  if (type === 'bpmn:ParallelGateway') {
    return {
      title: 'Gateway Paralelo (AND)',
      badge: 'Todos os Caminhos',
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
      icon: <ParallelGatewayIcon />,
      rule: 'AND = TODOS os caminhos simultâneos (não há teste condicional).',
      whenToUse: 'Utilize para dividir ou sincronizar caminhos que devem acontecer ao mesmo tempo.',
      example: 'Conferir CT-e fiscal E Conferir carga física paralelamente.',
      tab: 'gateways',
      targetId: 'sc-and'
    };
  }
  if (type === 'bpmn:InclusiveGateway') {
    return {
      title: 'Gateway Inclusivo (OR)',
      badge: '1 ou Mais Caminhos',
      badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      icon: <InclusiveGatewayIcon />,
      rule: 'OR = UM OU MAIS caminhos possíveis conforme as condições.',
      whenToUse: 'Utilize quando uma, várias ou todas as saídas puderem ser verdadeiras simultaneamente.',
      example: 'Tratativas de sinistro: Comunicar cliente e/ou Acionar seguradora.',
      tab: 'gateways',
      targetId: 'sc-or'
    };
  }
  if (type === 'bpmn:EventBasedGateway') {
    return {
      title: 'Gateway por Evento',
      badge: 'Primeiro Evento Vence',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      icon: <EventGatewayIcon />,
      rule: 'A decisão aguarda e segue o PRIMEIRO evento externo a ocorrer.',
      whenToUse: 'Utilize quando a rota depender de eventos externos concorrentes (ex: retorno de e-mail vs timeout de 48h).',
      example: 'Aguardar resposta do cliente OU Timeout de 48h.',
      tab: 'gateways'
    };
  }
  if (type === 'bpmn:ComplexGateway') {
    return {
      title: 'Gateway Complexo',
      badge: 'Lógica Especial',
      badgeColor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900',
      icon: <ComplexGatewayIcon />,
      rule: 'Para regras de sincronização avançadas que não cabem no XOR/AND/OR.',
      whenToUse: 'Utilize apenas quando a decisão exigir expressões complexas.',
      example: 'Necessita de 3 de 5 aprovações para seguir.',
      tab: 'gateways'
    };
  }

  // Tasks
  if (type === 'bpmn:UserTask') {
    return {
      title: 'Tarefa do Usuário (User Task)',
      badge: 'Humano + Sistema',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      icon: <UserTaskIcon />,
      rule: 'Ação executada por uma pessoa utilizando um software/computador.',
      whenToUse: 'Utilize quando um usuário precisa preencher formulário, analisar dados em tela ou aprovar no sistema.',
      example: 'Cadastrar cotação no TMS ou aprovar solicitação de frete.',
      tab: 'tasks',
      targetId: 'sc-task'
    };
  }
  if (type === 'bpmn:ManualTask') {
    return {
      title: 'Tarefa Manual (Manual Task)',
      badge: 'Física / Sem Sistema',
      badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
      icon: <ManualTaskIcon />,
      rule: 'Ação física executada fora do computador/sistema.',
      whenToUse: 'Utilize para atividades no pátio, armazém ou transporte sem interface direta com software.',
      example: 'Carregar pallets no caminhão ou colar etiqueta física no volume.',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:ServiceTask') {
    return {
      title: 'Tarefa Automática (Service Task)',
      badge: '100% Automática',
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
      icon: <ServiceTaskIcon />,
      rule: 'Executada automaticamente por um sistema ou API sem intervenção humana.',
      whenToUse: 'Utilize para chamadas web, integrações de banco de dados ou processamento automático.',
      example: 'Transmitir CT-e para a SEFAZ ou consultar status na Receita Federal.',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:SendTask') {
    return {
      title: 'Tarefa de Envio (Send Task)',
      badge: 'Envio de Mensagem',
      badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      icon: <SendTaskIcon />,
      rule: 'Envia dados ou mensagem para um participante externo.',
      whenToUse: 'Utilize para disparo explícito de e-mails, arquivos EDI ou notificações a terceiros.',
      example: 'Enviar arquivo NOTFIS para embarcador.',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:ReceiveTask') {
    return {
      title: 'Tarefa de Recebimento (Receive Task)',
      badge: 'Aguarda Mensagem',
      badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      icon: <ReceiveTaskIcon />,
      rule: 'Pausa o fluxo até receber a mensagem ou sinal externo esperado.',
      whenToUse: 'Utilize quando a continuação do fluxo depender de uma comunicação enviada por terceiros.',
      example: 'Aguardar comprovante de entrega do motorista.',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:BusinessRuleTask') {
    return {
      title: 'Regra de Negócio (Business Rule)',
      badge: 'Tabelas DMN',
      badgeColor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900',
      icon: <BusinessRuleTaskIcon />,
      rule: 'Aplica regras pré-definidas ou cálculos de matriz de decisão.',
      whenToUse: 'Utilize para cálculo de tarifas de frete, regras fiscais ou matrizes de risco.',
      example: 'Calcular valor do frete e pedágio conforme peso e rota.',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:ScriptTask') {
    return {
      title: 'Tarefa de Script (Script Task)',
      badge: 'Script Interno',
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      icon: <ScriptTaskIcon />,
      rule: 'Executa um script de programação diretamente no motor de processos.',
      whenToUse: 'Utilize para manipulação de variáveis, formatação de textos ou lógica simples.',
      example: 'Formatar CEP e sanitizar endereço antes da emissão.',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:CallActivity') {
    return {
      title: 'Chamada de Processo (Call Activity)',
      badge: 'Processo Global',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      icon: <CallActivityIcon />,
      rule: 'Invoca outro processo independente já modelado no repositório.',
      whenToUse: 'Utilize para reaproveitar subprocessos corporativos (ex: Faturamento, Gestão de Sinistros).',
      example: 'Chamar processo de "Emissão Fiscal e Averbação".',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:SubProcess') {
    return {
      title: 'Subprocesso (Sub-Process)',
      badge: 'Agrupamento Modular',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      icon: <SubProcessIcon />,
      rule: 'Agrupa um conjunto de atividades detalhadas para manter a visão principal limpa.',
      whenToUse: 'Utilize para evitar fluxos gigantes com mais de 15 a 20 atividades em tela.',
      example: 'Subprocesso de "Conferência e Triagem da Carga".',
      tab: 'tasks'
    };
  }
  if (type === 'bpmn:Task') {
    return {
      title: 'Tarefa Geral (Task)',
      badge: 'Atividade Padrão',
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      icon: <GenericTaskIcon />,
      rule: 'Atividade genérica. Pode ser convertida para User, Service ou Manual Task.',
      whenToUse: 'Utilize no início do desenho ou quando a atividade não estiver tipificada.',
      example: 'Registrar entrada de mercadoria.',
      tab: 'tasks',
      targetId: 'sc-task'
    };
  }

  // Events
  if (type === 'bpmn:StartEvent') {
    if (eventDef.includes('Timer')) {
      return {
        title: 'Início por Temporizador (Timer)',
        badge: 'Disparo Programado',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
        icon: <TimerStartEventIcon />,
        rule: 'Inicia o processo em horários ou frequências fixas.',
        whenToUse: 'Utilize para processos periódicos (ex: todo dia às 08h, todo dia 1º).',
        example: 'Disparar rotina de fechamento financeiro às 23:59.',
        tab: 'events'
      };
    }
    if (eventDef.includes('Message')) {
      return {
        title: 'Início por Mensagem',
        badge: 'Disparo por Mensagem',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
        icon: <MessageStartEventIcon />,
        rule: 'Inicia o processo ao receber um estímulo de comunicação externa.',
        whenToUse: 'Utilize quando o processo é acionado por e-mail, webhook ou EDI de terceiro.',
        example: 'Chegada de novo pedido de cotação via portal do cliente.',
        tab: 'events'
      };
    }
    return {
      title: 'Evento de Início (Start Event)',
      badge: 'Origem do Processo',
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
      icon: <StartEventIcon />,
      rule: 'Ponto de partida do processo. Todo fluxo deve iniciar aqui.',
      whenToUse: 'Utilize para marcar o início de qualquer fluxo de trabalho.',
      example: 'Chegada do caminhão no pátio.',
      tab: 'events',
      targetId: 'sc-start'
    };
  }

  if (type === 'bpmn:EndEvent') {
    if (eventDef.includes('Terminate')) {
      return {
        title: 'Fim Terminativo',
        badge: 'Encerramento Total',
        badgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        icon: <TerminateEndEventIcon />,
        rule: 'Interrompe imediatamente todas as raias e atividades do processo.',
        whenToUse: 'Utilize em cancelamentos totais onde nada mais deve ser executado.',
        example: 'Pedido cancelado pelo cliente antes do carregamento.',
        tab: 'events'
      };
    }
    if (eventDef.includes('Error')) {
      return {
        title: 'Fim por Erro',
        badge: 'Término com Falha',
        badgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        icon: <ErrorEndEventIcon />,
        rule: 'Encerra o caminho atual sinalizando uma exceção ou falha.',
        whenToUse: 'Utilize quando a etapa falhar e precisar acionar tratamento de erro.',
        example: 'CT-e rejeitado definitivamente pela SEFAZ.',
        tab: 'events'
      };
    }
    if (eventDef.includes('Message')) {
      return {
        title: 'Fim com Mensagem',
        badge: 'Notificação Conclusiva',
        badgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        icon: <MessageEndEventIcon />,
        rule: 'Finaliza o fluxo enviando uma mensagem para o participante externo.',
        whenToUse: 'Utilize quando o encerramento do processo dispara aviso ao cliente.',
        example: 'Processo encerrado com envio de e-mail de confirmação.',
        tab: 'events'
      };
    }
    return {
      title: 'Evento de Fim (End Event)',
      badge: 'Conclusão Normal',
      badgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900',
      icon: <EndEventIcon />,
      rule: 'Marca o término de um caminho do processo.',
      whenToUse: 'Utilize para registrar a entrega do resultado final.',
      example: 'Carga entregue e canhoto assinado com sucesso.',
      tab: 'events',
      targetId: 'sc-end'
    };
  }

  if (type === 'bpmn:IntermediateCatchEvent' || type === 'bpmn:IntermediateThrowEvent' || type === 'bpmn:BoundaryEvent') {
    if (eventDef.includes('Timer')) {
      return {
        title: 'Evento Temporizador (Timer)',
        badge: 'Espera de Prazo',
        badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
        icon: <TimerIntermediateEventIcon />,
        rule: 'Pausa o fluxo até atingir um tempo de espera ou data limite.',
        whenToUse: 'Utilize quando for necessário aguardar um intervalo de tempo.',
        example: 'Aguardar 24h para retorno de cotação.',
        tab: 'events',
        targetId: 'sc-timer'
      };
    }
    if (eventDef.includes('Message')) {
      return {
        title: 'Evento de Mensagem',
        badge: 'Troca de Mensagem',
        badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
        icon: <MessageIntermediateCatchIcon />,
        rule: 'Aguarda ou dispara uma mensagem intermediária no fluxo.',
        whenToUse: 'Utilize para sincronização com participantes externos.',
        example: 'Receber aceite da proposta pelo cliente.',
        tab: 'events',
        targetId: 'sc-msg'
      };
    }
    return {
      title: 'Evento Intermediário',
      badge: 'Ocorrência no Fluxo',
      badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
      icon: <IntermediateEventIcon />,
      rule: 'Representa um evento ou espera ocorrida no meio do caminho.',
      whenToUse: 'Utilize para indicar pontos onde o fluxo aguarda uma ocorrência.',
      example: 'Aguardar autorização do supervisor.',
      tab: 'events'
    };
  }

  // Participants & Lanes
  if (type === 'bpmn:Lane') {
    return {
      title: 'Raia (Lane)',
      badge: 'Responsabilidade Interna',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      icon: <LaneIcon />,
      rule: 'Divide setores, áreas ou cargos dentro da mesma organização.',
      whenToUse: 'Utilize para deixar claro quem executa cada atividade.',
      example: 'Raia "Expedição", Raia "Financeiro", Raia "SAC".',
      tab: 'participants',
      targetId: 'sc-lane'
    };
  }
  if (type === 'bpmn:Participant' || type === 'bpmn:Collaboration') {
    return {
      title: 'Pool (Participante)',
      badge: 'Entidade / Organização',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      icon: <PoolIcon />,
      rule: 'Representa uma empresa parceira, cliente ou processo autônomo.',
      whenToUse: 'Utilize quando o diagrama envolver diferentes entidades jurídicas.',
      example: 'Pool "Transportadora" comunicando com Pool "Embarcador".',
      tab: 'participants',
      targetId: 'sc-pool'
    };
  }

  // Flows
  if (type === 'bpmn:SequenceFlow') {
    return {
      title: 'Fluxo de Sequência',
      badge: 'Linha Contínua',
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      icon: <SequenceFlowIcon />,
      rule: 'Conecta nós dentro da mesma Pool. NUNCA sai para outra Pool.',
      whenToUse: 'Utilize para definir a sequência de execução das etapas.',
      example: 'Conecta Atividade A para Decisão B.',
      tab: 'participants'
    };
  }
  if (type === 'bpmn:MessageFlow') {
    return {
      title: 'Fluxo de Mensagem',
      badge: 'Linha Tracejada',
      badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      icon: <MessageFlowIcon />,
      rule: 'Conecta exclusivamente duas Pools distintas para envio de dados.',
      whenToUse: 'Utilize para troca de mensagens entre diferentes organizações.',
      example: 'Envio de comprovante da transportadora para o cliente.',
      tab: 'participants'
    };
  }

  return null;
};

const translationsPT: Record<string, string> = {
  // Tasks
  'Task': 'Tarefa',
  'User Task': 'Tarefa do Usuário',
  'User task': 'Tarefa do usuário',
  'Service Task': 'Tarefa de Serviço',
  'Service task': 'Tarefa de serviço',
  'Receive Task': 'Tarefa de Recebimento',
  'Receive task': 'Tarefa de recebimento',
  'Send Task': 'Tarefa de Envio',
  'Send task': 'Tarefa de envio',
  'Manual Task': 'Tarefa Manual',
  'Manual task': 'Tarefa manual',
  'Business Rule Task': 'Regra de Negócio',
  'Business rule task': 'Regra de negócio',
  'Script Task': 'Script',
  'Script task': 'Script',
  'Call Activity': 'Atividade de Chamada',
  'Call activity': 'Atividade de chamada',
  'Sub-Process (collapsed)': 'Subprocesso (colapsado)',
  'Sub-process (collapsed)': 'Subprocesso (colapsado)',
  'Sub-Process (expanded)': 'Subprocesso (expandido)',
  'Sub-process (expanded)': 'Subprocesso (expandido)',
  'Sub-Process': 'Subprocesso',
  'Sub-process': 'Subprocesso',

  // Gateways
  'Exclusive Gateway': 'Gateway Exclusivo',
  'Exclusive gateway': 'Gateway exclusivo',
  'Parallel Gateway': 'Gateway Paralelo',
  'Parallel gateway': 'Gateway paralelo',
  'Inclusive Gateway': 'Gateway Inclusivo',
  'Inclusive gateway': 'Gateway inclusivo',
  'Complex Gateway': 'Gateway Complexo',
  'Complex gateway': 'Gateway complexo',
  'Event-based Gateway': 'Gateway baseado em Eventos',
  'Event-based gateway': 'Gateway baseado em eventos',

  // Events
  'Start Event': 'Evento de Início',
  'Start event': 'Evento de início',
  'End Event': 'Evento de Fim',
  'End event': 'Evento de fim',
  'Intermediate Throw Event': 'Evento Intermediário de Envio',
  'Intermediate throw event': 'Evento intermediário de envio',
  'Intermediate Catch Event': 'Evento Intermediário de Captura',
  'Intermediate catch event': 'Evento intermediário de captura',
  'Message Start Event': 'Evento de Início de Mensagem',
  'Message start event': 'Evento de início de mensagem',
  'Timer Start Event': 'Evento de Início por Temporizador',
  'Timer start event': 'Evento de início por temporizador',
  'Conditional Start Event': 'Evento de Início Condicional',
  'Conditional start event': 'Evento de início condicional',
  'Signal Start Event': 'Evento de Início por Sinal',
  'Signal start event': 'Evento de início por sinal',
  'Error Start Event': 'Evento de Início de Erro',
  'Error start event': 'Evento de início de erro',
  'Escalation Start Event': 'Evento de Início de Escalação',
  'Escalation start event': 'Evento de início de escalação',
  'Compensation Start Event': 'Evento de Início de Compensação',
  'Compensation start event': 'Evento de início de compensação',

  // Popup headers / actions
  'Change element': 'Alterar elemento',
  'Change type': 'Alterar tipo',
  'Append element': 'Anexar elemento',
  'Append {type}': 'Anexar {type}',
  'Add Lane above': 'Adicionar Raia acima',
  'Divide (two Lanes)': 'Dividir (duas Raias)',
  'Divide (three Lanes)': 'Dividir (três Raias)',
  'Add Lane below': 'Adicionar Raia abaixo',
  'Connect using DataInputAssociation': 'Conectar usando Associação de Entrada',
  'Connect using Association': 'Conectar usando Associação',
  'Connect using Sequence/MessageFlow or Association': 'Conectar usando Fluxo de Sequência/Mensagem ou Associação',
  'Text Annotation': 'Anotação de Texto',
  'Text annotation': 'Anotação de texto',
  'Data Object Reference': 'Referência de Objeto de Dados',
  'Data Store Reference': 'Referência de Depósito de Dados',
  'Expanded Sub-Process': 'Subprocesso Expandido',
  'Default Flow': 'Fluxo Padrão',
  'Conditional Flow': 'Fluxo Condicional',
  'Sequence Flow': 'Fluxo de Sequência',

  // Tools & Palette
  'Activate the hand tool': 'Ativar ferramenta de mão',
  'Activate the lasso tool': 'Ativar ferramenta de laço',
  'Activate the create/remove space tool': 'Ativar ferramenta de criar/remover espaço',
  'Activate the global connect tool': 'Ativar ferramenta de conexão global',
  'Create StartEvent': 'Criar Evento de Início',
  'Create EndEvent': 'Criar Evento de Fim',
  'Create Gateway': 'Criar Gateway',
  'Create Task': 'Criar Tarefa',
  'Create expanded SubProcess': 'Criar Subprocesso Expandido',
  'Create DataObjectReference': 'Criar Referência de Objeto de Dados',
  'Create DataStoreReference': 'Criar Referência de Depósito de Dados',
  'Create Pool/Participant': 'Criar Pool/Participante',
  'Create Group': 'Criar Grupo',
  'Remove': 'Remover',

  // Loop markers
  'Parallel Multi Instance': 'Múltiplas Instâncias Paralelas',
  'Sequential Multi Instance': 'Múltiplas Instâncias Sequenciais',
  'Loop': 'Loop / Repetição',
  'Empty': 'Vazio'
};

const bpmnLangRef = { current: 'pt' };

function customTranslate(template: string, replacements?: Record<string, string>) {
  replacements = replacements || {};
  const currentLang = bpmnLangRef.current || 'pt';
  const translated = currentLang === 'pt' ? (translationsPT[template] || template) : template;
  return translated.replace(/\{([^}]+)\}/g, function(_, key) {
    return replacements[key] || '{' + key + '}';
  });
}

const customTranslateModule = {
  translate: ['value', customTranslate]
};

interface BPMNModelerProps {
  mapping: any;
  onUpdateMapping: (mapping: any) => void;
  onDeletePdcaCycleForTask?: (taskId: string, updatedCustomData?: any) => void;
  projectName: string;
  savedColors: SavedColor[];
  onSaveGlobalColor: (color: SavedColor) => void;
  onDeleteGlobalColor: (id: string) => void;
  readOnly?: boolean;
}

const INITIAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getTextWidth(text: string, fontSize: number, fontWeight: string = '600'): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.58;
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureCtx = measureCanvas.getContext('2d');
  }
  if (measureCtx) {
    const safeSize = Math.round(fontSize * 10) / 10;
    measureCtx.font = `${fontWeight} ${safeSize}px sans-serif`;
    return measureCtx.measureText(text).width * 1.03;
  }
  return text.length * fontSize * 0.58;
}

function createAutoFitText(text: string, options: any, fallbackCreateText?: Function): SVGElement {
  options = options || {};
  const box = options.box || { x: 0, y: 0, width: 100, height: 80 };
  const element = options.element;
  const style = options.style || {};

  const elementType = element ? element.type : '';
  const typedTaskTypes = [
    'bpmn:UserTask',
    'bpmn:ServiceTask',
    'bpmn:SendTask',
    'bpmn:ReceiveTask',
    'bpmn:ManualTask',
    'bpmn:ScriptTask',
    'bpmn:BusinessRuleTask',
    'bpmn:CallActivity'
  ];

  const isTypedTask = typedTaskTypes.includes(elementType);
  const isSubProcess = elementType === 'bpmn:SubProcess';
  const isTaskLike = isTypedTask || isSubProcess || elementType === 'bpmn:Task' || elementType === 'bpmn:Activity' || !elementType;

  const trimmedText = (text || '').trim();
  if (!trimmedText) {
    const emptySvg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emptySvg.setAttribute('x', '0');
    emptySvg.setAttribute('y', '0');
    return emptySvg as unknown as SVGElement;
  }

  if (!isTaskLike && fallbackCreateText) {
    return fallbackCreateText(text, options);
  }

  // 1. Calculate Padding to respect icon areas and internal box boundaries
  let topPadding = 6;
  let bottomPadding = 6;
  let leftPadding = 6;
  let rightPadding = 6;

  if (isTypedTask) {
    topPadding = 24; // Space below top-left task type icon (x=15, y=12, 18x18)
    bottomPadding = 6;
    leftPadding = 6;
    rightPadding = 6;
  } else if (isSubProcess) {
    bottomPadding = 18; // Space above bottom subprocess marker icon
    topPadding = 8;
    leftPadding = 6;
    rightPadding = 6;
  } else if (typeof options.padding === 'number') {
    topPadding = bottomPadding = leftPadding = rightPadding = options.padding;
  } else if (options.padding && typeof options.padding === 'object') {
    topPadding = options.padding.top ?? 6;
    bottomPadding = options.padding.bottom ?? 6;
    leftPadding = options.padding.left ?? 6;
    rightPadding = options.padding.right ?? 6;
  }

  const boxWidth = box.width || 100;
  const boxHeight = box.height || 80;

  const availableWidth = Math.max(20, boxWidth - leftPadding - rightPadding);
  const availableHeight = Math.max(16, boxHeight - topPadding - bottomPadding);

  // 2. Multi-line Word Wrapping and Font Auto-Fit
  const fontFamily = style.fontFamily || 'Inter, Outfit, system-ui, sans-serif';
  const fontWeight = style.fontWeight || '600';
  const maxFontSize = isTypedTask ? 12 : (boxWidth > 120 ? 13.5 : 12.5);
  const minFontSize = 10;
  const lineRatio = 1.25;

  const words = trimmedText.split(/\s+/);
  let bestFontSize = minFontSize;
  let bestLines: string[] = [];

  for (let fs = maxFontSize; fs >= minFontSize; fs -= 0.5) {
    const lineHeight = fs * lineRatio;
    const maxLinesAllowed = Math.max(1, Math.floor(availableHeight / lineHeight));
    
    let singleWordTooWide = false;
    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentLineWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordW = getTextWidth(word, fs, fontWeight);

      // Single word exceeds available width at this font size
      if (wordW > availableWidth) {
        singleWordTooWide = true;
        break;
      }

      if (currentLine.length === 0) {
        currentLine.push(word);
        currentLineWidth = wordW;
      } else {
        const spaceW = getTextWidth(' ', fs, fontWeight);
        if (currentLineWidth + spaceW + wordW <= availableWidth) {
          currentLine.push(word);
          currentLineWidth += spaceW + wordW;
        } else {
          lines.push(currentLine.join(' '));
          currentLine = [word];
          currentLineWidth = wordW;
        }
      }
    }

    if (singleWordTooWide) {
      continue; // Try smaller font size so single word fits horizontally
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    const totalHeight = lines.length * lineHeight;
    
    // Check both vertical height and max line count
    if (totalHeight <= availableHeight && lines.length <= maxLinesAllowed) {
      bestFontSize = fs;
      bestLines = lines;
      break; // Found largest font size that wraps nicely into multiple lines!
    }
  }

  // 3. Fallback for Extremely Long Text at minFontSize (10px) with Ellipsis
  if (bestLines.length === 0) {
    bestFontSize = minFontSize;
    const lineHeight = minFontSize * lineRatio;
    const maxLinesAllowed = Math.max(1, Math.floor(availableHeight / lineHeight));
    
    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentLineWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordW = Math.min(getTextWidth(word, minFontSize, fontWeight), availableWidth);
      if (currentLine.length === 0) {
        currentLine.push(word);
        currentLineWidth = wordW;
      } else {
        const spaceW = getTextWidth(' ', minFontSize, fontWeight);
        if (currentLineWidth + spaceW + wordW <= availableWidth) {
          currentLine.push(word);
          currentLineWidth += spaceW + wordW;
        } else {
          lines.push(currentLine.join(' '));
          currentLine = [word];
          currentLineWidth = wordW;
        }
      }
    }
    if (currentLine.length > 0) lines.push(currentLine.join(' '));

    if (lines.length > maxLinesAllowed) {
      bestLines = lines.slice(0, maxLinesAllowed);
      let lastLine = bestLines[maxLinesAllowed - 1] || '';
      while (lastLine.length > 0 && getTextWidth(lastLine + '…', minFontSize, fontWeight) > availableWidth) {
        lastLine = lastLine.slice(0, -1).trim();
      }
      bestLines[maxLinesAllowed - 1] = (lastLine ? lastLine : words[0].slice(0, 4)) + '…';
    } else {
      bestLines = lines;
    }
  }

  // 4. Construct SVG Text Element
  const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textElement.setAttribute('class', 'djs-label');

  const lineHeight = bestFontSize * lineRatio;
  const totalBlockHeight = bestLines.length * lineHeight;

  // Vertical center inside available box space (below topPadding)
  const startY = topPadding + ((availableHeight - totalBlockHeight) / 2) + (lineHeight / 2);
  const centerX = leftPadding + (availableWidth / 2);

  textElement.style.fontFamily = fontFamily;
  textElement.style.fontSize = `${bestFontSize}px`;
  textElement.style.fontWeight = fontWeight;
  textElement.style.whiteSpace = 'normal';
  textElement.style.wordBreak = 'normal';
  textElement.style.overflowWrap = 'break-word';
  textElement.style.textAnchor = 'middle';

  if (style.fill) {
    textElement.style.fill = style.fill;
  }

  for (let l = 0; l < bestLines.length; l++) {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', String(centerX));
    tspan.setAttribute('y', String(startY + (l * lineHeight)));
    tspan.setAttribute('text-anchor', 'middle');
    tspan.setAttribute('dominant-baseline', 'central');
    tspan.textContent = bestLines[l];
    textElement.appendChild(tspan);
  }

  return textElement as unknown as SVGElement;
}

export default function BPMNModeler({ 
  mapping, 
  onUpdateMapping, 
  onDeletePdcaCycleForTask,
  projectName,
  savedColors,
  onSaveGlobalColor,
  onDeleteGlobalColor,
  readOnly = false
}: BPMNModelerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<Modeler | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [customData, setCustomData] = useState<Record<string, Partial<BPMNTaskData>>>(mapping.customData || {});
  const customDataRef = useRef(customData);
  const [newColorName, setNewColorName] = useState('');
  const [isDiagramReady, setIsDiagramReady] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isLearnOpen, setIsLearnOpen] = useState(false);
  const [learnInitialTab, setLearnInitialTab] = useState<string>('start');
  const [learnInitialTarget, setLearnInitialTarget] = useState<string | undefined>(undefined);

  const openLearnWithContext = (tab: string = 'start', targetId?: string) => {
    setLearnInitialTab(tab);
    setLearnInitialTarget(targetId);
    setIsLearnOpen(true);
  };
  const [showRemoveProblemModal, setShowRemoveProblemModal] = useState(false);
  const isSyncingRef = useRef(false);
  const isLoadedRef = useRef(false);

  const [bpmnLang, setBpmnLang] = useState<'pt' | 'en'>('pt');

  const handleToggleLanguage = (lang: 'pt' | 'en') => {
    setBpmnLang(lang);
    bpmnLangRef.current = lang;
    logFeature(`Tradução dos elementos de alteração do BPMN (${lang === 'pt' ? 'Português' : 'Inglês'})`, 'BPMN', '🌐');
    if (modelerRef.current) {
      try {
        const eventBus = modelerRef.current.get('eventBus') as any;
        if (eventBus) {
          eventBus.fire('elements.changed', { elements: [] });
        }
      } catch (e) {
        console.warn('Could not refresh elements after language change', e);
      }
    }
  };

  const handleConfirmRemoveProblem = () => {
    if (!selectedElement) return;
    const elementId = selectedElement.id;
    const newCustomData = {
      ...customData,
      [elementId]: {
        ...(customData[elementId] || {}),
        isProblemStep: false
      }
    };
    setCustomData(newCustomData);
    customDataRef.current = newCustomData;

    if (onDeletePdcaCycleForTask) {
      onDeletePdcaCycleForTask(elementId, newCustomData);
    } else {
      updateElementData(elementId, { isProblemStep: false });
    }

    setShowRemoveProblemModal(false);
  };

  const [hasCopied, setHasCopied] = useState(false);
  const [hasPasted, setHasPasted] = useState(false);
  const [isConfirmingPaste, setIsConfirmingPaste] = useState(false);
  const [hasClipboardData, setHasClipboardData] = useState(() => {
    try {
      return !!localStorage.getItem('gipflow_copied_bpmn_mapping');
    } catch {
      return false;
    }
  });

  // Keep clipboard presence up to date whenever active mapping changes
  useEffect(() => {
    try {
      setHasClipboardData(!!localStorage.getItem('gipflow_copied_bpmn_mapping'));
    } catch {
      setHasClipboardData(false);
    }
    setIsConfirmingPaste(false);
  }, [mapping]);

  // Sync customData from props if they change externally (e.g. from Firestore)
  useEffect(() => {
    if (mapping.customData && JSON.stringify(mapping.customData) !== JSON.stringify(customData)) {
      setCustomData(mapping.customData);
    }
  }, [mapping.customData]);

  // Force scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Keep ref in sync
  useEffect(() => {
    customDataRef.current = customData;
  }, [customData]);

  // Initialize Modeler
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Prevent mouse wheel from panning/zooming the diagram
    // This allows the page to scroll normally when the mouse is over the flowchart
    const handleWheel = (e: WheelEvent) => {
      // If we want to allow zoom with Ctrl + Wheel, we could check e.ctrlKey
      // But the request says "Scroll NÃO deve causar pan ou zoom"
      e.stopImmediatePropagation();
    };
    
    container.addEventListener('wheel', handleWheel, { capture: true });

    const ModelerClass = readOnly ? Viewer : Modeler;
    const modeler = new (ModelerClass as any)({
      container: container,
      additionalModules: [
        customTranslateModule
      ],
      keyboard: readOnly ? undefined : {
        bindOn: window
      }
    });

    // Intercept drawShape on bpmnRenderer for Auto-Fit Text rendering
    try {
      const bpmnRenderer = modeler.get('bpmnRenderer') as any;
      const textRenderer = modeler.get('textRenderer') as any;
      const eventBus = modeler.get('eventBus') as any;

      if (eventBus) {
        eventBus.on('directEditing.activate', (e: any) => {
          const active = e && e.active;
          if (!active) return;
          const element = active.element;
          const typedTaskTypes = [
            'bpmn:UserTask',
            'bpmn:ServiceTask',
            'bpmn:SendTask',
            'bpmn:ReceiveTask',
            'bpmn:ManualTask',
            'bpmn:ScriptTask',
            'bpmn:BusinessRuleTask',
            'bpmn:CallActivity'
          ];
          const isTypedTask = element && typedTaskTypes.includes(element.type);

          setTimeout(() => {
            const contentEl = document.querySelector('.djs-direct-editing-content') as HTMLElement;
            const parentEl = document.querySelector('.djs-direct-editing-parent') as HTMLElement;
            if (parentEl) {
              parentEl.style.boxSizing = 'border-box';
              parentEl.style.overflow = 'hidden';
              parentEl.style.borderRadius = '8px';
              parentEl.style.backgroundColor = 'transparent';
            }
            if (contentEl) {
              contentEl.style.boxSizing = 'border-box';
              contentEl.style.width = '100%';
              contentEl.style.maxWidth = '100%';
              contentEl.style.height = '100%';
              contentEl.style.maxHeight = '100%';
              contentEl.style.paddingTop = isTypedTask ? '24px' : '6px';
              contentEl.style.paddingBottom = '6px';
              contentEl.style.paddingLeft = '6px';
              contentEl.style.paddingRight = '6px';
              contentEl.style.textAlign = 'center';
              contentEl.style.whiteSpace = 'pre-wrap';
              contentEl.style.wordBreak = 'normal';
              contentEl.style.overflowWrap = 'break-word';
              contentEl.style.hyphens = 'none';
              contentEl.style.overflow = 'hidden';
              contentEl.style.outline = 'none';
              contentEl.style.lineHeight = '1.25';
            }
          }, 0);
        });
      }

      if (bpmnRenderer && textRenderer) {
        const origDrawShape = bpmnRenderer.drawShape.bind(bpmnRenderer);

        bpmnRenderer.drawShape = function(parentGfx: any, element: any, attrs: any) {
          const origCreateText = textRenderer.createText;
          textRenderer.createText = function(text: string, options: any) {
            options = {
              ...options,
              element: element
            };
            return createAutoFitText(text, options, origCreateText.bind(textRenderer));
          };
          try {
            return origDrawShape(parentGfx, element, attrs);
          } finally {
            textRenderer.createText = origCreateText;
          }
        };
      }
    } catch (err) {
      console.warn('Could not wrap bpmnRenderer drawShape', err);
    }

    modelerRef.current = modeler;

    let isMounted = true;
    let hasImported = false;
    let resizeObserver: ResizeObserver | null = null;
    let rafId: number | null = null;
    const xml = mapping.xml || INITIAL_XML;
    
    const doImportXML = () => {
      if (!isMounted || hasImported || !modeler) return;
      hasImported = true;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      modeler.importXML(xml).then(() => {
        if (!isMounted) return;
        isLoadedRef.current = true;
        setIsDiagramReady(true);
        const canvas = modeler.get('canvas') as any;
        if (canvas) {
          try {
            canvas.zoom('fit-viewport');
            canvas.viewbox({ x: 0, y: 0, width: 1000, height: 1000 }); // Attempt better centering
            canvas.zoom('fit-viewport', 'auto');
          } catch (e) {
            console.warn('Could not zoom to fit-viewport', e);
          }
        }
      }).catch(err => {
        if (isMounted) {
          console.error('Error importing XML', err);
        }
      });
    };

    // Ensure container has valid dimensions in DOM before importing XML
    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      rafId = requestAnimationFrame(() => {
        doImportXML();
      });
    } else if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            doImportXML();
            break;
          }
        }
      });
      resizeObserver.observe(container);
    } else {
      rafId = requestAnimationFrame(() => {
        doImportXML();
      });
    }

    // Event Listeners
    modeler.on('selection.changed', (e: any) => {
      const selection = e.newSelection[0];
      setSelectedElement(selection || null);
    });

    modeler.on('element.changed', (e: any) => {
      if (isSyncingRef.current) return;
      
      const element = e.element;
      if (element.type === 'label' || !element.businessObject) return;

      const newLabel = element.businessObject.name || '';
      setCustomData(prev => {
        const currentData = prev[element.id] || {};
        if (currentData.description === newLabel) return prev;
        
        return {
          ...prev,
          [element.id]: {
            ...currentData,
            description: newLabel
          }
        };
      });

      saveChanges();
    });

    modeler.on('commandStack.changed', () => {
      if (isSyncingRef.current) return;
      saveChanges();
    });

    modeler.on('shape.removed', (e: any) => {
      const element = e.element;
      if (element.type === 'label') return;
      
      setCustomData(prev => {
        if (!prev[element.id]) return prev;
        const next = { ...prev };
        delete next[element.id];
        return next;
      });
    });

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      container.removeEventListener('wheel', handleWheel, { capture: true });
      modeler.destroy();
    };
  }, []);

  const saveChanges = useCallback(async () => {
    if (!modelerRef.current || !isLoadedRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      isSyncingRef.current = true;
      onUpdateMapping({
        ...mapping,
        xml,
        customData: customDataRef.current,
        lastEdited: new Date().toISOString()
      });
      logAjuste('Ajustes e correções dos símbolos da guia BPMN', 'BPMN', '🎨');
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    } catch (err) {
      console.error('Error saving XML', err);
    }
  }, [mapping, onUpdateMapping]);

  const handleCopyDiagram = async () => {
    console.log('[handleCopyDiagram] Iniciando cópia do diagrama...');
    if (!modelerRef.current) {
      console.warn('[handleCopyDiagram] Modeler não disponível.');
      return;
    }
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      console.log('[handleCopyDiagram] XML gerado com sucesso. Tamanho:', xml?.length);
      const dataToCopy = {
        xml,
        customData: customDataRef.current
      };
      localStorage.setItem('gipflow_copied_bpmn_mapping', JSON.stringify(dataToCopy));
      setHasClipboardData(true);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
      console.log('[handleCopyDiagram] Dados salvos com sucesso no localStorage.');
    } catch (err) {
      console.error('[handleCopyDiagram] Erro ao salvar XML:', err);
    }
  };

  const handlePasteDiagram = async () => {
    console.log('[handlePasteDiagram] Clique detectado no botão Colar.');
    if (readOnly) {
      console.warn('[handlePasteDiagram] Modo somente leitura ativo. Abortando colagem.');
      return;
    }
    if (!modelerRef.current) {
      console.warn('[handlePasteDiagram] Instância do modeler não disponível.');
      alert('Editor de fluxogramas ainda não está pronto.');
      return;
    }

    const copiedDataStr = localStorage.getItem('gipflow_copied_bpmn_mapping');
    console.log('[handlePasteDiagram] Conteúdo recuperado do localStorage:', copiedDataStr ? 'Dados encontrados' : 'Vazio');
    if (!copiedDataStr) {
      alert('Nenhum fluxograma copiado na memória.');
      return;
    }

    let copiedData;
    try {
      copiedData = JSON.parse(copiedDataStr);
      console.log('[handlePasteDiagram] JSON decodificado com sucesso.', {
        hasXml: !!copiedData?.xml,
        hasCustomData: !!copiedData?.customData
      });
    } catch (e) {
      console.error('[handlePasteDiagram] Erro ao decodificar JSON do localStorage:', e);
      alert('Os dados copiados estão corrompidos ou em formato inválido.');
      return;
    }

    if (!copiedData || !copiedData.xml) {
      console.warn('[handlePasteDiagram] XML ausente ou inválido nos dados copiados.');
      alert('Nenhum desenho de fluxograma válido foi encontrado no conteúdo copiado.');
      return;
    }

    // Se já estiver na fase de confirmação, executa a colagem
    if (!isConfirmingPaste) {
      console.log('[handlePasteDiagram] Iniciando fluxo de confirmação visual.');
      setIsConfirmingPaste(true);
      return;
    }

    // Se confirmou, realiza a importação
    console.log('[handlePasteDiagram] Confirmação recebida. Importando XML...');
    const xml = copiedData.xml;
    
    modelerRef.current.importXML(xml)
      .then(() => {
        console.log('[handlePasteDiagram] Importação bem-sucedida pelo modeler.');
        
        // Reidratação dos metadados customizados com tratamento de segurança
        try {
          const pastedCustomData = copiedData.customData || {};
          console.log('[handlePasteDiagram] Reidratando metadados customizados:', Object.keys(pastedCustomData).length, 'itens');
          setCustomData(pastedCustomData);
          customDataRef.current = pastedCustomData;
        } catch (metadataError) {
          console.error('[handlePasteDiagram] Erro ao reidratar os metadados:', metadataError);
        }

        // Ajuste de visualização do canvas
        const canvas = modelerRef.current?.get('canvas') as any;
        if (canvas) {
          try {
            canvas.zoom('fit-viewport');
            console.log('[handlePasteDiagram] Zoom ajustado para fit-viewport.');
          } catch (zoomError) {
            console.warn('[handlePasteDiagram] Não foi possível ajustar zoom do canvas:', zoomError);
          }
        }

        // Salvar as alterações imediatamente persistindo no banco
        setTimeout(() => {
          saveChanges();
          console.log('[handlePasteDiagram] Alterações salvas com sucesso.');
        }, 50);

        setHasPasted(true);
        setIsConfirmingPaste(false);
        setTimeout(() => setHasPasted(false), 2000);
      })
      .catch(err => {
        console.error("[handlePasteDiagram] Erro ao importar XML:", err);
        alert('Erro ao importar o fluxograma copiado. Verifique se o formato do XML é suportado.');
        setIsConfirmingPaste(false);
      });
  };

  // Keyboard shortcuts (Ctrl+C / Cmd+C and Ctrl+V / Cmd+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if the modeler is initialized
      if (!modelerRef.current) return;

      // Do not trigger if user is focusing an input, textarea, select, or contenteditable
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.hasAttribute('contenteditable') ||
        activeEl.closest('input') ||
        activeEl.closest('textarea') ||
        activeEl.closest('select')
      )) {
        return;
      }

      // Check for Ctrl (Windows/Linux) or Cmd (Mac)
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl) {
        const key = e.key.toLowerCase();
        if (key === 'c') {
          e.preventDefault();
          console.log('[KeyboardShortcut] Ctrl+C / Cmd+C detectado.');
          handleCopyDiagram();
        } else if (key === 'v') {
          e.preventDefault();
          console.log('[KeyboardShortcut] Ctrl+V / Cmd+V detectado.');
          handlePasteDiagram();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [readOnly, hasClipboardData, isConfirmingPaste, customData, handleCopyDiagram, handlePasteDiagram]);

  const updateElementData = (elementId: string, data: Partial<BPMNTaskData>) => {
    const newCustomData = {
      ...customData,
      [elementId]: {
        ...(customData[elementId] || {}),
        ...data
      }
    };
    setCustomData(newCustomData);

    // Persist changes
    setTimeout(() => {
      saveChanges();
    }, 0);

    // If description changed, update BPMN business object (it's the main visual text)
    if (data.description !== undefined && modelerRef.current) {
      const modeling = modelerRef.current.get('modeling');
      const element = modelerRef.current.get('elementRegistry').get(elementId);
      if (element) {
        modeling.updateLabel(element, data.description);
      }
    }

    // Update colors in BPMN
    if ((data.backgroundColor || data.borderColor) && modelerRef.current) {
      const modeling = modelerRef.current.get('modeling');
      const element = modelerRef.current.get('elementRegistry').get(elementId);
      if (element) {
        modeling.setColor(element, {
          fill: data.backgroundColor,
          stroke: data.borderColor
        });
      }
    }
  };

  // Sync custom data to project - Removed for manual save logic
  /*
  useEffect(() => {
    if (isLoadedRef.current && JSON.stringify(customData) !== JSON.stringify(mapping.customData)) {
      saveChanges();
    }
  }, [customData]);
  */

  const totalTime = useMemo(() => {
    // If diagram is not ready yet, calculate from customData as source of truth
    // This prevents the total time from "disappearing" on screen load
    if (!modelerRef.current || !isDiagramReady) {
      return Object.values(customData).reduce((acc: number, curr: Partial<BPMNTaskData>) => acc + (curr.timeInMinutes || 0), 0);
    }

    const elementRegistry = modelerRef.current.get('elementRegistry');
    return Object.entries(customData).reduce((acc, [id, curr]: [string, any]) => {
      // Once diagram is ready, we use the element registry to ensure element still exists
      if (elementRegistry.get(id)) {
        return acc + (curr.timeInMinutes || 0);
      }
      return acc;
    }, 0);
  }, [customData, isDiagramReady]);

  // Update overlays for problem steps
  useEffect(() => {
    if (!modelerRef.current) return;
    const overlays = modelerRef.current.get('overlays') as any;
    const elementRegistry = modelerRef.current.get('elementRegistry');

    // Clear existing problem overlays
    overlays.remove({ type: 'problem-indicator' });

    const allElements = elementRegistry.getAll();
    
    allElements.forEach((element: any) => {
      // Only for tasks
      const isTask = element.type === 'bpmn:Task' ||
                     element.type === 'bpmn:UserTask' ||
                     element.type === 'bpmn:ServiceTask' ||
                     element.type === 'bpmn:ManualTask' ||
                     element.type === 'bpmn:BusinessRuleTask' ||
                     element.type === 'bpmn:ScriptTask' ||
                     element.type === 'bpmn:SendTask' ||
                     element.type === 'bpmn:ReceiveTask' ||
                     element.type === 'bpmn:CallActivity' ||
                     element.type === 'bpmn:SubProcess';

      if (isTask) {
        const data = customData[element.id] || {};
        const isProblem = !!data.isProblemStep;
        
        if (isProblem) {
          overlays.add(element.id, 'problem-indicator', {
            position: {
              top: -10,
              right: -10
            },
            html: `<div style="background-color: #FF6B6B; width: 20px; height: 20px; z-index: 9999; pointer-events: none;" class="text-white p-1 rounded-full shadow-lg border-2 border-white animate-pulse flex items-center justify-center transition-all" title="Etapa Problema (Ativo)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                   </div>`
          });
        }
      }
    });
  }, [customData, isDiagramReady]);

  const exportAsPng = async () => {
    if (!modelerRef.current) return;
    try {
      const { svg } = await modelerRef.current.saveSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `processo-${projectName}.svg`;
      link.click();
    } catch (err) {
      console.error('Error exporting SVG', err);
    }
  };

  const saveCurrentColor = () => {
    if (!selectedElement || !newColorName.trim()) return;
    const elementId = selectedElement.id;
    const data = customData[elementId] || {};
    
    // Check if color is already in library with same name
    if (savedColors.some(c => c.name.toLowerCase() === newColorName.toLowerCase().trim())) {
      alert('Já existe uma cor com este nome na biblioteca.');
      return;
    }

    const newColor: SavedColor = {
      id: uuidv4(),
      name: newColorName.trim(),
      backgroundColor: data.backgroundColor || '#ffffff',
      borderColor: data.borderColor || '#333333'
    };

    onSaveGlobalColor(newColor);
    setNewColorName('');
  };

  const undo = () => modelerRef.current?.get('commandStack').undo();
  const redo = () => modelerRef.current?.get('commandStack').redo();

  const zoomIn = () => {
    const canvas = modelerRef.current?.get('canvas') as any;
    if (canvas) canvas.zoom(canvas.zoom() * 1.2);
  };

  const zoomOut = () => {
    const canvas = modelerRef.current?.get('canvas') as any;
    if (canvas) canvas.zoom(canvas.zoom() * 0.8);
  };

  const zoomReset = () => {
    const canvas = modelerRef.current?.get('canvas') as any;
    if (canvas) canvas.zoom('fit-viewport');
  };

  const activateHandTool = () => {
    const handTool = modelerRef.current?.get('handTool') as any;
    if (handTool) handTool.activate();
  };

  const currentElementData = selectedElement ? (customData[selectedElement.id] || {
    description: selectedElement.businessObject.name || '',
    responsibleRole: '',
    timeInMinutes: 0,
    isProblemStep: false,
    backgroundColor: '#ffffff',
    borderColor: '#333333'
  }) : null;

  return (
    <div className="h-[800px] flex flex-col relative bg-slate-50 dark:bg-[#0b0f19] font-sans overflow-hidden mapeamento-container transition-colors duration-300">
      {/* Header Toolbar */}
      <div className="h-14 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-20 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-auto h-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-md border border-slate-100 dark:border-slate-700 p-1">
              <img 
                src={logoGipflow} 
                alt="Logo" 
                style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">{projectName}</h3>
              <p className="text-[10px] text-slate-400 dark:text-white font-bold uppercase tracking-wider mt-1">Mapeamento BPMN</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          {!readOnly && (
            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={undo} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 transition-all" title="Desfazer">
                <Undo2 size={16} />
              </button>
              <button onClick={redo} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 transition-all" title="Refazer">
                <Redo2 size={16} />
              </button>
            </div>
          )}

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button onClick={zoomOut} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 transition-all" title="Diminuir Zoom">
              <Minus size={16} />
            </button>
            <button onClick={zoomReset} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 transition-all" title="Ajustar Visualização">
              <Maximize2 size={16} />
            </button>
            <button onClick={zoomIn} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 transition-all" title="Aumentar Zoom">
              <Plus size={16} />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button onClick={activateHandTool} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 transition-all" title="Mover Fluxograma (Arrastar)">
              <Move size={16} />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button 
              onClick={handleCopyDiagram} 
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold text-xs transition-all" 
              title="Copiar Desenho do Fluxograma"
            >
              <Copy size={14} className={hasCopied ? "text-emerald-500" : "text-indigo-500"} />
              <span>{hasCopied ? "Copiado!" : "Copiar"}</span>
            </button>
            {!readOnly && (
              <>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                {isConfirmingPaste ? (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handlePasteDiagram}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-xs transition-all shadow-sm"
                      title="Confirmar substituição e colar fluxograma"
                    >
                      <Clipboard size={12} className="text-white" />
                      <span>Confirmar?</span>
                    </button>
                    <button 
                      onClick={() => setIsConfirmingPaste(false)}
                      className="px-2 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded font-bold text-xs transition-all shadow-sm"
                      title="Cancelar"
                    >
                      <span>Cancelar</span>
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handlePasteDiagram} 
                    disabled={!hasClipboardData}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded font-bold text-xs transition-all",
                      hasClipboardData 
                        ? "hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" 
                        : "opacity-40 cursor-not-allowed text-slate-400"
                    )}
                    title={hasClipboardData ? "Colar Fluxograma Copiado" : "Nenhum fluxograma copiado para colar"}
                  >
                    <Clipboard size={14} className={hasPasted ? "text-emerald-500 animate-pulse" : "text-indigo-500"} />
                    <span>{hasPasted ? "Colado!" : "Colar"}</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-4 px-4 border-l border-slate-200 dark:border-slate-700">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 dark:text-white uppercase tracking-widest">Tempo Total</span>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-400 dark:text-blue-400" />
                <span className="text-sm font-black text-slate-900 dark:text-white">{totalTime} min</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle PT / EN */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button 
              type="button"
              onClick={() => handleToggleLanguage('pt')}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-bold transition-all",
                bpmnLang === 'pt' 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
              title="Português"
            >
              PT
            </button>
            <button 
              type="button"
              onClick={() => handleToggleLanguage('en')}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-bold transition-all",
                bpmnLang === 'en' 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
              title="English"
            >
              EN
            </button>
          </div>

          <button 
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
            title="Guia BPMN - Referência rápida dos elementos"
          >
            <BookOpen size={14} className="text-indigo-500" />
            Guia BPMN
          </button>

          <button 
            type="button"
            onClick={() => openLearnWithContext('start')}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-none"
            title="Aprenda BPMN 2.0 - Manual Didático e Interativo"
          >
            <GraduationCap size={15} className="text-indigo-200" />
            Aprenda BPMN
          </button>
          <ContextHelp 
            contentKey="bpmn" 
            onAction={() => openLearnWithContext('start')} 
            size="sm" 
          />
          <button 
            onClick={exportAsPng}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Download size={14} />
            Exportar SVG
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Modeler Container */}
        <div ref={containerRef} className="flex-1 h-full bpmn-container" />

        {/* Right Properties Panel */}
        <AnimatePresence>
          {selectedElement && (
            <motion.div 
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              className="w-80 bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-2xl overflow-y-auto transition-colors"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Settings2 size={14} className="text-indigo-600 dark:text-blue-400" />
                  Propriedades BPMN
                  <span className={cn(
                    "ml-2 text-white text-[8px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20 transition-all",
                    currentElementData?.isProblemStep ? "bg-[#FF6B6B] animate-pulse" : "bg-[#B0B0B0]"
                  )}>
                    <AlertCircle size={8} />
                    {currentElementData?.isProblemStep ? 'GARGALO' : 'NORMAL'}
                  </span>
                </h4>
                <button onClick={() => setSelectedElement(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-white uppercase tracking-widest">Descrição (Texto da Task)</label>
                    <textarea 
                      value={currentElementData?.description || ''}
                      onChange={(e) => !readOnly && updateElementData(selectedElement.id, { description: e.target.value })}
                      readOnly={readOnly}
                      rows={3}
                      className={cn(
                        "w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700 dark:text-white text-xs resize-none",
                        readOnly && "bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                      )}
                      placeholder="Este texto aparecerá dentro da task no canvas..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 dark:text-white uppercase tracking-widest">Tempo (min)</label>
                      <input 
                        type="number" 
                        value={currentElementData?.timeInMinutes || 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => !readOnly && updateElementData(selectedElement.id, { timeInMinutes: parseInt(e.target.value) || 0 })}
                        readOnly={readOnly}
                        className={cn(
                          "w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 dark:text-white text-xs",
                          readOnly && "bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Ajuda Contextual Didática do Elemento BPMN */}
                {(() => {
                  const elementHelp = getElementContextualHelp(selectedElement);
                  if (!elementHelp) return null;
                  return (
                    <div className="pt-5 border-t border-slate-100 dark:border-slate-700/80">
                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-slate-50 to-white dark:from-indigo-950/30 dark:via-slate-900/60 dark:to-slate-900 border border-indigo-100/80 dark:border-indigo-900/50 shadow-sm space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
                            {elementHelp.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-tight truncate">
                              {elementHelp.title}
                            </p>
                            <span className={cn(
                              "inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border mt-0.5",
                              elementHelp.badgeColor
                            )}>
                              {elementHelp.badge}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-[11px] leading-relaxed">
                          <div className="bg-white/90 dark:bg-slate-800/80 rounded-xl p-2.5 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                            <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                              <Lightbulb size={12} className="text-amber-500 shrink-0" />
                              Quando utilizar:
                            </p>
                            <p className="text-slate-600 dark:text-slate-300 mt-1 text-[11px] font-medium leading-normal">
                              {elementHelp.whenToUse}
                            </p>
                          </div>

                          {elementHelp.example && (
                            <div className="px-2.5 py-1.5 text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
                              <span className="font-bold text-slate-800 dark:text-slate-200">Exemplo: </span>
                              {elementHelp.example}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => openLearnWithContext(elementHelp.tab, elementHelp.targetId)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm shadow-indigo-100 dark:shadow-none"
                        >
                          <GraduationCap size={13} className="text-indigo-200" />
                          <span>Ver no Aprenda BPMN</span>
                          <ArrowUpRight size={13} className="opacity-80" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700 dark:text-white">Etapa Problema</span>
                        <span className="text-[10px] text-slate-400 dark:text-white/60 font-medium">Marcar como gargalo</span>
                      </div>
                      <ContextHelp contentKey="etapaProblema" size="xs" />
                    </div>
                    <button 
                      onClick={() => {
                        if (readOnly || !selectedElement) return;
                        if (currentElementData?.isProblemStep) {
                          setShowRemoveProblemModal(true);
                        } else {
                          updateElementData(selectedElement.id, { isProblemStep: true });
                        }
                      }}
                      disabled={readOnly}
                      className={cn(
                        "w-10 h-5 rounded-full p-1 transition-all",
                        currentElementData?.isProblemStep ? "bg-[#FF6B6B]" : "bg-slate-200 dark:bg-slate-700",
                        readOnly && "opacity-50"
                      )}
                    >
                      <div className={cn(
                        "w-3 h-3 rounded-full transition-all", 
                        currentElementData?.isProblemStep ? "bg-white translate-x-5" : "bg-slate-400 dark:bg-slate-500 translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>

                {!readOnly && (
                  <>
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <Palette size={12} className="text-indigo-500 dark:text-blue-400" />
                        Aparência BPMN
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-white/60 uppercase">Fundo</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={currentElementData?.backgroundColor || '#ffffff'}
                              onChange={(e) => updateElementData(selectedElement.id, { backgroundColor: e.target.value })}
                              className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-[10px] font-mono text-slate-400 dark:text-white/60">{currentElementData?.backgroundColor || '#ffffff'}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-white/60 uppercase">Borda</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={currentElementData?.borderColor || '#333333'}
                              onChange={(e) => updateElementData(selectedElement.id, { borderColor: e.target.value })}
                              className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-[10px] font-mono text-slate-400 dark:text-white/60">{currentElementData?.borderColor || '#333333'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 dark:text-white uppercase tracking-widest flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Palette size={12} className="text-indigo-500 dark:text-blue-400" />
                          Biblioteca de Cores
                        </div>
                        <span className="text-[9px] font-bold text-indigo-500 dark:text-blue-400 tabular-nums">
                          {savedColors.length} cores
                        </span>
                      </label>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {savedColors.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                            {savedColors.map((color) => (
                              <div 
                                key={color.id}
                                className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl group hover:border-indigo-200 dark:hover:border-blue-500 transition-all cursor-pointer"
                                onClick={() => updateElementData(selectedElement.id, { 
                                  backgroundColor: color.backgroundColor,
                                  borderColor: color.borderColor
                                })}
                              >
                                <div 
                                  className="w-8 h-8 rounded-lg border-2 shadow-sm shrink-0"
                                  style={{ backgroundColor: color.backgroundColor, borderColor: color.borderColor }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black text-slate-700 dark:text-white truncate">{color.name}</p>
                                  <p className="text-[8px] font-mono text-slate-400 dark:text-white/40 mt-0.5">{color.backgroundColor}</p>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Deseja excluir a cor "${color.name}" da biblioteca?`)) {
                                      onDeleteGlobalColor(color.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-300 dark:text-white/20 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-white uppercase tracking-widest">Nenhuma cor salva</p>
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-indigo-50/50 dark:bg-blue-900/10 rounded-2xl border border-indigo-100/50 dark:border-blue-900/20 space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-indigo-600 dark:text-blue-400 uppercase tracking-widest ml-1">Salvar Cor Atual</label>
                          <div className="flex gap-2">
                             <input 
                              type="text"
                              placeholder="Ex: Etapa Crítica"
                              value={newColorName}
                              onChange={(e) => setNewColorName(e.target.value)}
                              className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-blue-500 shadow-sm transition-all dark:text-white"
                            />
                            <button 
                              onClick={saveCurrentColor}
                              disabled={!newColorName.trim()}
                              className="px-4 py-2 bg-indigo-600 dark:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tight disabled:opacity-50 hover:bg-indigo-700 dark:hover:bg-blue-500 transition-all shadow-md shadow-indigo-100 dark:shadow-none"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BpmnGuide 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
        onOpenLearn={() => openLearnWithContext('start')}
      />

      <BpmnLearn
        isOpen={isLearnOpen}
        onClose={() => setIsLearnOpen(false)}
        initialTab={learnInitialTab}
        initialTargetElement={learnInitialTarget}
      />

      {/* Modal de confirmação ao remover flag de etapa problema */}
      <AnimatePresence>
        {showRemoveProblemModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-left"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-3">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                  <AlertCircle size={22} />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                  Remover Etapa Problema
                </h3>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-6">
                Deseja realmente remover esta etapa como problema?{"\n\n"}
                Isso fará com que o ciclo PDCA vinculado seja completamente removido.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRemoveProblemModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveProblem}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shadow-md transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .bpmn-container {
          background-color: #f8fafc;
          background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
          background-size: 20px 20px;
          transition: background 0.3s ease;
        }
        [data-theme="dark"] .bpmn-container {
          background-color: #0b101c;
          background-image: radial-gradient(#1e293b 1px, transparent 1px);
        }
        .bjs-powered-by {
          display: none !important;
        }
        .djs-overlay {
          z-index: 1000 !important;
          pointer-events: none;
        }
        .djs-palette {
          display: ${readOnly ? 'none !important' : 'block !important'};
          top: 20px !important;
          left: 20px !important;
          border-radius: 12px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
          background: white !important;
          transition: background 0.3s ease, border 0.3s ease;
        }
        [data-theme="dark"] .djs-palette {
          background: #111827 !important;
          border-color: #374151 !important;
        }
        [data-theme="dark"] .djs-palette .entry {
          color: #94a3b8 !important;
        }
        [data-theme="dark"] .djs-palette .entry:hover {
          color: #ffffff !important;
          background: #1f2937 !important;
        }
        .djs-context-pad {
          display: ${readOnly ? 'none !important' : 'block !important'};
          border-radius: 8px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          background: white !important;
          transition: background 0.3s ease, border 0.3s ease;
        }
        [data-theme="dark"] .djs-context-pad {
          background: #111827 !important;
          border-color: #374151 !important;
        }
        [data-theme="dark"] .djs-context-pad .entry {
          color: #94a3b8 !important;
        }
        [data-theme="dark"] .djs-context-pad .entry:hover {
          color: #ffffff !important;
          background: #1f2937 !important;
        }
        /* BPMN Dark Mode Support for the canvas elements themselves */
        [data-theme="dark"] .djs-visual rect,
        [data-theme="dark"] .djs-visual circle,
        [data-theme="dark"] .djs-visual polygon,
        [data-theme="dark"] .djs-visual path {
          stroke: #94a3b8 !important;
        }
        [data-theme="dark"] .djs-visual rect,
        [data-theme="dark"] .djs-visual circle,
        [data-theme="dark"] .djs-visual polygon {
          fill: #1e293b !important;
        }
        /* Custom user colors should override the above if possible. 
           In bpmn-js, custom colors are often applied as inline styles. 
           CSS !important will override inline styles. 
           So we should only apply these if the element is 'default'. 
           Actually, bpmn-js adds 'djs-outline' and other classes.
        */
        
        /* Better way: only target elements that don't have a specific data attribute or inline style if possible, 
           but CSS can't easily check for 'no inline style'.
           Actually, if the user sets a color, it's usually applied to the 'rect' or 'circle' inside the 'djs-visual'.
        */

        .djs-label, .djs-label tspan {
          font-family: 'Inter', 'Outfit', system-ui, -apple-system, sans-serif !important;
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: break-word !important;
          hyphens: none !important;
        }

        /* Direct editing contenteditable container */
        .djs-direct-editing-parent {
          box-sizing: border-box !important;
          overflow: hidden !important;
          border-radius: 8px !important;
          background-color: transparent !important;
        }

        .djs-direct-editing-content {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          text-align: center !important;
          white-space: pre-wrap !important;
          word-break: normal !important;
          overflow-wrap: break-word !important;
          hyphens: none !important;
          overflow: hidden !important;
          outline: none !important;
          line-height: 1.25 !important;
          display: block !important;
        }

        [data-theme="dark"] .djs-direct-editing-content {
          color: #f8fafc !important;
        }

        [data-theme="light"] .djs-direct-editing-content,
        :root:not([data-theme="dark"]) .djs-direct-editing-content {
          color: #0f172a !important;
        }

        [data-theme="dark"] .djs-label,
        [data-theme="dark"] .djs-label tspan {
          fill: #e2e8f0 !important;
        }
        [data-theme="dark"] .djs-connection path {
          stroke: #64748b !important;
        }

        /* BPMN Popup/Replace Menu Dark Mode */
        [data-theme="dark"] .djs-popup {
          background: #111827 !important;
          border-color: #374151 !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5) !important;
          color: white !important;
        }
        [data-theme="dark"] .djs-popup .entry {
          background: #111827 !important;
          color: #e2e8f0 !important;
        }
        [data-theme="dark"] .djs-popup .entry:hover {
          background: #1f2937 !important;
          color: #ffffff !important;
        }
        [data-theme="dark"] .djs-popup-header {
           background: #1f2937 !important;
           border-bottom: 1px solid #374151 !important;
           color: #ffffff !important;
        }
        [data-theme="dark"] .djs-popup .entry-label {
           color: #e2e8f0 !important;
        }
        [data-theme="dark"] .djs-popup .entry-icon {
           color: #94a3b8 !important;
        }
        [data-theme="dark"] .djs-popup .entry:hover .entry-icon {
           color: #ffffff !important;
        }
      `}} />
    </div>
  );
}
