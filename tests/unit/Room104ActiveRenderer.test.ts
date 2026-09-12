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
});
