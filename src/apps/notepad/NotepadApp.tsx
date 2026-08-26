import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';

export const NotepadApp: React.FC<{ filePath?: string }> = ({ filePath }) => {
  const vfs = useSimulationStore((s) => s.state.vfs);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const [currentFilePath, setCurrentFilePath] = useState<string | null>(filePath || null);
  const [content, setContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (filePath) {
      const file = vfs.files[filePath];
      if (file) {
        setContent(file.content || String(file.metadata?.textContent || ''));
        setCurrentFilePath(filePath);
        setIsDirty(false);
      }
    }
  }, [filePath, vfs]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
    updateCursorPos(e.target);
  };

  const updateCursorPos = (target: HTMLTextAreaElement) => {
    const textBefore = target.value.substring(0, target.selectionStart);
    const lines = textBefore.split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    setCursorPos({
      line: lines.length,
      col: lastLine.length + 1,
    });
  };

  const handleSave = () => {
    if (!currentFilePath) {
      handleSaveAs();
      return;
    }

    const fileName = currentFilePath.split('/').pop() || 'Untitled.txt';
    const parentPath = currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) || 'C:/Documents';

    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: fileName,
        path: currentFilePath,
        parentPath,
        kind: 'text',
        sizeBytes: new Blob([content]).size,
        content,
        metadata: { textContent: content },
      },
    });
    setIsDirty(false);
  };

  const handleSaveAs = () => {
    const fileName = prompt('Enter filename:', 'NewDocument.txt');
    if (!fileName) return;
    const targetPath = `C:/Documents/${fileName}`;
    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: fileName,
        path: targetPath,
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: new Blob([content]).size,
        content,
        metadata: { textContent: content },
      },
    });
    setCurrentFilePath(targetPath);
    setIsDirty(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white text-black font-mono text-xs select-none">
      {/* Menu Bar */}
      <div className="flex gap-3 px-2 py-1 bg-[#dfdfdf] border-b border-gray-400 font-sans text-xs select-none">
        <button onClick={handleSave} className="hover:underline cursor-pointer">
          Save
        </button>
        <button onClick={handleSaveAs} className="hover:underline cursor-pointer">
          Save As...
        </button>
        <button onClick={() => setWordWrap(!wordWrap)} className="hover:underline cursor-pointer">
          {wordWrap ? '✓ Word Wrap' : 'Word Wrap'}
        </button>
      </div>

      {/* Textarea Canvas */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleTextChange}
        onKeyUp={(e) => updateCursorPos(e.currentTarget)}
        onClick={(e) => updateCursorPos(e.currentTarget)}
        wrap={wordWrap ? 'soft' : 'off'}
        className="flex-1 w-full p-2 outline-none resize-none font-mono text-xs text-gray-900 bg-white"
        spellCheck={false}
      />

      {/* Status Bar */}
      <div className="flex justify-between px-2 py-0.5 bg-[#dfdfdf] border-t border-gray-400 font-sans text-[11px] text-gray-600">
        <span>{isDirty ? '● Modified' : 'Saved'}</span>
        <span>
          Ln {cursorPos.line}, Col {cursorPos.col} | {content.length} chars
        </span>
      </div>
    </div>
  );
};
