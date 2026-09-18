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
  const initialRows = Object.keys(studio.tables[tableNames[0] ?? ''] ?? {}).sort();
  const [selectedRow, setSelectedRow] = useState<string>(initialRows[0] ?? '');
  const [copied, setCopied] = useState(false);

  const currentTableData = studio.tables[selectedTable] ?? {};
  const rowIds = Object.keys(currentTableData).sort();
  const jsonString = JSON.stringify(currentTableData, null, 2);
  const parents = selectedRow ? studio.getParents(selectedTable, selectedRow) : [];
  const children = selectedRow ? studio.getChildren(selectedTable, selectedRow) : [];
  const diagnostics = selectedRow
    ? studio.getRowDiagnostics(selectedTable, selectedRow)
    : [];

  const selectTable = (tableId: string) => {
    setSelectedTable(tableId);
    setSelectedRow(Object.keys(studio.tables[tableId] ?? {}).sort()[0] ?? '');
  };

  const navigateTo = (tableId: string, rowId: string) => {
    setSelectedTable(tableId);
    setSelectedRow(rowId);
  };

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
            onChange={(e) => selectTable(e.target.value)}
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
          <select
            value={selectedRow}
            onChange={(e) => setSelectedRow(e.target.value)}
            className="rounded bg-[#180e30] border border-purple-800/60 px-3 py-1 text-xs text-purple-100 font-mono focus:outline-none"
          >
            {rowIds.length === 0 ? (
              <option value="">no rows</option>
            ) : (
              rowIds.map((rowId) => (
                <option key={rowId} value={rowId}>
                  row: {rowId}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {selectedRow && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 py-3 border-b border-purple-900/40 bg-[#0f081d] text-xs">
          <div className="rounded border border-purple-900/60 bg-[#140b26] p-3">
            <div className="mb-2 font-bold text-purple-200">Parents</div>
            {parents.length === 0 ? (
              <div className="text-gray-500">No shared-model parent.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {parents.map((node) => (
                  <button
                    key={node.tableId + '/' + node.rowId}
                    type="button"
                    onClick={() => navigateTo(node.tableId, node.rowId)}
                    className="rounded border border-purple-800/60 bg-purple-950/50 px-2 py-1 font-mono text-purple-200 hover:bg-purple-900/60"
                  >
                    {node.tableId}/{node.rowId}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border border-purple-900/60 bg-[#140b26] p-3">
            <div className="mb-2 font-bold text-purple-200">Children</div>
            {children.length === 0 ? (
              <div className="text-gray-500">No shared-model children.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {children.map((node) => (
                  <button
                    key={node.tableId + '/' + node.rowId}
                    type="button"
                    onClick={() => navigateTo(node.tableId, node.rowId)}
                    className="rounded border border-purple-800/60 bg-purple-950/50 px-2 py-1 font-mono text-purple-200 hover:bg-purple-900/60"
                  >
                    {node.tableId}/{node.rowId}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border border-purple-900/60 bg-[#140b26] p-3">
            <div className="mb-2 font-bold text-purple-200">Diagnostics</div>
            {diagnostics.length === 0 ? (
              <div className="text-emerald-500">No row validation issues.</div>
            ) : (
              <ul className="space-y-1 text-red-300">
                {diagnostics.map((diagnostic, index) => (
                  <li key={index}>• {diagnostic}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* JSON Viewer */}
      <div className="flex-1 p-4 overflow-auto font-mono text-xs">
        <pre className="bg-[#140b26] p-4 rounded-lg border border-purple-900/60 text-purple-200 overflow-x-auto leading-relaxed">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
