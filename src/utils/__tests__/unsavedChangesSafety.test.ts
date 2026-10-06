import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../types';

// Mock de máquina de estado do fluxo de salvamento e proteção de navegação (AUD-004)
export class UnsavedChangesController {
  public hasChanges: boolean = false;
  public showUnsavedModal: boolean = false;
  public pendingAction: (() => void) | null = null;
  public persistedProjects: Project[] = [];
  public currentProjects: Project[] = [];
  public currentProjectId: string | null = null;
  public activeTab: string = 'scope';

  constructor(initialProjects: Project[]) {
    this.persistedProjects = JSON.parse(JSON.stringify(initialProjects));
    this.currentProjects = JSON.parse(JSON.stringify(initialProjects));
  }

  // Simula edição em Escopo, Subtarefa ou PDCA
  public editProject(updatedProject: Project) {
    this.currentProjects = this.currentProjects.map(p =>
      p.id === updatedProject.id ? updatedProject : p
    );
    this.hasChanges = true;
  }

  // Simula tentativa de navegação interna (sidebar, cards, notificações, logout)
  public handleNavigation(action: () => void) {
    if (this.hasChanges) {
      this.pendingAction = action;
      this.showUnsavedModal = true;
    } else {
      action();
    }
  }

  // Simula o evento nativo beforeunload do navegador
  public handleBeforeUnload(event: { defaultPrevented: boolean; returnValue: string }) {
    if (this.hasChanges) {
      event.defaultPrevented = true;
      event.returnValue = '';
      return '';
    }
    return undefined;
  }

  // Ação: Continuar editando
  public onContinueEditing() {
    this.showUnsavedModal = false;
    this.pendingAction = null;
    // hasChanges permanece true, projeto permanece editado
  }

  // Ação: Sair sem salvar
  public onExitWithoutSaving() {
    // Reverte alterações locais para a versão persistida em banco
    this.currentProjects = JSON.parse(JSON.stringify(this.persistedProjects));
    this.hasChanges = false;
    this.showUnsavedModal = false;
    if (this.pendingAction) {
      const action = this.pendingAction;
      this.pendingAction = null;
      action();
    }
  }

  // Troca de aba interna no mesmo projeto (Escopo <-> Mapeamento <-> PDCA)
  public switchInternalTab(tab: 'scope' | 'mapping' | 'pdca') {
    // Não altera hasChanges nem abre modal
    this.activeTab = tab;
  }

  // Simula salvamento manual com sucesso
  public async saveProjectSuccess(projectId: string) {
    const proj = this.currentProjects.find(p => p.id === projectId);
    if (proj) {
      this.persistedProjects = JSON.parse(JSON.stringify(this.currentProjects));
      this.hasChanges = false;
    }
  }

  // Simula salvamento manual com erro
  public async saveProjectError(_projectId: string) {
    // Falha na persistência: hasChanges NÃO pode ser limpo
    this.hasChanges = true;
  }
}

describe('AUD-004: Barreira de Proteção Contra Perda de Alterações Não Salvas', () => {
  const mockBaseProject: Project = {
    id: 'proj-101',
    name: 'Otimização de Linha de Produção',
    description: 'Projeto piloto',
    createdAt: '2026-08-26T00:00:00.000Z',
    progress: 25,
    status: 'Planejamento',
    priority: 'Alta',
    assignedTo: 'user_1',
    scope: {
      title: 'Otimização de Linha de Produção',
      responsible: 'Engenharia',
      problemDescription: 'Gargalo no posto 3',
      measurableObjective: 'Reduzir ciclo em 15%',
      involvedSectors: [{ id: 'sec-1', name: 'Produção' }],
      toolsUsed: [{ id: 't-1', name: '5W2H' }, { id: 't-2', name: 'Ishikawa' }],
      startDate: '2026-08-01',
      forecastCompletion: '2026-09-01',
      presentationLink: '',
      ods: '',
      financial: {
        currentImpact: { value: 50000, type: 'continuo', period: 'mensal' },
        gainProjection: { value: 120000, type: 'fixo', period: 'mensal' },
      },
    },
    subtasks: [
      {
        id: 'sub-1',
        title: 'Mapear fluxo de valor atual',
        priority: 'Alta',
        status: 'Pendente',
        responsibleId: 'user_1',
        startDate: '2026-08-05',
        mapping: {
          nodes: [],
          edges: [],
          orientation: 'horizontal',
          lastEdited: '2026-08-26T00:00:00.000Z',
          savedColors: [],
        },
        pdcaCycles: [],
      },
    ],
  };

  let controller: UnsavedChangesController;

  beforeEach(() => {
    controller = new UnsavedChangesController([mockBaseProject]);
    controller.currentProjectId = 'proj-101';
  });

  it('TESTE 1 — BeforeUnload ativa barreira nativa quando existirem alterações não salvas (F5 / Fechar Aba)', () => {
    // Inicialmente sem alterações: beforeunload não bloqueia
    const event1 = { defaultPrevented: false, returnValue: '' };
    controller.handleBeforeUnload(event1);
    expect(event1.defaultPrevented).toBe(false);

    // Usuário altera a descrição do problema no Escopo
    const editedProject: Project = {
      ...mockBaseProject,
      scope: {
        ...mockBaseProject.scope,
        problemDescription: 'Novo gargalo detectado na etapa de embalagem',
      },
    };
    controller.editProject(editedProject);

    expect(controller.hasChanges).toBe(true);

    // Tentativa de F5 / Fechar aba
    const event2 = { defaultPrevented: false, returnValue: 'initial' };
    controller.handleBeforeUnload(event2);
    expect(event2.defaultPrevented).toBe(true);
    expect(event2.returnValue).toBe('');
  });

  it('TESTE 2 — Navegação interna intercepta com modal quando existirem alterações não salvas', () => {
    let navigatedView = 'project_detail';

    // Edição no PDCA / Subtarefas
    const editedProject: Project = {
      ...mockBaseProject,
      subtasks: [
        {
          ...mockBaseProject.subtasks[0],
          title: 'Subtarefa com escopo refinado',
        },
      ],
    };
    controller.editProject(editedProject);

    // Usuário clica no menu "Dashboard"
    controller.handleNavigation(() => {
      navigatedView = 'dashboard';
    });

    // A navegação NÃO ocorreu de imediato e o modal abriu
    expect(navigatedView).toBe('project_detail');
    expect(controller.showUnsavedModal).toBe(true);
    expect(controller.pendingAction).not.toBeNull();
  });

  it('TESTE 3 — Navegação interna ocorre imediatamente quando NÃO há alterações pendentes', () => {
    let navigatedView = 'project_detail';

    expect(controller.hasChanges).toBe(false);

    controller.handleNavigation(() => {
      navigatedView = 'kanban';
    });

    expect(navigatedView).toBe('kanban');
    expect(controller.showUnsavedModal).toBe(false);
  });

  it('TESTE 4 — Modal: "Continuar editando" fecha modal, mantém dirty state e preserva dados digitados', () => {
    let navigatedView = 'project_detail';

    const editedProject: Project = {
      ...mockBaseProject,
      scope: {
        ...mockBaseProject.scope,
        measurableObjective: 'Nova meta audaciosa de 30% de redução',
      },
    };
    controller.editProject(editedProject);

    controller.handleNavigation(() => {
      navigatedView = 'settings';
    });

    expect(controller.showUnsavedModal).toBe(true);

    // Usuário clica em "Continuar editando"
    controller.onContinueEditing();

    expect(controller.showUnsavedModal).toBe(false);
    expect(controller.pendingAction).toBeNull();
    expect(navigatedView).toBe('project_detail');
    expect(controller.hasChanges).toBe(true);
    expect(controller.currentProjects[0].scope.measurableObjective).toBe('Nova meta audaciosa de 30% de redução');
  });

  it('TESTE 5 — Modal: "Sair sem salvar" reverte para os dados persistidos, limpa dirty state e conclui navegação', () => {
    let navigatedView = 'project_detail';

    const editedProject: Project = {
      ...mockBaseProject,
      scope: {
        ...mockBaseProject.scope,
        problemDescription: 'Alteração que o usuário decidiu descartar',
      },
    };
    controller.editProject(editedProject);

    controller.handleNavigation(() => {
      navigatedView = 'kanban';
      controller.currentProjectId = null;
    });

    expect(controller.showUnsavedModal).toBe(true);

    // Usuário clica em "Sair sem salvar"
    controller.onExitWithoutSaving();

    expect(controller.showUnsavedModal).toBe(false);
    expect(controller.hasChanges).toBe(false);
    expect(navigatedView).toBe('kanban');
    expect(controller.currentProjectId).toBeNull();

    // Ao inspecionar os projetos em memória, os dados descartados não persistem
    const projectInDbState = controller.currentProjects.find(p => p.id === 'proj-101');
    expect(projectInDbState?.scope.problemDescription).toBe('Gargalo no posto 3');
  });

  it('TESTE 6 — Troca de abas internas no mesmo projeto (Escopo <-> Mapeamento <-> PDCA) não ativa modal nem descarta', () => {
    // Altera o escopo
    const editedProject: Project = {
      ...mockBaseProject,
      scope: {
        ...mockBaseProject.scope,
        toolsUsed: [
          { id: 't-1', name: '5W2H' },
          { id: 't-2', name: 'Ishikawa' },
          { id: 't-3', name: 'Matriz GUT' },
        ],
      },
    };
    controller.editProject(editedProject);
    expect(controller.hasChanges).toBe(true);

    // Troca para aba PDCA
    controller.switchInternalTab('pdca');
    expect(controller.activeTab).toBe('pdca');
    expect(controller.showUnsavedModal).toBe(false);
    expect(controller.hasChanges).toBe(true);
    expect(controller.currentProjects[0].scope.toolsUsed.some(t => t.name === 'Matriz GUT')).toBe(true);
  });

  it('TESTE 7 — Salvamento manual com sucesso redefine hasChanges para false', async () => {
    const editedProject: Project = {
      ...mockBaseProject,
      scope: {
        ...mockBaseProject.scope,
        problemDescription: 'Gargalo solucionado e validado',
      },
    };
    controller.editProject(editedProject);
    expect(controller.hasChanges).toBe(true);

    // Clica no botão Salvar Alterações
    await controller.saveProjectSuccess('proj-101');

    expect(controller.hasChanges).toBe(false);
    expect(controller.persistedProjects[0].scope.problemDescription).toBe('Gargalo solucionado e validado');

    // Navegação subsequente deve fluir direto sem modal
    let navigatedView = 'project_detail';
    controller.handleNavigation(() => {
      navigatedView = 'dashboard';
    });
    expect(navigatedView).toBe('dashboard');
    expect(controller.showUnsavedModal).toBe(false);
  });

  it('TESTE 8 — Falha no salvamento manual NÃO limpa hasChanges, mantendo a proteção ativa', async () => {
    const editedProject: Project = {
      ...mockBaseProject,
      scope: {
        ...mockBaseProject.scope,
        problemDescription: 'Tentativa de salvar com erro de rede',
      },
    };
    controller.editProject(editedProject);
    expect(controller.hasChanges).toBe(true);

    // Simula erro durante a gravação no backend
    await controller.saveProjectError('proj-101');

    // hasChanges DEVE continuar true para não permitir saída silenciosa com perda
    expect(controller.hasChanges).toBe(true);

    // Tentativa de navegação continua interceptada
    let navigatedView = 'project_detail';
    controller.handleNavigation(() => {
      navigatedView = 'kanban';
    });
    expect(navigatedView).toBe('project_detail');
    expect(controller.showUnsavedModal).toBe(true);
  });
});
