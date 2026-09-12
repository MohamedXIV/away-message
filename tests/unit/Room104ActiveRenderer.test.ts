import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Room 104 active renderer architecture (#26)', () => {
  it('routes the live room view through Room104Scene instead of the legacy Canvas2D room', () => {
    const app = source('src/App.tsx');

    expect(app).toContain("import { Room104Scene } from './world/Room104Scene';");
    expect(app).toContain("activeView === 'room' && <Room104Scene />");
    expect(app).not.toContain("activeView === 'room' && <RoomScene />");
  });

  it('keeps the new Room 104 scene on the generic PhysicalWorldHost path', () => {
    const room = source('src/world/Room104Scene.tsx');

    expect(room).toContain('PhysicalWorldHost');
    expect(room).toContain("placeId: 'room_104'");
    expect(room).not.toContain('RoomCanvasRenderer');
    expect(room).not.toContain('<canvas');
  });

  it('reads authored storage surfaces from canonical PhysicalWorldState instead of a placeholder inventory path', () => {
    const room = source('src/world/Room104Scene.tsx');

    expect(room).toContain('getRoom104StorageContents');
    expect(room).toContain('engine.getPhysicalWorldState()');
    expect(room).not.toContain('no canonical physical container is bound yet');
  });

  it('renders canonical storage presence at authored anchor coordinates instead of a separate room inventory UI', () => {
    const room = source('src/world/Room104Scene.tsx');

    expect(room).toContain('getRoom104StoragePresence');
    expect(room).toContain('buildRoom104StorageMarkers');
    expect(room).toContain('storageMarkers.map');
    expect(room).toContain('marker.x * 100');
    expect(room).toContain('marker.y * 100');
    expect(room).toContain('marker.itemCount');
  });

  it('renders canonical delivered world-anchor items at the authored delivery anchor', () => {
    const room = source('src/world/Room104Scene.tsx');

    expect(room).toContain('getRoom104WorldAnchorPresence');
    expect(room).toContain('buildRoom104WorldAnchorMarkers');
    expect(room).toContain('worldAnchorMarkers.map');
    expect(room).toContain('marker.x * 100');
    expect(room).toContain('marker.y * 100');
    expect(room).toContain('marker.itemCount');
    expect(room).toContain('inspectDeliveryAnchor');
  });

  it('keeps desk/PC status contextual to the authored desk view instead of showing it in every room view', () => {
    const room = source('src/world/Room104Scene.tsx');

    expect(room).toContain('const showDeskStatus = currentViewId === ROOM104_VIEW_IDS.deskWindow;');
    expect(room).toContain('{showDeskStatus && (');
  });
});
