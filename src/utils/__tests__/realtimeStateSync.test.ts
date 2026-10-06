import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  db,
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  handleIncomingMutation,
} from '../../firebase';

describe('AUD-003: Sincronização em tempo real via SSE (State Sync & Fonte de Verdade)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const waitForAsync = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

  it('deve eliminar propriedades removidas no backend e NÃO manter campos antigos (eliminação de shallow merge)', async () => {
    const colRef = collection(db, 'projects');
    const receivedSnapshots: any[] = [];

    // Mock initial getDocs
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 'proj_1',
          name: 'Projeto Alfa',
          descricao: 'Descrição antiga',
          campoRemovido: 'valorQueFoiApagado',
          status: 'Em andamento',
        },
      ],
    } as Response));

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      receivedSnapshots.push(snapshot.docs.map((d: any) => d.data()));
    });

    await waitForAsync();

    // 1ª emissão inicial (resync)
    expect(receivedSnapshots.length).toBe(1);
    expect(receivedSnapshots[0][0].campoRemovido).toBe('valorQueFoiApagado');

    // Backend atualiza e transmite novo snapshot do documento ONDE campoRemovido NÃO existe mais
    handleIncomingMutation({
      collection: 'projects',
      id: 'proj_1',
      type: 'update',
      data: {
        id: 'proj_1',
        name: 'Projeto Alfa Atualizado',
        descricao: 'Descrição antiga',
        status: 'Concluído',
      },
    });

    // 2ª emissão via SSE
    expect(receivedSnapshots.length).toBe(2);
    const latestDoc = receivedSnapshots[1][0];

    expect(latestDoc.name).toBe('Projeto Alfa Atualizado');
    expect(latestDoc.status).toBe('Concluído');
    // Campo removido no backend NÃO deve sobreviver no cliente
    expect(latestDoc.campoRemovido).toBeUndefined();
    expect('campoRemovido' in latestDoc).toBe(false);

    unsubscribe();
  });

  it('deve refletir remoção de itens em arrays (ex: ações / subtarefas) sem ressuscitar itens antigos', async () => {
    const colRef = collection(db, 'projects');
    let currentData: any = null;

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 'proj_2',
          name: 'Projeto Beta',
          acoes: [
            { id: 'act_1', title: 'Ação 1' },
            { id: 'act_2', title: 'Ação 2' },
            { id: 'act_3', title: 'Ação 3' },
          ],
        },
      ],
    } as Response));

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      currentData = snapshot.docs[0]?.data();
    });

    await waitForAsync();

    expect(currentData.acoes.length).toBe(3);

    // Usuário A remove act_2 no backend -> SSE transmite o documento atualizado com apenas [act_1, act_3]
    handleIncomingMutation({
      collection: 'projects',
      id: 'proj_2',
      type: 'update',
      data: {
        id: 'proj_2',
        name: 'Projeto Beta',
        acoes: [
          { id: 'act_1', title: 'Ação 1' },
          { id: 'act_3', title: 'Ação 3' },
        ],
      },
    });

    expect(currentData.acoes).toEqual([
      { id: 'act_1', title: 'Ação 1' },
      { id: 'act_3', title: 'Ação 3' },
    ]);
    expect(currentData.acoes.some((a: any) => a.id === 'act_2')).toBe(false);

    unsubscribe();
  });

  it('deve sincronizar estruturas aninhadas (ex: PDCA Plan / Ishikawa / 5 Porquês) substituindo o estado', async () => {
    const docRef = doc(db, 'projects', 'pdca_proj');
    let latestDocData: any = null;

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'pdca_proj',
        plan: {
          problem: 'Queda de produtividade',
          causes: ['Causa 1', 'Causa 2 (errônea)', 'Causa 3'],
          details: { author: 'Gabriel', validated: true },
        },
      }),
    } as Response));

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      latestDocData = snapshot.data();
    });

    await waitForAsync();

    expect(latestDocData.plan.causes).toEqual(['Causa 1', 'Causa 2 (errônea)', 'Causa 3']);

    // Backend atualiza e remove a causa errônea e remove 'details'
    handleIncomingMutation({
      collection: 'projects',
      id: 'pdca_proj',
      type: 'update',
      data: {
        id: 'pdca_proj',
        plan: {
          problem: 'Queda de produtividade resolvida',
          causes: ['Causa 1', 'Causa 3'],
        },
      },
    });

    expect(latestDocData.plan.problem).toBe('Queda de produtividade resolvida');
    expect(latestDocData.plan.causes).toEqual(['Causa 1', 'Causa 3']);
    expect(latestDocData.plan.details).toBeUndefined();

    unsubscribe();
  });

  it('deve processar eventos de DELETE corretamente no listener de coleção e no listener de documento', async () => {
    const colRef = collection(db, 'operationalActions');
    const docRef = doc(db, 'operationalActions', 'act_del');

    let colDocs: any[] = [];
    let singleDoc: any = null;

    global.fetch = vi.fn(async (url: any) => {
      if (url.toString().includes('/operationalActions/act_del')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'act_del', title: 'Ação a ser excluída' }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: 'act_del', title: 'Ação a ser excluída' },
          { id: 'act_keep', title: 'Ação mantida' },
        ],
      } as Response;
    });

    const unsubCol = onSnapshot(colRef, (snapshot) => {
      colDocs = snapshot.docs.map((d: any) => d.data());
    });
    const unsubDoc = onSnapshot(docRef, (snapshot) => {
      singleDoc = snapshot.data();
    });

    await waitForAsync();

    expect(colDocs.length).toBe(2);
    expect(singleDoc).toEqual({ id: 'act_del', title: 'Ação a ser excluída' });

    // Emissão de evento delete
    handleIncomingMutation({
      collection: 'operationalActions',
      id: 'act_del',
      type: 'delete',
      data: null,
    });

    expect(colDocs.length).toBe(1);
    expect(colDocs[0].id).toBe('act_keep');
    expect(singleDoc).toBeNull();

    unsubCol();
    unsubDoc();
  });

  it('deve respeitar cláusulas where e orderBy ao receber mutações SSE', async () => {
    const q = query(
      collection(db, 'tasks'),
      where('status', '==', 'Pendente'),
      orderBy('order', 'asc')
    );

    let queryDocs: any[] = [];

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { id: 't1', title: 'Tarefa 1', status: 'Pendente', order: 10 },
        { id: 't2', title: 'Tarefa 2', status: 'Pendente', order: 20 },
      ],
    } as Response));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      queryDocs = snapshot.docs.map((d: any) => d.data());
    });

    await waitForAsync();

    expect(queryDocs.map((d) => d.id)).toEqual(['t1', 't2']);

    // Adiciona nova tarefa que atende à query com order 5 (deve ficar em primeiro)
    handleIncomingMutation({
      collection: 'tasks',
      id: 't0',
      type: 'set',
      data: { id: 't0', title: 'Tarefa Urgente', status: 'Pendente', order: 5 },
    });

    expect(queryDocs.map((d) => d.id)).toEqual(['t0', 't1', 't2']);

    // Atualiza t1 para status 'Concluído' -> deve ser removida da query Pendente
    handleIncomingMutation({
      collection: 'tasks',
      id: 't1',
      type: 'update',
      data: { id: 't1', title: 'Tarefa 1', status: 'Concluído', order: 10 },
    });

    expect(queryDocs.map((d) => d.id)).toEqual(['t0', 't2']);

    unsubscribe();
  });

  it('não deve disparar requisições ou mutações automáticas ao receber SSE (prevenção de loop)', async () => {
    const colRef = collection(db, 'projects');
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 'p1', name: 'Projeto' }],
    } as Response));
    global.fetch = fetchSpy;

    const unsubscribe = onSnapshot(colRef, () => {});
    await waitForAsync();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // apenas o resync inicial

    // Recebe 5 eventos SSE em sequência
    for (let i = 1; i <= 5; i++) {
      handleIncomingMutation({
        collection: 'projects',
        id: 'p1',
        type: 'update',
        data: { id: 'p1', name: `Projeto V${i}` },
      });
    }

    // Não deve disparar nenhuma requisição fetch adicional
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
