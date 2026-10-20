import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('ZipMate original presentation with bounded Worker archive operations',()=>{
  it('does not invent default archives or cosmetic completion',()=>{
    const view=read('src/apps/zipmate/ZipMateView.tsx');
    const legacy=read('src/apps/zipmate/ZipMateApp.tsx');
    const worker=read('src/simulation/host/WorkerZipMatePanel.tsx');
    expect(view).toContain('CRC32');
    expect(view).toContain('Create ZIP');
    expect(view).toContain('Extract All');
    expect(view).not.toContain('DEFAULT_ARCHIVES');
    expect(view).not.toContain('setInterval');
    expect(legacy).toContain('<ZipMateView');
    expect(worker).toContain("session.read({kind:'archive',archivePath:selectedArchive})");
    expect(worker).toContain("type:'VFS_ARCHIVE_CREATE'");
    expect(worker).toContain("type:'VFS_ARCHIVE_EXTRACT'");
    expect(worker).toContain("x.appId==='app.zipmate'");
    expect(worker).not.toContain('useSimulationStore');
  });
});
