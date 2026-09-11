// src/tools/studio/tabs/RawInspectorTab.tsx
import React, { useState } from 'react';
import { Inspector } from 'tinybase/ui-react-inspector';
import type { StudioStoreContext } from '../hooks/useStudioStore';

interface Props {
  studio: StudioStoreContext;
}

export const RawInspectorTab: React.FC<Props> = ({ studio }) => {
  const tableNames = Object.keys(studio.tables).sort();
  const [selectedTable, setSelectedTable] = useState<string>(tableNames[0] || 'characters');
  const [copied, setCopied] = useState(false);

  const currentTableData = studio.tables[selectedTable] ?? {};
  const jsonString = JSON.stringify(currentTableData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0718] overflow-hidden">
      {/* Mount TinyBase Inspector as dockable widget */}
      <Inspector open={false} position="right" hue={270} />

      {/* Header */}
      <div className="p-4 border-b border-purple-900/40 bg-[#110822] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Raw Store Tables
            </h2>
            <p className="text-xs text-purple-400">
              Low-level JSON dump of in-memory TinyBase tables. Use the right floating badge for the interactive TinyBase Inspector.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="rounded bg-[#180e30] border border-purple-800/60 px-3 py-1 text-xs text-purple-100 font-mono focus:outline-none"
          >
            {tableNames.map((tbl) => (
              <option key={tbl} value={tbl}>
                table: {tbl} ({Object.keys(studio.tables[tbl] ?? {}).length} rows)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-600 text-xs font-bold text-white shadow"
          >
            {copied ? 'Copied Table JSON!' : 'Copy Table JSON'}
          </button>
        </div>
      </div>

      {/* JSON Viewer */}
      <div className="flex-1 p-4 overflow-auto font-mono text-xs">
        <pre className="bg-[#140b26] p-4 rounded-lg border border-purple-900/60 text-purple-200 overflow-x-auto leading-relaxed">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
