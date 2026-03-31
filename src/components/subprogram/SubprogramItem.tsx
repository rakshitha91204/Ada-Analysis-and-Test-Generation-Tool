import React from 'react';
import { Zap, FunctionSquare, TestTube } from 'lucide-react';
import { Subprogram } from '../../types/subprogram.types';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useFileStore } from '../../store/useFileStore';
import { generateTestCases } from '../../utils/testCaseGenerator';
import { useSettingsStore } from '../../store/useSettingsStore';

interface SubprogramItemProps {
  subprogram: Subprogram;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export const SubprogramItem: React.FC<SubprogramItemProps> = ({ subprogram, onContextMenu }) => {
  const { selectedSubprogramId, selectSubprogram } = useSubprogramStore();
  const { setActiveTab, setHighlight, openTab } = useEditorStore();
  const { currentTestSets, setCurrentTests } = useTestCaseStore();
  const { setActiveFile } = useFileStore();
  const { enableTestGen } = useSettingsStore();

  const isSelected = selectedSubprogramId === subprogram.id;
  const testCount = (currentTestSets[subprogram.id] || []).length;

  const handleClick = () => {
    selectSubprogram(subprogram.id);
    setActiveFile(subprogram.fileId);
    openTab(subprogram.fileId);
    setHighlight({ start: subprogram.startLine, end: subprogram.endLine });
    setActiveTab('tests');

    if (enableTestGen && !currentTestSets[subprogram.id]?.length) {
      const tests = generateTestCases(subprogram);
      setCurrentTests(subprogram.id, tests);
    }
  };

  const paramPreview = subprogram.parameters
    .slice(0, 2)
    .map((p) => `${p.name}: ${p.paramType}`)
    .join(', ');
  const hasMore = subprogram.parameters.length > 2;

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, subprogram.id)}
      className={`group flex flex-col gap-0.5 px-3 py-2 cursor-pointer transition-all border-l-2 ${
        isSelected
          ? 'border-amber-500 bg-amber-500/5'
          : 'border-transparent hover:bg-zinc-800/40 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center gap-2">
        {subprogram.kind === 'procedure' ? (
          <Zap size={12} className="text-amber-400 flex-shrink-0" />
        ) : (
          <FunctionSquare size={12} className="text-orange-400 flex-shrink-0" />
        )}
        <span className={`text-xs font-mono font-semibold flex-1 truncate ${isSelected ? 'text-amber-300' : 'text-zinc-200'}`}>
          {subprogram.name}
        </span>
        {testCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-mono text-amber-500">
            <TestTube size={9} />
            {testCount}
          </span>
        )}
      </div>
      {subprogram.parameters.length > 0 && (
        <p className="text-[10px] font-mono text-zinc-600 pl-5 truncate">
          ({paramPreview}{hasMore ? ', ...' : ''})
        </p>
      )}
      {subprogram.returnType && (
        <p className="text-[10px] font-mono text-zinc-600 pl-5">
          → <span className="text-orange-500/70">{subprogram.returnType}</span>
        </p>
      )}
    </div>
  );
};
