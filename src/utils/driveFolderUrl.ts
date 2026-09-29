/**
 * Utilitário seguro para composição e abertura da pasta de um projeto no Google Drive.
 * Reutiliza exatamente o project.driveFolderId cadastrado.
 */

export const GOOGLE_DRIVE_FOLDER_BASE_URL = 'https://drive.google.com/drive/folders/';

export const NO_DRIVE_FOLDER_WARNING_MESSAGE = 'Este projeto ainda não possui uma pasta vinculada no Google Drive.';

/**
 * Valida e compõe a URL direta do Google Drive para o folderId informado.
 * Retorna null se o folderId for inválido, vazio ou indefinido.
 */
export function getDriveFolderUrl(folderId?: string | null): string | null {
  if (!folderId) return null;
  const trimmed = folderId.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return null;
  }
  return `${GOOGLE_DRIVE_FOLDER_BASE_URL}${encodeURIComponent(trimmed)}`;
}
