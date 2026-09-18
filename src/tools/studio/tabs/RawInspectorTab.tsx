// src/tools/studio/tabs/RawInspectorTab.tsx
import React, { useEffect, useState } from 'react';
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
  const [rowDraft, setRowDraft] = useState('{}');
  const [newRowId, setNewRowId] = useState('');
  const [newRowDraft, setNewRowDraft] = useState('{}');
  const [rowEditError, setRowEditError] = useState<string | null>(null);

  const currentTableData = studio.tables[selectedTable] ?? {};
  const rowIds = Object.keys(currentTableData).sort();
  const jsonString = JSON.stringify(currentTableData, null, 2);
  const parents = selectedRow ? studio.getParents(selectedTable, selectedRow) : [];
  const children = selectedRow ? studio.getChildren(selectedTable, selectedRow) : [];
  const diagnostics = selectedRow
    ? studio.getRowDiagnostics(selectedTable, selectedRow)
    : [];
  const selectedRowJson = JSON.stringify(
    selectedRow ? currentTableData[selectedRow] ?? {} : {},
    null,
    2,
  );

  useEffect(() => {
    setRowDraft(selectedRowJson);
    setRowEditError(null);
  }, [selectedTable, selectedRow, selectedRowJson]);

  const parseRowDraft = (raw: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Row JSON must be an object.');
    }
    return parsed as Record<string, unknown>;
  };

  const applySelectedRow = () => {
    if (!selectedRow) return;
    try {
      studio.setRow(selectedTable, selectedRow, parseRowDraft(rowDraft));
      setRowEditError(null);
    } catch (error) {
      setRowEditError(error instanceof Error ? error.message : 'Invalid row JSON.');
    }
  };

  const createGenericRow = () => {
    try {
      const cleanId = newRowId.trim();
      if (!cleanId) throw new Error('Row ID is required.');
      const created = studio.createRow(
        selectedTable,
        cleanId,
        parseRowDraft(newRowDraft),
      );
      if (!created) throw new Error('Row ID already exists or is invalid.');
      setSelectedRow(cleanId);
      setNewRowId('');
      setNewRowDraft('{}');
      setRowEditError(null);
    } catch (error) {
      setRowEditError(error instanceof Error ? error.message : 'Unable to create row.');
    }
  };

  const deleteSelectedRow = () => {
    if (!selectedRow) return;
    const nextRow = rowIds.find((rowId) => rowId !== selectedRow) ?? '';
    studio.deleteRow(selectedTable, selectedRow);
    setSelectedRow(nextRow);
    setRowEditError(null);
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 px-4 py-3 border-b border-purple-900/40 bg-[#0d0718] text-xs">
        <div className="rounded border border-purple-900/60 bg-[#140b26] p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="font-bold text-purple-200">
              Generic Row Editor {selectedRow ? '— ' + selectedTable + '/' + selectedRow : ''}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applySelectedRow}
                disabled={!selectedRow}
                className="rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-30 px-2 py-1 font-bold text-white"
              >
                Apply Row
              </button>
              <button
                type="button"
                onClick={deleteSelectedRow}
                disabled={!selectedRow}
                className="rounded border border-red-800 bg-red-950/50 hover:bg-red-900/60 disabled:opacity-30 px-2 py-1 font-bold text-red-300"
              >
                Delete Row
              </button>
            </div>
          </div>
          <textarea
            value={rowDraft}
            onChange={(event) => setRowDraft(event.target.value)}
            disabled={!selectedRow}
            spellCheck={false}
            className="w-full min-h-40 rounded bg-[#0d0718] border border-purple-900/60 p-3 font-mono text-xs text-purple-100 focus:outline-none focus:border-purple-600 disabled:opacity-30"
          />
        </div>

        <div className="rounded border border-purple-900/60 bg-[#140b26] p-3">
          <div className="font-bold text-purple-200 mb-2">
            Create Generic Row in {selectedTable}
          </div>
          <input
            value={newRowId}
            onChange={(event) => setNewRowId(event.target.value)}
            placeholder="row_id"
            className="w-full mb-2 rounded bg-[#0d0718] border border-purple-900/60 px-3 py-2 font-mono text-xs text-purple-100 focus:outline-none focus:border-purple-600"
          />
          <textarea
            value={newRowDraft}
            onChange={(event) => setNewRowDraft(event.target.value)}
            spellCheck={false}
            className="w-full min-h-28 rounded bg-[#0d0718] border border-purple-900/60 p-3 font-mono text-xs text-purple-100 focus:outline-none focus:border-purple-600"
          />
          <button
            type="button"
            onClick={createGenericRow}
            className="mt-2 rounded bg-purple-700 hover:bg-purple-600 px-3 py-1 font-bold text-white"
          >
            Create Row
          </button>
          {rowEditError && (
            <div className="mt-2 rounded border border-red-800 bg-red-950/40 px-2 py-1.5 text-red-300">
              {rowEditError}
            </div>
          )}
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
