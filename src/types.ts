// Tipo que define os status em que um projeto pode se encontrar ao longo do ciclo de vida
export type ProjectStatus = 'Backlog' | 'Planejamento' | 'Em andamento' | 'Em melhoria' | 'Concluído';

// Tipo que define os níveis de prioridade atribuídos a projetos ou subtarefas
export type ProjectPriority = 'Baixa' | 'Média' | 'Alta';

// Interface que representa um departamento ou setor envolvido no escopo de um projeto
export interface InvolvedSector {
  id: string; // Identificador único do setor
  name: string; // Nome descritivo ou sigla do setor
}

// Interface que representa as ferramentas metodológicas utilizadas no projeto (ex: Ishikawa, 5W2H)
export interface ToolUsed {
  id: string; // Identificador único da ferramenta cadastrada
  name: string; // Nome descritivo da ferramenta
}

// Interface principal que agrupa todo o escopo definido para o projeto
export interface ProjectScope {
  title: string; // Título formal do escopo do projeto
  responsible: string; // Nome completo do líder ou gestor responsável
  presentationLink?: string; // Link complementar para slides ou apresentações do escopo
  problemDescription: string; // Descrição detalhada do cenário problema ou gargalo
  measurableObjective: string; // Objetivo prático ou meta mensurável a ser atingida
  involvedSectors: InvolvedSector[]; // Lista de setores engajados nas atividades
  toolsUsed: ToolUsed[]; // Ferramentas ativas no percurso metodológico
  startDate: string; // Data de início efetivo do projeto
  forecastCompletion: string; // Data de conclusão estimada planejada
  ods?: string; // Texto geral sobre impactos nos Objetivos de Desenvolvimento Sustentável
  odsSelecionadas?: number[]; // Lista de IDs das ODS da ONU aplicáveis ao projeto
  esgSelecionado?: string[]; // Categorias de ESG selecionadas (Environmental, Social, Governance)
  odsDescricao?: string; // Justificativa qualitativa relacionando o projeto às ODS definidas
  esgDescricao?: string; // Explicação de como o projeto atende a diretrizes de ESG integradas
  esgEnvironmental?: string; // Detalhamento de impactos sob a ótica Ambiental
  esgSocial?: string; // Detalhamento de impactos sob a ótica de Responsabilidade Social
  esgGovernance?: string; // Detalhamento de impactos sob a ótica de Governança corporativa
  financial: { // Consolidação dos impactos e projeções financeiras ligadas ao projeto
    currentImpact: { // Perdas ou ônus financeiro atual causado pelo problema operacional
      value: number; // Valor em reais correspondente à perda
      type: 'fixo' | 'continuo'; // Se a perda é pontual (fixo) ou recorrente (continuo)
      period: 'mensal' | 'anual'; // Recorrência temporal da perda recorrente
    };
    gainProjection: { // Ganhos e retornos estimados caso o problema seja solucionado
      value: number; // Valor projetado estimado em reais
      type: 'fixo' | 'continuo'; // Indica se o benefício é pontual (fixo) ou recorrente (continuo)
      period: 'mensal' | 'anual'; // Recorrência de consolidação do ganho contínuo
    };
  };
}

// Tipo que determina as representações visuais ou tipos de nós suportados no fluxo
export type BPMNShapeType = 
  | 'task' 
  | 'startEvent' 
  | 'endEvent' 
  | 'gateway' 
  | 'subprocess'
  | 'document' 
  | 'data-storage'
  | 'pool'
  | 'lane';

// Cores customizadas que podem ser salvas pelos usuários no editor de processos BPMN
export interface SavedColor {
  id: string; // Identificador único da paleta de cores
  name: string; // Etiqueta atribuída à cor (ex: "Processo Apenas")
  backgroundColor: string; // Código hexadecimal da cor do preenchimento
  borderColor: string; // Código hexadecimal da cor do contorno ou traço
}

// Dados específicos associados a cada tarefa ou etapa de processo mapeada no BPMN
export interface BPMNTaskData {
  description?: string; // Detalhamento ou nome resumido da ação na célula do fluxo
  responsibleRole: string; // Cargo, setor ou responsável direto pela execução da tarefa
  timeInMinutes: number; // Duração média esperada em minutos para a conclusão da etapa
  isProblemStep: boolean; // Sinaliza se essa operação está identificada como um ponto crítico/gargalo do processo
  priority?: 'Baixa' | 'Média' | 'Alta'; // Criticidade interna da atividade no processo
  backgroundColor: string; // Cor personalizada aplicada ao plano de fundo do elemento gráfico
  borderColor: string; // Cor personalizada aplicada à borda do elemento gráfico
  shapeType: BPMNShapeType; // Formato gráfico correspondente ao padrão BPMN
  width?: number; // Largura atualizada da forma
  height?: number; // Altura atualizada da forma
  onResize?: (width: number, height: number) => void; //的回調 a ser executado quando a forma for redimensionada no painel
}

// Item que compõe as entradas de dados utilizadas para gerar o Diagrama de Pareto (80/20)
export interface ParetoItem {
  id: string; // Identificador da ocorrência ou categoria catalogada
  category: string; // Nome do incidente, reclamação ou desperdício observado
  quantity: number; // Frequência ou acumulado numérico associado ao incidente
}

// Estrutura tradicional do método dos 5 Porquês para encontrar a causa-raiz de um defeito
export interface FiveWhys {
  why1: string; // Primeira constatação ou explicação do desvio
  why2: string; // Segundo porquê derivado da resposta anterior
  why3: string; // Terceiro porquê derivado da resposta anterior
  why4: string; // Quarto porquê derivado da resposta anterior
  why5: string; // Quinto porquê determinando a raiz lógica do problema
}

// Registro simples de causa usado de forma geral ou na metodologia Ishikawa/lista
export interface RootCauseEntry {
  id: string; // Identificador do item
  text: string; // Texto explicativo contendo a causa levantada
}

// Categoria correspondente a um dos 6Ms clássicos do Diagrama de Ishikawa
export interface IshikawaCategory {
  id: string; // ID único da categoria de influência
  name: 'Método' | 'Máquina' | 'Mão de obra' | 'Material' | 'Meio ambiente' | 'Medida'; // Nomes padronizados padrão 6M
  description: string; // Explicação sumária de qual influência essa categoria exerce
  entries: RootCauseEntry[]; // Lista de causas mapeadas sobre o respectivo braço de influência
}

// Log histórico com atualizações em cada tarefa, servindo de trilha de auditoria para o DO do PDCA
export interface ExecutionLog {
  id: string; // ID único da entrada de log
  timestamp: string; // Data e horário da postagem do log
  status: 'Pendente' | 'Em andamento' | 'Concluído'; // Status de execução que foi assumido
  responsible: string; // Nome de quem realizou a modificação ou ação
  sector?: string; // Setor ao qual pertence o executor do log
  observation: string; // Observações ou comentários sobre o avanço
  type: 'update' | 'completion' | 'start'; // Tipo estrutural do log de alteração
}

// Classificação conceitual do plano de ação elaborado
export type ActionPlanType = 'Processual' | 'Operacional' | 'Inovação';

// Item individual contendo todo o planejamento 5W2H e as respectivas etapas de acompanhamento no PDCA
export interface ActionPlanItem {
  id: string; // ID identificador do plano de ação
  
  // -- PLAN (Mapeamento 5W2H) --
  what: string; // O que (Ação ou contramedida a ser realizada)
  why: string; // Por que (Justificativa e benefício atrelado à ação)
  where: string; // Onde (Em qual local, sistema ou filial será implementado)
  when: string; // Quando (Prazo limite de implementação pactuado)
  who: string; // Quem (Pessoa que liderará a execução da ação)
  sector?: string; // Setor interno responsável pela entrega física
  how: string; // Como (Método detalhado ou etapas exigidas para implementação)
  howMuch: string; // Quanto custará (Orçamento financeiro estimado em reais)
  actionType?: ActionPlanType; // Categoria descritiva da ação executada
  
  // -- DO (Execução do Planejamento) --
  status: 'Pendente' | 'Em andamento' | 'Concluído' | 'Cancelado'; // Status corrente da ação no painel operacional
  ativo?: boolean; // Se a ação está ligada e elegível para controle
  startDate?: string; // Data real em que o executor iniciou os trabalhos estruturais
  endDate?: string; // Data real de término ou fechamento definitivo da ação
  observations?: string; // Anotações gerais sobre dificuldades ou andamentos técnicos
  executionLogs: ExecutionLog[]; // Histórico detalhado com notas de evolução
  currentPhase?: 'DO' | 'CHECK' | 'ACT' | 'REPORT'; // Fase de fluxo corrente para restrições e visualizadores
  
  // -- CHECK (Monitoramento e Medição de Resultados) --
  monitoringMode?: 'Dias' | 'Semanas' | 'Meses'; // Periodicidade das verificações periódicas pós-entrega
  monitoringPeriod?: number; // Duração total do período do acompanhamento
  monitoringTool?: string; // Ferramenta, painel ou indicador de verificação
  worked?: 'Sim' | 'Não' | 'Parcial'; // Resposta rápida indicando se a hipótese solucionou o desvio original
  failureReason?: string; // Justificativa de resultados parciais ou por que a ação não gerou o impacto esperado
  evidence?: string; // Apontamento de evidências ou relatórios gerados
  realGains?: GainsStructure; // Estrutura contendo o levantamento quantitativo/qualitativo dos impactos aferidos
  
  // -- ACT (Ações Corretivas e Padronização de Processos) --
  finalProblemStatus?: 'Resolvido' | 'Não resolvido'; // Status definitivo avaliado pelo corporativo
  finalAction?: 'Padronizar processo' | 'Fazer nova análise'; // Decisão estratégica para manter o processo ou reincluir análise
  standardizationModels?: ('POP' | 'ITO' | 'Painel de controle')[]; // Modelos de padronização corporativa consolidados
}

// Estados possíveis para indicar o ciclo PDCA ativo ou totalmente estabilizado
export type PDCAStatus = 'Ativo' | 'Concluído';

// Classificação de severidade reguladora de um respectivo ciclo de melhoria contínua
export type PDCAPriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

// Estrutura representativa de um ciclo PDCA focado na melhoria das tarefas do processo
export interface PDCACycle {
  id: string; // ID único do ciclo PDCA
  taskId: string; // Vinculação com o elemento de tarefa ID dentro do processo BPMN correspondente
  title: string; // Objetivo descritivo ou nome conceitual do ciclo de melhoria contínua
  nomePdca?: string; // Nome descritivo customizado pelo usuário para fins de relatório
  createdAt: string; // Timestamp de criação do registro de melhoria
  status: PDCAStatus; // Indica se este ciclo está em andamento ou de fato finalizado
  etapaAtual?: 'PLAN' | 'DO' | 'CHECK' | 'ACT' | 'REPORT'; // Etapa atual de preenchimento e controle no dashboard
  progress?: number; // Percentual representativo da maturidade estimada do ciclo
  plan: { // Metadados e planejamentos gerados ao longo da etapa PLAN (Planejar)
    problemDescription: string; // Descrição de qual o foco e contexto do problema levantado
    rootCauseAnalysis: { // Diagnóstico do problema original a fim de levantar as hipóteses de mitigação
      type: '5whys' | 'list' | 'ishikawa'; // Abordagem metodológica definida pelo equipe
      entries: RootCauseEntry[]; // Entradas de listas lineares ou método 5whys
      ishikawa?: IshikawaCategory[]; // Elementos visuais completos se Ishikawa for selecionado
      priorityCauses?: string[]; // Indicação das causas prioritárias para o 5W2H
      identifiedRootCause?: string; // Síntese expressiva da causa fundamental acordada pelo grupo
    };
    impact: { // Indicadores pactuados no planejamento de metas do projeto
      description: string; // Descrição de qual o indicador focado (ex: OEE, Lead Time)
      value: number; // Valor/métrica quantitativa de origem antes da melhoria
      goal: number; // Meta quantitativa percentual de redução ou otimização focada
      expectedGains?: GainsStructure; // Benefícios colaterais diretos esperados pós-piloto
      improvementPercentage?: number; // Retorno estimado consolidado das métricas de melhoria
    };
    actionPlan: ActionPlanItem[]; // Listagem de ações formuladas para o combate das causas (Plano de Ação)
  };
}

// Subtarefas e processos ramificados que compõem o escopo do projeto
export interface Subtask {
  id: string; // ID da subtarefa dentro do projeto
  title: string; // Breve nome ou resumo representativo da atividade do processo
  priority: ProjectPriority; // Nível de importância operacional
  status: 'Pendente' | 'Em andamento' | 'Concluído'; // Status de finalização estrutural
  responsibleId?: string; // ID do colaborador responsável por conduzir as melhorias
  startDate?: string; // Data real de início agendada
  endDate?: string; // Data real de finalização da condução geral
  mapping: { // Definições de desenhos e mapeamentos de valor para diagramas no fluxo BPMN
    xml?: string; // Informação XML do bpmn-js que expressa o desenho gráfico
    customData?: Record<string, Partial<BPMNTaskData>>; // Dados personalizados por nó (como responsáveis ou gravidades)
    nodes: any[]; // Entradas manuais de nós em sistemas antigos de representação visual
    edges: any[]; // Conectores geométricos de fluxos de decisão
    orientation: 'horizontal' | 'vertical'; // Alinhamento no painel de renderização
    lastEdited: string; // Horário da última atualização no diagrama
    savedColors: SavedColor[]; // Lista de cores de processos persistidas do usuário
  };
  pdcaCycles: PDCACycle[]; // Ciclos PDCA paralelos vinculados a esta etapa
  progress?: number; // Evolução geral das rotinas
}

// Anexos do drive ou arquivos locais vinculados às etapas do projeto para fins de evidência
export interface ProjectFile {
  id: string; // ID interno de controle do arquivo
  projectId: string; // ID do projeto ao qual o anexo pertence
  fileName: string; // Nome legível original do arquivo postado
  fileId: string; // ID real representativo no storage ou Google Drive
  fileUrl: string; // Link direto para download ou visualização assistida
  uploadedAt: string; // Horário em que o upload foi armazenado
  size?: number; // Tamanho do anexo em bytes
  mimeType?: string; // Tipo MIME do documento registrado (PDF, XLSX, etc)
}

// Interface mãe que representa as informações de nível de diretório para Projetos cadastrados
export interface Project {
  id: string; // Identificador único absoluto do projeto
  name: string; // Nome informal dado ao conjunto de melhorias contínuas
  description?: string; // Descrição formal detalhando a missão do projeto
  createdAt: string; // Timestamp representativo do cadastro oficial do projeto
  progress: number; // Progresso agregado estimado com base nas conclusões das subetapas
  status: ProjectStatus; // Status corrente de andamento do projeto macro
  priority?: ProjectPriority; // Prioridade geral sinalizando o nível de atenção requerido
  assignedTo: string; // ID de usuário no sistema que gerencia o fluxo operacional
  scope: ProjectScope; // Dados do planejamento de escopo focado
  subtasks: Subtask[]; // Subetapas de processo vinculadas aos testes metodológicos
  driveFolderId?: string; // Pasta do Google Drive reservada para armazenamento de evidências
}

// Tipos de perfis de responsabilidade de acesso e manipulação de fluxos
export type UserProfile = 'Usuário Analista' | 'Usuário Master';

// Informações estruturadas de cadastro de colaboradores no sistema
export interface User {
  id: string; // ID identificador do usuário logado
  name: string; // Nome legível do usuário
  email?: string; // Endereço de email corporativo de acesso
  sector?: string; // Departamento organizacional do colaborador
  avatar?: string; // URL da imagem ou iniciais para ícones no header
  profile?: UserProfile; // Perfil de atuação determinando seus níveis de gravação
}

// Ações operacionais avulsas enviadas para os usuários ou definidas no histórico interativo
export interface OperationalAction {
  id: string; // ID único da ação operacional avulsa
  projectId: string; // Vínculo do identificador do projeto associado
  projectName: string; // Nome do projeto correspondente
  subtaskId: string; // Identificador da subtarefa correspondente
  subtaskTitle: string; // Título da subtarefa do processo
  action: string; // O que foi pactuado (Texto descritivo curto)
  responsibleId: string; // Pessoa responsável por executar a respectiva ação
  responsibleName: string; // Nome descritivo da pessoa responsável
  priority: ProjectPriority; // Criticidade de execução
  status: 'Pendente' | 'Em andamento' | 'Concluído'; // Status de entrega atual
  forecastDate: string; // Prazo previsto para a realização técnica
  completionDate?: string; // Data real de finalização de entrega
  feedback?: string; // Observações para redefinir metas ou avaliações de qualidade
  createdAt: string; // Timestamp de criação do registro no banco de dados
}

// Registros de históricos de logs de auditoria de relatórios criados e extraídos
export interface ReportLog {
  id: string; // ID de registro de auditoria de impressão de relatórios
  userId: string; // ID de quem efetuou o download do documento corporativo
  userName: string; // Nome do colaborador executor da ação
  timestamp: string; // Data e horário em que o relatório em PDF foi gerado
  reportType: 'PDCA' | 'Histórico de Ações' | 'Relatório Completo'; // Categoria impressa
}

// Detalhes quantitativos de benefícios monetários ou físicos obtidos pós-projeto
export interface TangibleGain {
  id: string; // ID identificador do ganho financeiro mapeado
  type: string; // Nome da categoria correspondente (ex: Redução de sucata, Otimização de tempos)
  value: number; // Mapeamento financeiro ou quantitativo
  unit: string; // Unidade dimensional adotada (ex: R$, Horas/Mês, kg/Mês)
}

// Detalhes qualitativos de impactos benéficos que não possuem unidade estrita de dinheiro (ex: Clima, Segurança)
export interface IntangibleGain {
  id: string; // ID identificador do ganho intangível mapeado
  type: string; // Tipo estratégico (ex: Ergonomia, Redução de cansaço, Satisfação)
  description: string; // Notas de observação sobre a incidência benéfica observada em campo
  impactLevel: 'Baixo' | 'Médio' | 'Alto' | 'Muito Alto' | ''; // Intensidade do ganho percebida pelo setor envolvido
}

// Estrutura que unifica e tipifica os ganhos em frentes palpáveis e intangíveis em formulários
export interface GainsStructure {
  tangible: TangibleGain[]; // Conjunto de ganhos físicos e monetários mapeados
  intangible: IntangibleGain[]; // Conjunto de ganhos de qualidade e organizacionais identificados
}

// Configuração para validar os inputs estruturados de ganhos palpáveis no cadastro do sistema
export interface TangibleGainType {
  id: string; // ID da regra de validação
  name: string; // Nome da categoria de ganhos cadastrada administrativamente
  units: string[]; // Unidades de aferição adequadas à categoria cadastrada
  active: boolean; // Se a categoria está disponível para seleção ativa nos formulários
}

// Configuração para estruturar o cadastro administrativo de ganhos conceituais e intangíveis
export interface IntangibleGainType {
  id: string; // ID da regra intangível
  name: string; // Nome técnico cadastrado (ex: Cultura de Qualidade)
  active: boolean; // Ativo nas seleções do formulário
}

// Definição de unidades de medidas físicas parametrizadas no sistema corporativo
export interface UnitMeasure {
  id: string; // ID da unidade corporativa homologada
  symbol: string; // Símbolo da sigla dimensional (ex: kg, H/Mês, R$)
  description?: string; // Nome descritivo da unidade (ex: Quilogramas)
  active: boolean; // Status de habilitação técnica
}

// Metadados de configurações gerais unificados salvos em formato de JSON corporativo global
export interface GlobalConfig {
  sectors: string[]; // Setores homologados para seleção comum em comboboxes
  tools: string[]; // Lista geral com ferramentas habilitadas no escopo do projeto
  tangibleGainTypes: string[]; // Array com as descrições de ganhos palpáveis suportados
  intangibleGainTypes: string[]; // Array com as descrições de ganhos intangíveis estruturados
  units: string[]; // Lista de símbolos de unidades de medidas habilitados
  structuredTangibleGains?: TangibleGainType[]; // Estrutura avançada de validação de ganhos monetários e físicos
  structuredIntangibleGains?: IntangibleGainType[]; // Estrutura conceitual avançada dos ganhos intangíveis de melhoria
  structuredUnits?: UnitMeasure[]; // Lista parametrizada com controle de estado de unidade corporativa de medida
}
