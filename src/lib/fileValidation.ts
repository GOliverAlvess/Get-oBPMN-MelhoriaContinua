/**
 * Utilitário de validação de arquivos para upload no GIP Flow (Google Drive)
 * Suporte completo a apresentações (.pptx, .ppt, .ppsx, etc.), documentos, planilhas, imagens e arquivos compactados.
 */

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB (104.857.600 bytes)

/**
 * Extensões de arquivo suportadas pelo sistema (todas case-insensitive)
 */
export const ALLOWED_FILE_EXTENSIONS = new Set([
  // Apresentações / PowerPoint
  'pptx',
  'ppt',
  'ppsx',
  'pps',
  'potx',
  'pot',
  // Documentos de Texto
  'pdf',
  'docx',
  'doc',
  'txt',
  'csv',
  // Planilhas
  'xlsx',
  'xls',
  // Imagens
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'bmp',
  'ico',
  // Compactados
  'zip',
  'rar',
  '7z'
]);

/**
 * Mapa canônico de extensões para MIME Types oficiais
 */
export const EXTENSION_TO_MIME_MAP: Record<string, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  pps: 'application/vnd.ms-powerpoint',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  pot: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
};

/**
 * MIME Types aceitos pelo sistema
 */
export const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/x-mspowerpoint',
  'application/mspowerpoint',
  'application/powerpoint',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/pjpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'image/bmp',
  'image/x-icon',
  'text/plain',
  'text/csv',
  'application/csv',
  'text/x-csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  // Tipos genéricos aceitos quando a extensão é válida (fallback seguro)
  'application/octet-stream',
  ''
]);

/**
 * String para o atributo accept dos inputs de arquivo HTML
 */
export const ACCEPT_FILE_STRING = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.pps',
  '.ppsx',
  '.pot',
  '.potx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.txt',
  '.csv',
  '.zip',
  '.rar',
  '.7z',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'text/plain',
  'text/csv',
  'image/*'
].join(',');

/**
 * Extrai a extensão do arquivo em formato lowercase e sem ponto
 */
export function getFileExtension(fileName: string): string {
  if (!fileName || !fileName.includes('.')) return '';
  return fileName.split('.').pop()?.toLowerCase().trim() || '';
}

/**
 * Obtém o MIME Type correto e padronizado para um arquivo com base no nome e no MIME reportado
 */
export function resolveFileMimeType(fileName: string, reportedMime?: string): string {
  const ext = getFileExtension(fileName);
  if (ext && EXTENSION_TO_MIME_MAP[ext]) {
    return EXTENSION_TO_MIME_MAP[ext];
  }
  if (reportedMime && reportedMime !== 'application/octet-stream' && reportedMime !== 'application/x-zip-compressed') {
    return reportedMime;
  }
  return 'application/octet-stream';
}

/**
 * Validação de tipo de arquivo (extensão + MIME type com fallback seguro)
 */
export function isFileTypeSupported(fileName: string, reportedMime?: string): boolean {
  const ext = getFileExtension(fileName);

  // 1. Se a extensão for válida na whitelist (case-insensitive) -> suportado!
  if (ext && ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return true;
  }

  // 2. Se a extensão for desconhecida, verifica se o MIME type informado é explicitamente suportado e não-genérico
  if (reportedMime && reportedMime !== 'application/octet-stream' && reportedMime !== '' && ALLOWED_MIME_TYPES.has(reportedMime)) {
    return true;
  }

  return false;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validação completa de arquivo para upload (tipo e tamanho)
 * Ordem estrita de validações:
 * 1. Formato suportado -> "Arquivo não suportado"
 * 2. Tamanho <= 100 MB -> "O arquivo ... excede o limite máximo permitido para upload (100 MB)."
 */
export function validateUploadFile(file: { name: string; size?: number; type?: string }): FileValidationResult {
  // 1. Validação de Formato
  if (!isFileTypeSupported(file.name, file.type)) {
    return {
      valid: false,
      error: `Arquivo não suportado: "${file.name}". Formatos aceitos: PPTX, PPT, PDF, DOCX, XLSX, imagens, TXT, CSV, ZIP.`
    };
  }

  // 2. Validação de Tamanho (Limite de 100 MB)
  if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `O arquivo ${file.name} excede o limite máximo permitido para upload (100 MB).`
    };
  }

  return { valid: true };
}
