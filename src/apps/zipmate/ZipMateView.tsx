import React,{useState} from 'react';
export interface ZipMateItem{name:string;originalSize:number;packedSize:number;type:string;modifiedDate:string;crc32:string}
export interface ZipMateViewProps{
  archivePaths:string[];selectedArchive:string;items:ZipMateItem[];
  textFiles:Array<{path:string;name:string}>;sourcePaths:string[];archiveName:string;
  statusMessage:string;busy:boolean;onArchiveChange:(path:string)=>void;
  onToggleSource:(path:string)=>void;onArchiveNameChange:(n:string)=>void;
  onCreateArchive:()=>void|Promise<void>;onExtractAll:()=>void|Promise<void>;
}
export const ZipMateView:React.FC<ZipMateViewProps>=({
  archivePaths,selectedArchive,items,textFiles,sourcePaths,archiveName,statusMessage,busy,
  onArchiveChange,onToggleSource,onArchiveNameChange,onCreateArchive,onExtractAll,
})=>{
  const [selectedItemName,setSelectedItemName]=useState<string|null>(null);
  const handleArchiveChange=(path:string)=>{setSelectedItemName(null);onArchiveChange(path)};
  const totalOriginal=items.reduce((n,x)=>n+x.originalSize,0);
  const totalPacked=items.reduce((n,x)=>n+x.packedSize,0);
  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col border border-gray-400 overflow-hidden">
      {/* Menu Bar */}
      <div className="bg-[#dfdfdf] border-b border-gray-400 px-2 py-0.5 flex gap-3 text-xs text-gray-800">
        <span className="hover:underline cursor-pointer">File</span>
        <span className="hover:underline cursor-pointer">Actions</span>
        <span className="hover:underline cursor-pointer">Options</span>
        <span className="hover:underline cursor-pointer">Help</span>
      </div>

      {/* Toolbar */}
      <div className="bg-[#f0f0f0] border-b border-gray-400 p-1 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <select
            value={selectedArchive}
            onChange={(e) => handleArchiveChange(e.target.value)}
            className="bg-white border border-gray-400 rounded px-2 py-1 text-xs outline-none cursor-pointer font-semibold"
          >
            {!selectedArchive && <option value="">Choose ZIP</option>}
            {archivePaths.map(path => <option key={path} value={path}>{path.split('/').pop()}</option>)}
          </select>

          <button
            onClick={() => void onExtractAll()}
            disabled={busy||!selectedArchive||items.length===0}
            className="px-3 py-1 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-400 rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
          >
            📦 Extract All
          </button>
        </div>

        <span className="text-xs text-gray-600 font-mono">
          Ratio: <strong className="text-green-700">0%</strong> saved
        </span>
      </div>

      <div data-testid="zipmate-vfs-sources" className="border-b bg-[#f4f4f4] px-2 py-1 text-xs">
        <div className="font-bold">Create STORED ZIP from actual Documents text files</div>
        <div className="flex max-h-16 flex-wrap gap-2 overflow-y-auto py-1">
          {textFiles.map(file => <label key={file.path} className="flex items-center gap-1">
            <input type="checkbox" checked={sourcePaths.includes(file.path)}
              disabled={busy} onChange={() => onToggleSource(file.path)} />
            {file.name}
          </label>)}
        </div>
        <div className="flex items-center gap-2">
          <input aria-label="New ZIP name" value={archiveName}
            onChange={e=>onArchiveNameChange(e.target.value)}
            className="min-w-0 flex-1 border bg-white px-2 py-0.5" />
          <button type="button" disabled={busy||!sourcePaths.length}
            onClick={() => void onCreateArchive()}
            className="border bg-white px-2 py-1 font-bold disabled:opacity-50">Create ZIP</button>
        </div>
      </div>
      {/* Extraction Progress Bar */}
      {busy && (
        <div className="bg-blue-50 border-b border-blue-300 p-1.5 flex flex-col gap-1">
          <div className="flex justify-between text-[11px] text-blue-900 font-semibold">
            <span>Extracting files...</span>
            <span>Working</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded overflow-hidden border border-blue-400">
            <div
              className="bg-blue-600 h-full transition-all duration-200"
              style={{ width: '45%' }}
            />
          </div>
        </div>
      )}

      {/* Main Files Table */}
      <div className="flex-1 bg-white border-b border-gray-400 overflow-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead className="bg-[#e4e4e4] border-b border-gray-300 text-gray-700 font-bold sticky top-0">
            <tr>
              <th className="p-1.5 border-r border-gray-300">Name</th>
              <th className="p-1.5 border-r border-gray-300">Type</th>
              <th className="p-1.5 border-r border-gray-300">Original Size</th>
              <th className="p-1.5 border-r border-gray-300">Packed Size</th>
              <th className="p-1.5 border-r border-gray-300">Modified Date</th>
              <th className="p-1.5">CRC32</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = item.name === selectedItemName;
              return (
                <tr
                  key={item.name}
                  onClick={() => setSelectedItemName(item.name)}
                  className={`border-b border-gray-100 cursor-pointer ${
                    isSelected ? 'bg-blue-100 font-semibold text-blue-950' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <td className="p-1.5 flex items-center gap-1 font-mono">
                    <span>📄</span>
                    <span>{item.name}</span>
                  </td>
                  <td className="p-1.5 text-gray-600">{item.type}</td>
                  <td className="p-1.5 font-mono">{(item.originalSize / 1024).toFixed(1)} KB</td>
                  <td className="p-1.5 font-mono">{(item.packedSize / 1024).toFixed(1)} KB</td>
                  <td className="p-1.5 text-[11px] text-gray-500">{item.modifiedDate}</td>
                  <td className="p-1.5 font-mono text-[11px] text-gray-400">{item.crc32}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#dfdfdf] px-2 py-0.5 flex justify-between items-center text-[10px] text-gray-600">
        <span className="truncate">{statusMessage}</span>
        <span className="font-mono">
          Total: {(totalOriginal / (1024 * 1024)).toFixed(2)} MB / {(totalPacked / (1024 * 1024)).toFixed(2)} MB
        </span>
      </div>
    </div>
  );
};
