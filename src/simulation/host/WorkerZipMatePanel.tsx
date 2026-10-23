import {useEffect,useState} from 'react';
import {ZipMateView,type ZipMateItem} from '../../apps/zipmate/ZipMateView';
import type {SimulationDirectoryRead,SimulationArchiveRead,SimulationAppRead} from '../../engine/kernel/SimulationPublication';
import type {WorkerGameSession} from './WorkerGameSession';

export function WorkerZipMatePanel({session,revision,initialPath}:{
  session:WorkerGameSession;revision:number;initialPath?:string;
}){
  const [docs,setDocs]=useState<SimulationDirectoryRead|null>(null);
  const [downloads,setDownloads]=useState<SimulationDirectoryRead|null>(null);
  const [apps,setApps]=useState<SimulationAppRead|null>(null);
  const [selectedArchive,setSelectedArchive]=useState(initialPath??'');
  const [archive,setArchive]=useState<SimulationArchiveRead|null>(null);
  const [archiveName,setArchiveName]=useState('NewArchive.zip');
  const [sources,setSources]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('Select Documents files for a ZIP.');
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let live=true;
    void Promise.all([session.read({kind:'directory',path:'C:/Documents',limit:64}),
      session.read({kind:'directory',path:'C:/Downloads',limit:64}),
      session.read({kind:'apps'})]).then(([d,f,a])=>{
        if(!live||d.revision!==revision||f.revision!==revision||a.revision!==revision)return;
        setDocs(d);setDownloads(f);setApps(a);setError(null);
      }).catch(e=>{if(live)setError(String(e))});
    return()=>{live=false};
  },[session,revision]);
  useEffect(()=>{
    let live=true;setArchive(null);
    if(!selectedArchive)return()=>{live=false};
    void session.read({kind:'archive',archivePath:selectedArchive}).then(a=>{
      if(live&&a.revision===revision)setArchive(a);
    }).catch(e=>{if(live)setError(String(e))});
    return()=>{live=false};
  },[session,revision,selectedArchive]);
  const execute=async(kind:'create'|'extract')=>{
    setBusy(true);setError(null);
    try{
      const r=await session.dispatch(kind==='create'?
        {type:'VFS_ARCHIVE_CREATE',archiveName,filePaths:sources}:
        {type:'VFS_ARCHIVE_EXTRACT',archivePath:selectedArchive});
      if(!r.success)throw new Error(r.error??'Archive operation refused');
      if(kind==='create')setSelectedArchive('C:/Documents/'+archiveName);
      setStatus(kind==='create'?'Stored ZIP saved in Documents':'Extracted real text files to Documents');
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  };
  const installed=apps?.revision===revision&&apps.installedSoftware.some(x=>x.appId==='app.zipmate');
  const archivePaths=[...(docs?.files??[]),...(downloads?.files??[])]
    .filter(x=>x.kind==='archive').map(x=>x.path);
  const textFiles=(docs?.files??[]).filter(x=>x.kind==='text').map(x=>({path:x.path,name:x.name}));
  const items:ZipMateItem[]=archive?.ready?archive.entries.map(x=>({
    name:x.name,originalSize:x.sizeBytes,packedSize:x.sizeBytes,
    type:'Text Document',modifiedDate:'VFS',crc32:x.crc32,
  })):[];
  return <section data-testid="worker-zipmate" className="h-full">
    {error&&<p role="alert" className="p-1 text-xs text-red-800">{error}</p>}
    {apps?.revision===revision&&!installed?
      <p className="p-3 text-xs">ZipMate is not installed.</p>:
      <ZipMateView archivePaths={archivePaths} selectedArchive={selectedArchive}
        items={items} textFiles={textFiles} sourcePaths={sources} archiveName={archiveName}
        statusMessage={archive?.reason??status} busy={busy}
        onArchiveChange={setSelectedArchive} onArchiveNameChange={setArchiveName}
        onToggleSource={p=>setSources(old=>old.includes(p)?old.filter(x=>x!==p):[...old,p])}
        onCreateArchive={()=>execute('create')} onExtractAll={()=>execute('extract')}/>}
  </section>;
}
