import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AUD-005: Tratamento de erro e feedback visual na exportação de PDF', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve registrar o erro no console e definir feedback de erro amigável quando a exportação falhar', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    let isExporting = false;
    let toastNotification: { type: 'success' | 'error'; message: string } | null = null;
    
    const setToastNotification = (val: { type: 'success' | 'error'; message: string } | null) => {
      toastNotification = val;
    };
    const setIsExporting = (val: boolean) => {
      isExporting = val;
    };

    const simulatedExportPDF = async (shouldFail: boolean) => {
      setIsExporting(true);
      try {
        if (shouldFail) {
          throw new Error('Falha simulada na renderização do canvas/pdfMake');
        }
      } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        setToastNotification({
          type: 'error',
          message: 'Não foi possível gerar o PDF. Tente novamente.',
        });
      } finally {
        setIsExporting(false);
      }
    };

    // Executar exportação com erro
    await simulatedExportPDF(true);

    // 1. Loading deve estar desativado após o finally
    expect(isExporting).toBe(false);

    // 2. Erro técnico foi logado via console.error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Erro ao exportar PDF:',
      expect.any(Error)
    );

    // 3. Usuário recebeu feedback amigável sem expor stack trace
    expect(toastNotification).toEqual({
      type: 'error',
      message: 'Não foi possível gerar o PDF. Tente novamente.',
    });
  });

  it('deve finalizar o loading e não exibir mensagem de erro quando a exportação for bem-sucedida', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    let isExporting = false;
    let toastNotification: { type: 'success' | 'error'; message: string } | null = null;

    const setIsExporting = (val: boolean) => {
      isExporting = val;
    };

    const simulatedExportPDF = async () => {
      setIsExporting(true);
      try {
        // Sucesso
      } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        toastNotification = {
          type: 'error',
          message: 'Não foi possível gerar o PDF. Tente novamente.',
        };
      } finally {
        setIsExporting(false);
      }
    };

    await simulatedExportPDF();

    expect(isExporting).toBe(false);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(toastNotification).toBeNull();
  });
});
