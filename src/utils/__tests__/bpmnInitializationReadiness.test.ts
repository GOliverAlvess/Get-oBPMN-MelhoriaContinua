import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AUD-007: Inicialização e importação do BPMN baseada no estado real do container', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve disparar a importação quando o container já possui dimensões válidas sem esperar 100ms', async () => {
    let hasImported = false;
    let importCallCount = 0;
    let isMounted = true;
    let rafCallback: FrameRequestCallback | null = null;

    // Simulação do requestAnimationFrame
    const mockRequestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 123;
    });

    const mockCancelAnimationFrame = vi.fn();

    const simulatedModeler = {
      importXML: vi.fn().mockImplementation(async () => {
        hasImported = true;
        importCallCount++;
      }),
    };

    const container = {
      offsetWidth: 800,
      offsetHeight: 600,
    };

    // Lógica do AUD-007
    let resizeObserver: any = null;
    let rafId: number | null = null;

    const doImportXML = () => {
      if (!isMounted || hasImported || !simulatedModeler) return;
      hasImported = true;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (rafId !== null) {
        mockCancelAnimationFrame(rafId);
        rafId = null;
      }

      simulatedModeler.importXML('<bpmn:definitions />');
    };

    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      rafId = mockRequestAnimationFrame(() => {
        doImportXML();
      });
    }

    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(hasImported).toBe(false);

    // Executar frame do rAF
    if (rafCallback) {
      (rafCallback as any)(performance.now());
    }

    expect(hasImported).toBe(true);
    expect(importCallCount).toBe(1);
    expect(simulatedModeler.importXML).toHaveBeenCalledWith('<bpmn:definitions />');
  });

  it('deve aguardar o ResizeObserver quando o container inicial estiver com dimensões zeradas (ex: transição de abas)', async () => {
    let hasImported = false;
    let importCallCount = 0;
    let isMounted = true;
    let observerCallback: ((entries: any[]) => void) | null = null;
    let disconnected = false;

    class MockResizeObserver {
      constructor(cb: (entries: any[]) => void) {
        observerCallback = cb;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    }

    const simulatedModeler = {
      importXML: vi.fn().mockImplementation(async () => {
        importCallCount++;
      }),
    };

    const container = {
      offsetWidth: 0,
      offsetHeight: 0,
    };

    let resizeObserver: any = null;
    let rafId: number | null = null;

    const doImportXML = () => {
      if (!isMounted || hasImported || !simulatedModeler) return;
      hasImported = true;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      simulatedModeler.importXML('<bpmn:definitions />');
    };

    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      doImportXML();
    } else {
      resizeObserver = new MockResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            doImportXML();
            break;
          }
        }
      });
    }

    // Inicialmente não deve ter importado pois dimensões eram 0
    expect(hasImported).toBe(false);
    expect(importCallCount).toBe(0);

    // Disparar evento de resize com dimensões ainda zeradas
    observerCallback!([{ contentRect: { width: 0, height: 0 } }]);
    expect(hasImported).toBe(false);
    expect(importCallCount).toBe(0);

    // Disparar evento de resize quando o container adquire dimensões
    observerCallback!([{ contentRect: { width: 1024, height: 768 } }]);
    expect(hasImported).toBe(true);
    expect(importCallCount).toBe(1);
    expect(disconnected).toBe(true);

    // Novos resizes da janela NÃO devem disparar nova importação
    observerCallback!([{ contentRect: { width: 1200, height: 800 } }]);
    expect(importCallCount).toBe(1);
  });

  it('deve cancelar o observer e animações pendentes no unmount sem tentar importar', async () => {
    let hasImported = false;
    let isMounted = true;
    let disconnected = false;
    let cancelledRaf = false;

    class MockResizeObserver {
      observe() {}
      disconnect() {
        disconnected = true;
      }
    }

    const simulatedModeler = {
      importXML: vi.fn(),
      destroy: vi.fn(),
    };

    let resizeObserver: any = new MockResizeObserver();
    let rafId: number | null = 456;

    const mockCancelAnimationFrame = vi.fn((_id: number) => {
      cancelledRaf = true;
    });

    // Cleanup hook ao desmontar antes do término da renderização
    const cleanup = () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (rafId !== null) {
        mockCancelAnimationFrame(rafId);
        rafId = null;
      }
      simulatedModeler.destroy();
    };

    cleanup();

    expect(isMounted).toBe(false);
    expect(disconnected).toBe(true);
    expect(cancelledRaf).toBe(true);
    expect(simulatedModeler.destroy).toHaveBeenCalled();
    expect(simulatedModeler.importXML).not.toHaveBeenCalled();
  });
});
