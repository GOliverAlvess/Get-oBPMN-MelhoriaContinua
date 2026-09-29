import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getDriveFolderUrl, 
  GOOGLE_DRIVE_FOLDER_BASE_URL, 
  NO_DRIVE_FOLDER_WARNING_MESSAGE 
} from '../driveFolderUrl';

describe('Ajuste Pontual - Botão "Abrir pasta no Drive"', () => {
  describe('CENÁRIO A — Projeto com pasta existente', () => {
    it('deve gerar a URL canônica correta para o Google Drive com o folderId do projeto', () => {
      const folderId = '1AbC_xyz-987654321';
      const url = getDriveFolderUrl(folderId);

      expect(url).toBe(`${GOOGLE_DRIVE_FOLDER_BASE_URL}${folderId}`);
      expect(url).toBe('https://drive.google.com/drive/folders/1AbC_xyz-987654321');
    });

    it('deve codificar caracteres especiais no folderId de forma segura com encodeURIComponent', () => {
      const folderId = 'folder/test#123?abc';
      const url = getDriveFolderUrl(folderId);

      expect(url).toBe(`${GOOGLE_DRIVE_FOLDER_BASE_URL}folder%2Ftest%23123%3Fabc`);
      expect(url).not.toContain('?abc');
    });
  });

  describe('CENÁRIO B — Dois projetos diferentes', () => {
    it('deve gerar URLs distintas para cada projeto com base em seus respectivos folderIds', () => {
      const projetoA = { id: 'p1', name: 'Projeto A', driveFolderId: 'FOLDER_ID_A' };
      const projetoB = { id: 'p2', name: 'Projeto B', driveFolderId: 'FOLDER_ID_B' };

      const urlA = getDriveFolderUrl(projetoA.driveFolderId);
      const urlB = getDriveFolderUrl(projetoB.driveFolderId);

      expect(urlA).toBe('https://drive.google.com/drive/folders/FOLDER_ID_A');
      expect(urlB).toBe('https://drive.google.com/drive/folders/FOLDER_ID_B');
      expect(urlA).not.toBe(urlB);
    });
  });

  describe('CENÁRIO C — Projeto sem pasta (driveFolderId ausente ou vazio)', () => {
    it('deve retornar null se driveFolderId for undefined', () => {
      expect(getDriveFolderUrl(undefined)).toBeNull();
    });

    it('deve retornar null se driveFolderId for null', () => {
      expect(getDriveFolderUrl(null)).toBeNull();
    });

    it('deve retornar null se driveFolderId for string vazia ou apenas espaços', () => {
      expect(getDriveFolderUrl('')).toBeNull();
      expect(getDriveFolderUrl('   ')).toBeNull();
    });

    it('deve retornar null se driveFolderId for "undefined" ou "null" como texto', () => {
      expect(getDriveFolderUrl('undefined')).toBeNull();
      expect(getDriveFolderUrl('null')).toBeNull();
    });

    it('mensagem padronizada de aviso deve estar correta', () => {
      expect(NO_DRIVE_FOLDER_WARNING_MESSAGE).toBe(
        'Este projeto ainda não possui uma pasta vinculada no Google Drive.'
      );
    });
  });

  describe('CENÁRIO D & E — Não alteração de upload e permissões', () => {
    it('não deve depender do nome do projeto nem criar novas pastas para obter a URL', () => {
      // Garante que a URL é derivada estritamente do driveFolderId e não do nome do projeto
      const folderId = '0AFf6OFctpR_7Uk9PVA';
      const url = getDriveFolderUrl(folderId);
      expect(url).toBe('https://drive.google.com/drive/folders/0AFf6OFctpR_7Uk9PVA');
    });
  });
});
