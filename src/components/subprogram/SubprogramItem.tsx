import React, { useState } from 'react';
import { Zap, FunctionSquare, TestTube, ChevronRight, ChevronDown, Clock } from 'lucide-react';
import { Subprogram } from '../../types/subprogram.types';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useFileStore } from '../../store/useFileStore';
import { generateTestCases } from '../../utils/testCaseGenerator';
import { useSettingsStore } from '../../store/useSettingsStore';
import { format } from 'date-fns';

interface SubprogramItemProps {
  subprogram: Subprogram;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  currentLine?: number;
  searchQuery?: string;
}

const complexityColor = (lines: number) => {
  if (lines <= 10) return 'text-green-400';
  if (lines <= 25) return 'text-amber-400';
  return 'text-red-400';
};

export const SubprogramItem: React.FC<SubprogramItemProps> = ({
  subprogram,
  onContextMenu,
  currentLine,
  searchQuery = '',
}) => {
  const { selectedSubprogramId, selectSubprogram } = useSubprogramStore();
  const { setActiveTab, openTab, navigateTo } = useEditorStore();
  const { currentTestSets, setCurrentTests } = useTestCaseStore();
  const { setActiveFile } = useFileStore();
  const { enableTestGen } = useSettingsStore();
  const [expanded, setExpanded] = useState(false);

  const isSelected = selectedSubprogramId === subprogram.id;
  const tests = currentTestSets[subprogram.id] || [];
  const testCount = tests.length;
  const passCount = tests.filter((t) => t.runStatus === 'pass').length;
  const failCount = tests.filter((t) => t.runStatus === 'fail').length;
  const lineCount = subprogram.endLine - subprogram.startLine + 1;

  // Is the cursor currently inside this subprogram?
  const isCursorInside =
    currentLine !== undefined &&
    currentLine >= subprogram.startLine &&
    currentLine <= subprogram.endLine;

  // Highlight matching characters in name
  const highlightName = (name: string, query: string) => {
    if (!query.trim()) return <span>{name}</span>;
    const idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{name}</span>;
    return (
      <>
        <span>{name.slice(0, idx)}</span>
        <span className="bg-amber-500/30 text-amber-300 rounded-sm px-0.5">{name.slice(idx, idx + query.length)}</span>
        <span>{name.slice(idx + query.length)}</span>
      </>
    );
  };

  const handleClick = () => {
    // 1. Select subprogram in store
    selectSubprogram(subprogram.id);
    // 2. Open the file tab
    setActiveFile(subprogram.fileId);
    openTab(subprogram.fileId);
    // 3. Queue the navigation BEFORE switching tab so it fires after Monaco renders
    navigateTo(subprogram.startLine, subprogram.fileId, subprogram.id);
    // 4. Switch to code view (Monaco will be visible, nav fires 80ms later)
    setActiveTab('code');
    // 5. Auto-generate tests if none exist
    if (enableTestGen && !currentTestSets[subprogram.id]?.length) {
      setCurrentTests(subprogram.id, generateTestCases(subprogram));
    }
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <div
      className={`group transition-all border-l-2 ${
        isSelected
          ? 'border-amber-500 bg-amber-500/5'
          : isCursorInside
          ? 'border-blue-500/50 bg-blue-500/5'
          : 'border-transparent hover:bg-zinc-800/40 hover:border-zinc-700'
      }`}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 cursor-pointer"
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, subprogram.id)}
      >
        {/* Expand toggle */}
        <button
          onClick={handleExpandToggle}
          className="text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>

        {/* Kind icon */}
        {subprogram.kind === 'procedure' ? (
          <Zap size={12} className={`flex-shrink-0 ${isSelected ? 'text-amber-400' : 'text-amber-500/70'}`} />
        ) : (
          <FunctionSquare size={12} className={`flex-shrink-0 ${isSelected ? 'text-orange-400' : 'text-orange-500/70'}`} />
        )}

        {/* Name */}
        <span
          className={`text-xs font-mono font-semibold flex-1 truncate ${
            isSelected ? 'text-amber-300' : isCursorInside ? 'text-blue-300' : 'text-zinc-200'
          }`}
        >
          {highlightName(subprogram.name, searchQuery)}
        </span>

        {/* Cursor-inside indicator */}
        {isCursorInside && !isSelected && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="Cursor is here" />
        )}

        {/* Line count */}
        <span className={`text-[9px] font-mono flex-shrink-0 ${complexityColor(lineCount)}`}>
          {lineCount}L
        </span>

        {/* Test status */}
        {testCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-mono flex-shrink-0">
            <TestTube size={9} className="text-amber-500" />
            {failCount > 0 ? (
              <span className="text-red-400">{failCount}✗</span>
            ) : passCount > 0 ? (
              <span className="text-green-400">{passCount}✓</span>
            ) : (
              <span className="text-zinc-500">{testCount}</span>
            )}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-3 pb-2 pl-8 flex flex-col gap-1 border-t"
          style={{ borderColor: 'var(--border-default)' }}
        >
          {/* Line range */}
          <div className="flex items-center gap-2 pt-1.5">
            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Lines</span>
            <span className="text-[10px] font-mono text-zinc-400">
              {subprogram.startLine} – {subprogram.endLine}
            </span>
            <button
              onClick={handleClick}
              className="ml-auto text-[9px] font-mono text-amber-500/70 hover:text-amber-400 transition-colors"
            >
              → Go to line {subprogram.startLine}
            </button>
          </div>

          {/* Return type */}
          {subprogram.returnType && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Returns</span>
              <span className="text-[10px] font-mono text-orange-400">{subprogram.returnType}</span>
            </div>
          )}

          {/* Parameters */}
          {subprogram.parameters.length > 0 && (
            <div>
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
                Parameters ({subprogram.parameters.length})
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {subprogram.parameters.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 pl-2">
                    <span
                      className={`text-[9px] font-mono px-1 rounded ${
                        p.mode === 'in' ? 'bg-blue-500/15 text-blue-400' :
                        p.mode === 'out' ? 'bg-green-500/15 text-green-400' :
                        'bg-purple-500/15 text-purple-400'
                      }`}
                    >
                      {p.mode}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-300">{p.name}</span>
                    <span className="text-[10px] font-mono text-zinc-600">:</span>
                    <span className="text-[10px] font-mono text-orange-400/80">{p.paramType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test summary */}
          {testCount > 0 && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Tests</span>
              <span className="text-[10px] font-mono text-green-400">{passCount} pass</span>
              {failCount > 0 && <span className="text-[10px] font-mono text-red-400">{failCount} fail</span>}
              <span className="text-[10px] font-mono text-zinc-600">{testCount} total</span>
            </div>
          )}

          {/* Last generated */}
          {subprogram.lastGeneratedAt && (
            <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-700">
              <Clock size={8} />
              {format(new Date(subprogram.lastGeneratedAt), 'MMM d, HH:mm')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
