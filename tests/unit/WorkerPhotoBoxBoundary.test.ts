import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(p:string)=>readFileSync(p,'utf8');
describe('PhotoBox owner-backed authored SVG presentation',()=>{
  it('keeps original filter editing and Orion 6.0 requirements without fake PNG',()=>{
    const view=source('src/apps/photobox/PhotoBoxView.tsx');
    const legacy=source('src/apps/photobox/PhotoBoxApp.tsx');
    expect(view).toContain('Illustration Samples:');
    expect(view).toContain('B&W High Contrast');
    expect(view).toContain('Orion_6.0');
    expect(view).toContain('ramMb >= 768');
    expect(view).toContain('makePhotoBoxSvg(activePhoto, DEFAULT_FILTER)');
    expect(view).toContain('onExport(activePhoto, filters)');
    expect(view).not.toContain('edited_${activePhoto}.png');
    expect(view).not.toContain('useSimulationStore');
    expect(legacy).toContain('<PhotoBoxView');
  });
  it('reads one saved image and dispatches one owner export without creating an engine in browser',()=>{
    const worker=source('src/simulation/host/WorkerPhotoBoxPanel.tsx');
    const explorer=source('src/simulation/host/WorkerDesktopVfsApps.tsx');
    expect(worker).toContain("session.read({ kind: 'apps' })");
    expect(worker).toContain("session.read({ kind: 'file', path: initialPath })");
    expect(worker).toContain("type: 'PHOTOBOX_EXPORT_ARTWORK'");
    expect(worker).toContain("app.appId === 'app.photobox'");
    expect(worker).not.toContain('useSimulationStore');
    expect(worker).not.toContain('defaultEngine');
    expect(explorer).toContain("'C:/Pictures'");
    expect(explorer).toContain("file.kind === 'image' ? openArtwork(file.path)");
  });
});
