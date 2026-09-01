export type UnifiedFileKind = 'executable' | 'installer' | 'archive' | 'audio' | 'image' | 'text';

export interface FileDownloadInfo {
  fileName: string;
  fileKind: UnifiedFileKind;
  sourceId: string;
  totalBytes: number;
  sourceMaxKbps: number;
  appAssociation?: string;
  targetDirectory: string;
  downloadUrl: string;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1]! : '';
}

function kindFromExtension(ext: string): UnifiedFileKind {
  if (['exe', 'msi', 'bat', 'com'].includes(ext)) return 'installer';
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'archive';
  if (['mp3', 'wav', 'ogg', 'midi', 'mid'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(ext)) return 'image';
  if (['txt', 'nfo', 'log', 'cfg', 'ini'].includes(ext)) return 'text';
  if (['html', 'htm'].includes(ext)) return 'text';
  return 'executable';
}

function appAssociationFromKind(kind: UnifiedFileKind, ext: string): string | undefined {
  if (kind === 'archive') return 'zipmate';
  if (kind === 'audio') return 'retroamp';
  if (kind === 'image') return 'photobox';
  if (kind === 'installer') return 'installer';
  if (ext === 'txt' || ext === 'nfo') return 'notepad';
  return undefined;
}

function sizeForKind(kind: UnifiedFileKind, url: string): number {
  const hash = hashString(url);
  // Deterministic size in bytes, varied but plausible
  if (kind === 'installer') return (3 + (hash % 12)) * 1024 * 1024; // 3-14 MB
  if (kind === 'archive') return (1 + (hash % 20)) * 1024 * 1024; // 1-20 MB
  if (kind === 'audio') return (2 + (hash % 8)) * 1024 * 1024; // 2-9 MB
  if (kind === 'image') return (200 + (hash % 1800)) * 1024; // 200KB-2MB
  if (kind === 'text') return (2 + (hash % 48)) * 1024; // 2-50 KB
  return (1 + (hash % 5)) * 1024 * 1024; // 1-5 MB
}

function sourceMaxForKind(kind: UnifiedFileKind): number {
  if (kind === 'installer' || kind === 'archive') return 256;
  if (kind === 'audio' || kind === 'image') return 180;
  return 120;
}

export function getFileInfoFromUrl(rawUrl: string): FileDownloadInfo | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let cleaned = rawUrl.trim();
  if (!cleaned) return null;
  // Handle bare host/path without protocol for detection
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://') && cleaned.includes('.local')) {
    cleaned = `http://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    const pathname = parsed.pathname || '/';
    // If pathname is just "/" and no file extension, treat as page, not file
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    if (!lastSegment.includes('.')) {
      // No file extension — might still be a file if query has file param, but treat as null for now
      // Allow explicit file paths like /files/..., /download/..., /archive/...
      // If pathname contains "files" or "download" or "archive" and has no extension, we generate a default file name
      const isFilePath = /files|download|archive|audio|image/i.test(pathname);
      if (!isFilePath) return null;
    }
    const fileName = lastSegment.includes('.') ? lastSegment : `${parsed.hostname.split('.')[0] || 'file'}_${hashString(pathname) % 1000}.zip`;
    const ext = getExtension(fileName);
    const fileKind = kindFromExtension(ext);
    const totalBytes = sizeForKind(fileKind, cleaned);
    const sourceMaxKbps = sourceMaxForKind(fileKind);
    const appAssociation = appAssociationFromKind(fileKind, ext);
    // sourceId is host + fileName hash for uniqueness
    const sourceId = `${parsed.hostname}_${fileName}_${hashString(cleaned) % 10000}`;
    return {
      fileName,
      fileKind,
      sourceId,
      totalBytes,
      sourceMaxKbps,
      appAssociation,
      targetDirectory: 'C:/Downloads',
      downloadUrl: cleaned,
    };
  } catch {
    return null;
  }
}

export function isDownloadableUrl(url: string): boolean {
  return getFileInfoFromUrl(url) !== null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getVfsTargetPath(info: FileDownloadInfo, customDir?: string): string {
  const dir = customDir || info.targetDirectory;
  return `${dir}/${info.fileName}`;
}
