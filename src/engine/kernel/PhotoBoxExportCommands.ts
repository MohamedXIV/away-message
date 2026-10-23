import type { FileSystemEngine } from '../FileSystemEngine';
import { makePhotoBoxSvg, validPhotoBoxScene, type PhotoBoxFilters } from '../PhotoBoxArtwork';

/** Owner-only export: a successful Save means an actual renderable image exists in VFS. */
export function exportPhotoBoxArtwork(vfs: FileSystemEngine, scene: unknown, filters: PhotoBoxFilters, now: number) {
  if (!validPhotoBoxScene(scene)) throw new Error('Unknown PhotoBox illustration');
  const content = makePhotoBoxSvg(scene, filters);
  const name = 'edited_' + scene + '.svg';
  const path = 'C:/Pictures/' + name;
  if (vfs.readFile(path)) throw new Error('Image already exists; remove it before exporting again');
  const sizeBytes = new TextEncoder().encode(content).length;
  if (sizeBytes > vfs.getFreeDiskBytes()) throw new Error('Not enough disk space for image');
  vfs.createFile({ name, path, parentPath: 'C:/Pictures', kind: 'image',
    content, sizeBytes, metadata: { author: 'photobox', version: 'svg-1' } }, now);
  return { path, sizeBytes, format: 'image/svg+xml' };
}
