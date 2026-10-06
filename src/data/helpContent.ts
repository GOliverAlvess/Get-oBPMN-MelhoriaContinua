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
    whatIs: 'Painel gerencial e auditável para acompanhamento de utilização efetiva, tempo ativo real, acessos e operações no GIP Flow.',
    whatToDo: 'Consulte quem está ativo agora (interação nos últimos 5 min), tempo ativo acumulado, dias ativos, sessões válidas e histórico de ações.',
    objective: 'Medir a adoção e utilização real do GIP Flow com base em critérios objetivos e transparentes, diferenciando presença ativa de simples tela aberta.',
    tip: 'O sistema pausa a contagem de tempo ativo automaticamente se o usuário ficar mais de 5 minutos sem interagir ou se a aba for para segundo plano.',
  },
  ganhosNoPeriodo: {
    key: 'ganhosNoPeriodo',
    title: 'Ganhos no Período',
    whatIs: 'Soma dos resultados financeiros positivos efetivamente reconhecidos no período selecionado, considerando os PDCAs com resultado financeiro registrado.',
    whatToDo: 'Analise os valores financeiros positivos trazidos pelas melhorias.',
    objective: 'Mensurar o retorno positivo gerado pelas iniciativas de melhoria.',
  },
  perdasNoPeriodo: {
    key: 'perdasNoPeriodo',
    title: 'Perdas no Período',
    whatIs: 'Soma dos resultados financeiros negativos identificados nos projetos durante o período selecionado.',
    whatToDo: 'Acompanhe aumentos de custo ou perdas financeiras identificadas nos projetos.',
    objective: 'Identificar impactos financeiros negativos para direcionar planos de contenção.',
  },
  saldoFinanceiro: {
    key: 'saldoFinanceiro',
    title: 'Saldo Financeiro',
    whatIs: 'Resultado líquido entre ganhos e perdas dos projetos no período selecionado.',
    whatToDo: 'Avalie o resultado consolidado (Ganhos - Perdas) das iniciativas no período.',
    objective: 'Demonstrar o valor financeiro líquido final gerado pelas melhorias.',
  },
  projetosComResultadoFinanceiro: {
    key: 'projetosComResultadoFinanceiro',
    title: 'Projetos com Resultado Financeiro',
    whatIs: 'Quantidade de projetos que possuem pelo menos um PDCA com ganho ou perda financeira registrada.',
    whatToDo: 'Veja a proporção de projetos que geraram resultado financeiro mensurado.',
    objective: 'Acompanhar a abrangência das iniciativas com impacto financeiro.',
  },
  resultadoPorProjeto: {
    key: 'resultadoPorProjeto',
    title: 'Resultado Financeiro por Projeto',
    whatIs: 'Mostra quanto cada projeto contribuiu para o resultado financeiro geral. Valores positivos representam ganhos e valores negativos representam perdas.',
    whatToDo: 'Compare o desempenho financeiro de cada projeto individualmente.',
    objective: 'Identificar quais projetos foram os maiores geradores de valor ou tiveram variações de custo.',
  },
  evolucaoFinanceira: {
    key: 'evolucaoFinanceira',
    title: 'Evolução Financeira',
    whatIs: 'Mostra como os ganhos e perdas reconhecidos evoluíram ao longo dos meses.',
    whatToDo: 'Acompanhe a trajetória mês a mês dos resultados financeiros consolidados.',
    objective: 'Visualizar a tendência e o acúmulo de resultados ao longo do tempo.',
  }
};
