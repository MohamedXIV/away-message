/** PKZIP STORE-only codec for bounded text files, with real CRC32 and binary ZIP headers.
 * The canonical VFS carries the bytes as base64 in its string content field.
 */
const tag = 'ZIPSTORE64:';
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
const nameOk = (s: string) => /^[A-Za-z0-9 _.-]{1,54}\.txt$/i.test(s) && !s.includes('..');
const put16 = (v: DataView, i: number, n: number) => v.setUint16(i, n, true);
const put32 = (v: DataView, i: number, n: number) => v.setUint32(i, n >>> 0, true);
const get16 = (v: DataView, i: number) => v.getUint16(i, true);
const get32 = (v: DataView, i: number) => v.getUint32(i, true);
function crc(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export interface ZipTextEntry { name: string; content: string; sizeBytes: number; crc32: string }
export function makeStoredZip(files: ReadonlyArray<{ name: string; content: string }>) {
  if (!files.length || files.length > 16) throw new Error('Select 1–16 text files');
  const names = new Set<string>();
  const entries = files.map(f => {
    if (!nameOk(f.name) || names.has(f.name.toLowerCase())) throw new Error('Unsafe or duplicate file name');
    names.add(f.name.toLowerCase());
    const name = enc.encode(f.name), bytes = enc.encode(f.content);
    if (bytes.length > 32768) throw new Error('Text entry exceeds 32 KiB');
    return { name, bytes, checksum: crc(bytes) };
  });
  if (entries.reduce((n, e) => n + e.bytes.length, 0) > 131072) throw new Error('Archive exceeds 128 KiB');
  const locals = entries.reduce((n, e) => n + 30 + e.name.length + e.bytes.length, 0);
  const central = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const sizeBytes = locals + central + 22;
  if (sizeBytes > 262144) throw new Error('ZIP exceeds 256 KiB');
  const out = new Uint8Array(sizeBytes), v = new DataView(out.buffer);
  const offsets: number[] = [];
  let p = 0;
  for (const f of entries) {
    offsets.push(p);
    put32(v,p,0x04034b50); put16(v,p+4,20);
    put32(v,p+14,f.checksum); put32(v,p+18,f.bytes.length); put32(v,p+22,f.bytes.length);
    put16(v,p+26,f.name.length);
    out.set(f.name,p+30); out.set(f.bytes,p+30+f.name.length);
    p += 30 + f.name.length + f.bytes.length;
  }
  const centralStart = p;
  entries.forEach((f,i) => {
    put32(v,p,0x02014b50); put16(v,p+4,20); put16(v,p+6,20);
    put32(v,p+16,f.checksum); put32(v,p+20,f.bytes.length); put32(v,p+24,f.bytes.length);
    put16(v,p+28,f.name.length); put32(v,p+42,offsets[i]!);
    out.set(f.name,p+46); p += 46+f.name.length;
  });
  put32(v,p,0x06054b50); put16(v,p+8,entries.length); put16(v,p+10,entries.length);
  put32(v,p+12,p-centralStart); put32(v,p+16,centralStart);
  let raw = '';
  for (let i=0;i<out.length;i+=4096) raw += String.fromCharCode(...out.subarray(i,i+4096));
  return { content: tag + btoa(raw), sizeBytes };
}
export function readStoredZip(content: string): ZipTextEntry[] {
  if (!content.startsWith(tag)) throw new Error('ZIP has no supported stored payload');
  const base64 = content.slice(tag.length);
  if (base64.length > 350000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Invalid ZIP encoding');
  const raw = atob(base64);
  if (raw.length < 22 || raw.length > 262144) throw new Error('Invalid ZIP size');
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0)), v = new DataView(bytes.buffer);
  const end = bytes.length - 22;
  if (get32(v,end) !== 0x06054b50 || get16(v,end+4) || get16(v,end+6) ||
      get16(v,end+20) || get16(v,end+8) !== get16(v,end+10)) throw new Error('Unsupported ZIP footer');
  const count = get16(v,end+10), offset = get32(v,end+16), size = get32(v,end+12);
  if (!count || count > 16 || offset + size !== end) throw new Error('Invalid ZIP central directory');
  let c=offset, localEnd=0, total=0;
  const output: ZipTextEntry[] = [], names = new Set<string>();
  for(let i=0;i<count;i++){
    if(c+46>end || get32(v,c)!==0x02014b50) throw new Error('Truncated ZIP directory');
    const flags=get16(v,c+8),method=get16(v,c+10),hash=get32(v,c+16),packed=get32(v,c+20),
      full=get32(v,c+24),nameLength=get16(v,c+28),extra=get16(v,c+30),
      comment=get16(v,c+32),start=get32(v,c+42);
    const next=c+46+nameLength+extra+comment;
    if(flags || method || packed!==full || full>32768 || !nameLength || extra || comment ||
       next>end || start!==localEnd || start+30+nameLength+full>offset ||
       get32(v,start)!==0x04034b50 || get16(v,start+6) || get16(v,start+8) ||
       get16(v,start+26)!==nameLength || get16(v,start+28) ||
       get32(v,start+14)!==hash || get32(v,start+18)!==packed || get32(v,start+22)!==full)
      throw new Error('Unsafe ZIP member');
    const centralName=bytes.subarray(c+46,c+46+nameLength);
    const localName=bytes.subarray(start+30,start+30+nameLength);
    if(centralName.some((b,j)=>b!==localName[j])) throw new Error('ZIP member name mismatch');
    const name=dec.decode(centralName);
    if(!nameOk(name)||names.has(name.toLowerCase())) throw new Error('Unsafe ZIP name');
    names.add(name.toLowerCase());
    const data=bytes.subarray(start+30+nameLength,start+30+nameLength+full);
    if(crc(data)!==hash) throw new Error('ZIP CRC32 mismatch');
    total+=full; if(total>131072) throw new Error('ZIP extracted size exceeds limit');
    output.push({name,content:dec.decode(data),sizeBytes:full,crc32:hash.toString(16).toUpperCase().padStart(8,'0')});
    localEnd=start+30+nameLength+full; c=next;
  }
  if(c!==end||localEnd!==offset)throw new Error('Unexpected ZIP trailing bytes');
  return output;
}
