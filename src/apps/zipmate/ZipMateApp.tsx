import React,{useState} from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { inspectTextArchive } from '../../engine/kernel/ZipArchiveCommands';
import { ZipMateView,type ZipMateItem } from './ZipMateView';
/** Normal route continues using its own existing simulation VFS, not fake archives. */
export const ZipMateApp:React.FC=()=>{
  const engine=useSimulationStore(s=>s.engine);
  const dispatch=useSimulationStore(s=>s.dispatchAction);
  const [archiveName,setArchiveName]=useState('NewArchive.zip');
  const [selectedArchive,setSelectedArchive]=useState('');
  const [sources,setSources]=useState<string[]>([]);
  const [status,setStatus]=useState('Choose actual Documents files to archive.');
  const [busy,setBusy]=useState(false);
  const docs=engine.vfs.listDirectory('C:/Documents');
  const paths=[...docs,...engine.vfs.listDirectory('C:/Downloads')]
    .filter(x=>x.kind==='archive').map(x=>x.path);
  const texts=docs.filter(x=>x.kind==='text'&&typeof x.content==='string')
    .map(x=>({path:x.path,name:x.name}));
  const scan=selectedArchive?inspectTextArchive(engine.vfs,selectedArchive):null;
  const items:ZipMateItem[]=scan?.entries.map(x=>({name:x.name,
    originalSize:x.sizeBytes,packedSize:x.sizeBytes,crc32:x.crc32,
    type:'Text Document',modifiedDate:'VFS'}))??[];
  const create=()=>{
    setBusy(true);
    const r=dispatch({type:'VFS_ARCHIVE_CREATE',archiveName,filePaths:sources});
    setStatus(r.success?'Stored ZIP saved to C:/Documents':r.error??'ZIP creation refused');
    if(r.success)setSelectedArchive('C:/Documents/'+archiveName);
    setBusy(false);
  };
  const extract=()=>{
    setBusy(true);
    const r=dispatch({type:'VFS_ARCHIVE_EXTRACT',archivePath:selectedArchive});
    setStatus(r.success?'Extracted actual Documents files':r.error??'Extraction refused');
    setBusy(false);
  };
  return <ZipMateView archivePaths={paths} selectedArchive={selectedArchive}
    items={items} textFiles={texts} sourcePaths={sources} archiveName={archiveName}
    statusMessage={scan?.reason??status} busy={busy}
    onArchiveChange={setSelectedArchive} onArchiveNameChange={setArchiveName}
    onToggleSource={p=>setSources(old=>old.includes(p)?old.filter(x=>x!==p):[...old,p])}
    onCreateArchive={create} onExtractAll={extract} />;
};
