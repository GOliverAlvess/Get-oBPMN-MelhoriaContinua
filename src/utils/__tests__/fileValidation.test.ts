import { describe, it, expect } from 'vitest';
import { 
  validateUploadFile, 
  isFileTypeSupported, 
  resolveFileMimeType, 
  getFileExtension,
  MAX_FILE_SIZE_BYTES,
  ACCEPT_FILE_STRING
} from '../../lib/fileValidation';

describe('Validação de Upload de Arquivos (.pptx, documentos, imagens e compactados)', () => {
  describe('Suporte a Apresentações PowerPoint (.pptx e .ppt)', () => {
    it('deve aceitar arquivo real .pptx com MIME type oficial do PowerPoint', () => {
      const result = validateUploadFile({
        name: 'Projeto Loja Ativa.pptx',
        size: 4.7 * 1024 * 1024, // ~4.70 MB
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve aceitar .pptx quando o navegador envia MIME genérico (application/octet-stream ou application/x-zip-compressed)', () => {
      const resultOctet = validateUploadFile({
        name: 'Projeto Loja Ativa.pptx',
        size: 4.7 * 1024 * 1024,
        type: 'application/octet-stream'
      });
      expect(resultOctet.valid).toBe(true);

      const resultZip = validateUploadFile({
        name: 'Projeto Loja Ativa.pptx',
        size: 4.7 * 1024 * 1024,
        type: 'application/x-zip-compressed'
      });
      expect(resultZip.valid).toBe(true);
    });

    it('deve aceitar .pptx quando o MIME type for vazio string ""', () => {
      const result = validateUploadFile({
        name: 'Projeto Loja Ativa.pptx',
        size: 4.7 * 1024 * 1024,
        type: ''
      });
      expect(result.valid).toBe(true);
    });

    it('deve ser case-insensitive para a extensão (.pptx, .PPTX, .Pptx, .PPT)', () => {
      expect(isFileTypeSupported('APRESENTACAO.PPTX')).toBe(true);
      expect(isFileTypeSupported('Slides_Finais.Pptx')).toBe(true);
      expect(isFileTypeSupported('relatorio.ppt')).toBe(true);
      expect(isFileTypeSupported('relatorio.PPSX')).toBe(true);
    });

    it('deve resolver o MIME Type canônico para envio ao Google Drive', () => {
      expect(resolveFileMimeType('Projeto Loja Ativa.pptx', 'application/octet-stream'))
        .toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');

      expect(resolveFileMimeType('apresentacao.ppt'))
        .toBe('application/vnd.ms-powerpoint');
    });
  });

  describe('Validação de Limite de Tamanho (100 MB)', () => {
    it('deve aceitar arquivos dentro do limite de 100 MB', () => {
      const validFile = validateUploadFile({
        name: 'ApresentacaoGrande.pptx',
        size: 99 * 1024 * 1024 // 99 MB
      });
      expect(validFile.valid).toBe(true);
    });

    it('deve aceitar arquivo exatamente no limite de 100 MB', () => {
      const limitFile = validateUploadFile({
        name: 'ApresentacaoNoLimite.pptx',
        size: MAX_FILE_SIZE_BYTES
      });
      expect(limitFile.valid).toBe(true);
    });

    it('deve recusar arquivos acima de 100 MB com a mensagem exata requerida', () => {
      const oversizedFile = validateUploadFile({
        name: 'ApresentacaoPesada.pptx',
        size: 101 * 1024 * 1024 // 101 MB
      });
      expect(oversizedFile.valid).toBe(false);
      expect(oversizedFile.error).toContain('excede o limite máximo permitido para upload (100 MB)');
    });
  });

  describe('Outros Formatos Suportados (Não-regressão)', () => {
    it('deve aceitar PDF, DOCX, XLSX, imagens, CSV e arquivos compactados', () => {
      const supportedFiles = [
        'documento.pdf',
        'especificacao.docx',
        'tabela.xlsx',
        'grafico.png',
        'foto.jpg',
        'diagrama.svg',
        'dados.csv',
        'backup.zip'
      ];

      for (const file of supportedFiles) {
        expect(isFileTypeSupported(file)).toBe(true);
        expect(validateUploadFile({ name: file, size: 1024 * 1024 }).valid).toBe(true);
      }
    });
  });

  describe('Bloqueio Seguro de Formatos Não Suportados', () => {
    it('deve recusar extensões executáveis ou não permitidas com mensagem "Arquivo não suportado"', () => {
      const blockedFiles = [
        'script.exe',
        'virus.bat',
        'payload.sh',
        'instalador.apk',
        'arquivo_sem_extensao'
      ];

      for (const file of blockedFiles) {
        const result = validateUploadFile({ name: file, size: 1024 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Arquivo não suportado');
      }
    });
  });

  describe('Atributo accept do HTML5', () => {
    it('deve conter as extensões e MIME types essenciais incluindo .pptx', () => {
      expect(ACCEPT_FILE_STRING).toContain('.pptx');
      expect(ACCEPT_FILE_STRING).toContain('.ppt');
      expect(ACCEPT_FILE_STRING).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    });
  });
});
