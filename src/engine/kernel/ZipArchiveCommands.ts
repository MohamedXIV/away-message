import { makeStoredZip, readStoredZip, type ZipTextEntry } from '../ZipStoreArchive';
import type { FileSystemEngine } from '../FileSystemEngine';
const validArchiveName=(n:string)=>/^[A-Za-z0-9_-]{1,32}\.zip$/i.test(n);
const validTextPath=(p:string)=>/^C:\/Documents\/[A-Za-z0-9 _.-]{1,54}\.txt$/i.test(p)&&!p.includes('..');
const validZipPath=(p:string)=>/^C:\/(Downloads|Documents)\/[A-Za-z0-9_-]{1,32}\.zip$/i.test(p);
export function inspectTextArchive(vfs:FileSystemEngine,path:string):
 {ready:boolean;reason:string|null;entries:ZipTextEntry[]} {
  if(typeof path!=='string'||!validZipPath(path))return{ready:false,reason:'Select a .zip file in Documents or Downloads',entries:[]};
  const file=vfs.readFile(path);
  if(!file||file.kind!=='archive'||typeof file.content!=='string')
    return{ready:false,reason:'Archive has no readable stored ZIP payload',entries:[]};
  try{return{ready:true,reason:null,entries:readStoredZip(file.content)}}
  catch(cause){return{ready:false,reason:cause instanceof Error?cause.message:'Invalid ZIP',entries:[]}}
}
export function createTextArchive(vfs:FileSystemEngine,name:string,filePaths:string[],now:number){
  if(typeof name!=='string'||!validArchiveName(name)||!Array.isArray(filePaths)||
    !filePaths.length||filePaths.length>16)throw new Error('Select 1–16 Documents text files and a .zip name');
  const seen=new Set<string>();
  const entries=filePaths.map(path=>{
    if(typeof path!=='string'||!validTextPath(path)||seen.has(path.toLowerCase()))
      throw new Error('Unsafe or duplicate text source path');
    seen.add(path.toLowerCase());
    const f=vfs.readFile(path);
    if(!f||f.kind!=='text'||typeof f.content!=='string')throw new Error('Missing readable text source');
    return{name:f.name,content:f.content};
  });
  const archive=makeStoredZip(entries),path='C:/Documents/'+name;
  if(vfs.readFile(path))throw new Error('Archive already exists');
  if(archive.sizeBytes>vfs.getFreeDiskBytes())throw new Error('Disk full for archive');
  vfs.createFile({name,path,parentPath:'C:/Documents',kind:'archive',
    sizeBytes:archive.sizeBytes,content:archive.content},now);
  return{path,count:entries.length,sizeBytes:archive.sizeBytes};
}
export function extractTextArchive(vfs:FileSystemEngine,path:string,now:number){
  const preview=inspectTextArchive(vfs,path);
  if(!preview.ready)throw new Error(preview.reason??'Unreadable archive');
  const prefix=path.slice(path.lastIndexOf('/')+1,-4);
  const entries=preview.entries.map(entry=>({...entry,dest:'C:/Documents/'+prefix+'_'+entry.name}));
  if(entries.some(e=>e.dest.length>115))throw new Error('Extracted name too long');
  if(entries.some(e=>vfs.readFile(e.dest)))throw new Error('Extracted file already exists');
  if(entries.reduce((n,e)=>n+e.sizeBytes,0)>vfs.getFreeDiskBytes())throw new Error('Disk full for extraction');
  const paths:string[]=[];
  for(const entry of entries){
    const name=entry.dest.slice('C:/Documents/'.length);
    vfs.createFile({name,path:entry.dest,parentPath:'C:/Documents',kind:'text',
      sizeBytes:entry.sizeBytes,content:entry.content,metadata:{textContent:entry.content}},now);
    paths.push(entry.dest);
  }
  return{paths,count:paths.length};
}
