import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidUrl(url: string) {
  try {
    // Check if it looks like a URL
    if (!url) return false;
    const pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(url);
  } catch (e) {
    return false;
  }
}

export function formatUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

export function exportarCSVPadrao(headers: string[], linhas: any[][], nomeArquivo: string = "relatorio.csv") {
  const BOM = "\uFEFF";
  const separator = ";";

  const csvConteudo =
    headers.map(h => `"${(h || '').toString().replace(/"/g, '""')}"`).join(separator) + "\r\n" +
    linhas.map(linha =>
      linha.map(campo => {
        const str = (campo ?? "").toString();
        return `"${str.replace(/"/g, '""')}"`;
      }).join(separator)
    ).join("\r\n");

  const csvFinal = BOM + csvConteudo;

  const blob = new Blob([csvFinal], {
    type: "text/csv;charset=utf-8;"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function cleanObject(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const newObj: any = Array.isArray(obj) ? [] : {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value === undefined) return;
    
    if (value !== null && typeof value === 'object') {
      newObj[key] = cleanObject(value);
    } else {
      newObj[key] = value;
    }
  });
  
  return newObj;
}

export function getBase64ImageFromUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = (error) => {
      reject(error);
    };
    img.src = url;
  });
}
