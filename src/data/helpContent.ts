export interface HelpItemContent {
  key: string;
  title: string;
  whatIs: string;
  whatToDo: string;
  objective: string;
  tip?: string;
  actionText?: string;
  actionType?: 'open_bpmn_learn' | 'custom' | string;
}

export const HELP_CONTENT: Record<string, HelpItemContent> = {
  projetos: {
    key: 'projetos',
    title: 'Projetos',
    whatIs: 'Esta área concentra os projetos e iniciativas acompanhados pelo time de Processos.',
    whatToDo: 'Utilize o Kanban para acompanhar os projetos, seus responsáveis, status, progresso e demais informações relacionadas.',
    objective: 'Permitir uma visão organizada da carteira de projetos e facilitar o acompanhamento da evolução de cada iniciativa.',
  },
  escopo: {
    key: 'escopo',
    title: 'Escopo do Projeto',
    whatIs: 'Esta área reúne as principais informações que estruturam o projeto e suas atividades.',
    whatToDo: 'Registre e acompanhe as subtarefas, informações do projeto, mapeamentos, arquivos e demais elementos relacionados à execução.',
    objective: 'Organizar o projeto de forma estruturada e garantir rastreabilidade sobre aquilo que precisa ser realizado.',
  },
  bpmn: {
    key: 'bpmn',
    title: 'Mapeamento BPMN',
    whatIs: 'Esta área é utilizada para representar visualmente como um processo funciona utilizando a notação BPMN 2.0.',
    whatToDo: 'Construa o fluxo do processo representando atividades, responsáveis, decisões, eventos e demais elementos necessários. Quando aplicável, identifique também etapas que representam problemas do processo.',
    objective: 'Tornar o processo visível e estruturado para análise, melhoria e acompanhamento.',
    actionText: 'Precisa de ajuda para escolher os elementos? → Abrir Aprenda BPMN',
    actionType: 'open_bpmn_learn',
  },
  etapaProblema: {
    key: 'etapaProblema',
    title: 'Etapa Problema',
    whatIs: 'Indica que determinada etapa do processo possui um problema que precisa ser investigado e tratado.',
    whatToDo: 'Marque como Etapa Problema apenas quando houver uma situação que realmente precise de análise e tratamento.',
    objective: 'Permitir que o problema identificado no mapeamento seja conectado ao processo de investigação e melhoria por meio do PDCA.',
  },
  pdca: {
    key: 'pdca',
    title: 'PDCA',
    whatIs: 'O PDCA é utilizado para estruturar a investigação e o tratamento de problemas, desde o planejamento até a verificação dos resultados.',
    whatToDo: 'Avance pelas etapas PLAN, DO, CHECK e ACT registrando as informações necessárias para investigar, executar, acompanhar e concluir a melhoria.',
    objective: 'Garantir que problemas sejam tratados de forma estruturada, com análise, plano de ação, acompanhamento e medição de resultados.',
  },
  plan: {
    key: 'plan',
    title: 'PLAN — Planejar',
    whatIs: 'Etapa onde o problema é compreendido e o tratamento é planejado.',
    whatToDo: 'Analise o problema, investigue suas causas, avalie impactos e defina o que precisa ser realizado.',
    objective: 'Criar um plano de ação baseado na causa real do problema e nos resultados esperados.',
  },
  causaRaiz: {
    key: 'causaRaiz',
    title: 'Causa Raiz',
    whatIs: 'Esta etapa serve para investigar por que o problema realmente aconteceu, evitando tratar apenas sintomas ou consequências.',
    whatToDo: 'Escolha a metodologia mais adequada, analise as possíveis causas e registre a causa fundamental identificada.',
    objective: 'Garantir que o plano de ação seja direcionado ao motivo real do problema.',
    tip: 'Não considere automaticamente a primeira causa encontrada como causa raiz.',
  },
  impacto: {
    key: 'impacto',
    title: 'Impacto',
    whatIs: 'Esta etapa registra quais consequências o problema gera para o processo ou para a empresa.',
    whatToDo: 'Avalie se o impacto é tangível, intangível ou possui os dois tipos e registre as informações que permitam compreender sua relevância.',
    objective: 'Demonstrar a dimensão do problema e criar uma base para comparar os resultados obtidos após as ações de melhoria.',
  },
  do: {
    key: 'do',
    title: 'DO — Executar',
    whatIs: 'Etapa onde as ações planejadas são colocadas em prática.',
    whatToDo: 'Execute e acompanhe as ações definidas no planejamento, atualizando as informações conforme a evolução do trabalho.',
    objective: 'Garantir que o plano definido no PLAN seja realmente executado e acompanhado.',
  },
  check: {
    key: 'check',
    title: 'CHECK — Verificar',
    whatIs: 'Etapa utilizada para avaliar se as ações executadas realmente produziram o resultado esperado.',
    whatToDo: 'Acompanhe os resultados, registre evidências e compare o realizado com aquilo que havia sido planejado.',
    objective: 'Confirmar se a solução funcionou, funcionou parcialmente ou não atingiu o resultado esperado.',
  },
  act: {
    key: 'act',
    title: 'ACT — Agir',
    whatIs: 'Etapa de conclusão e consolidação do ciclo PDCA.',
    whatToDo: 'Avalie o resultado final e registre as decisões necessárias após a verificação.',
    objective: 'Consolidar o aprendizado obtido no ciclo e garantir o tratamento adequado após a análise dos resultados.',
  },
  historicoAcoes: {
    key: 'historicoAcoes',
    title: 'Histórico de Ações',
    whatIs: 'Esta área organiza as ações dos projetos e funciona como uma ferramenta operacional para acompanhamento das atividades.',
    whatToDo: 'Consulte suas ações, acompanhe prazos, atualize status e identifique atividades pendentes, em andamento, atrasadas, próximas do vencimento e concluídas.',
    objective: 'Permitir que o usuário saiba rapidamente: o que precisa fazer, de qual projeto, dentro de qual prazo e qual é a situação das ações.',
  },
  dashboard: {
    key: 'dashboard',
    title: 'Dashboard',
    whatIs: 'Esta área apresenta uma visão consolidada dos projetos, indicadores, resultados e ganhos registrados no GIP Flow.',
    whatToDo: 'Utilize os indicadores e filtros para acompanhar desempenho, identificar pontos de atenção e analisar os resultados das iniciativas.',
    objective: 'Transformar os dados registrados no sistema em informações gerenciais para acompanhamento e tomada de decisão.',
  },
  ganhos: {
    key: 'ganhos',
    title: 'Ganhos',
    whatIs: 'Esta visão consolida os resultados gerados pelos ciclos PDCA e pelos projetos.',
    whatToDo: 'Acompanhe os ganhos realizados, resultados positivos ou negativos e sua distribuição entre os projetos.',
    objective: 'Demonstrar o impacto efetivamente gerado pelas iniciativas de melhoria.',
  },
  relatorios: {
    key: 'relatorios',
    title: 'Relatórios',
    whatIs: 'Esta área permite consultar informações consolidadas registradas no sistema.',
    whatToDo: 'Utilize os relatórios disponíveis para analisar projetos, ações, PDCAs, resultados ou demais informações permitidas ao seu perfil.',
    objective: 'Facilitar análise, acompanhamento e compartilhamento das informações registradas no GIP Flow.',
  },
  arquivos: {
    key: 'arquivos',
    title: 'Arquivos do Projeto',
    whatIs: 'Área destinada ao armazenamento de documentos e evidências relacionados ao projeto.',
    whatToDo: 'Anexe arquivos necessários para apoiar, documentar ou comprovar as atividades realizadas durante o projeto.',
    objective: 'Centralizar documentos relevantes e manter as informações do projeto organizadas e rastreáveis.',
  },
  monitoramento: {
    key: 'monitoramento',
    title: 'Monitoramento de Usuários',
    whatIs: 'Esta área permite acompanhar a utilização do GIP Flow pelos usuários autorizados.',
    whatToDo: 'Consulte informações de acesso e atividades relevantes registradas pelo sistema.',
    objective: 'Entender a utilização da ferramenta e apoiar o acompanhamento da adoção do GIP Flow.',
  }
};
