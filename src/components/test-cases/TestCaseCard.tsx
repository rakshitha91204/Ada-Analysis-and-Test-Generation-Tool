import React, { useState } from 'react';
import { Play, Edit2, Copy, X, ChevronDown, ChevronRight, GripVertical, MessageSquare } from 'lucide-react';
import { TestCase } from '../../types/testcase.types';
import { Badge } from '../shared/Badge';
import { TestCaseEditor } from './TestCaseEditor';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';

interface TestCaseCardProps {
  testCase: TestCase;
  index: number;
  subprogramId: string;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDrop?: () => void;
  isDragging?: boolean;
}

const typeVariant = { normal: 'success', edge: 'primary', invalid: 'danger' } as const;
const statusIcon = {
  pending: <span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" />,
  running: <span className="w-2 h-2 rounded-full bg-amber-400 inline-block spin" />,
  pass: <span className="text-green-400 text-xs">✓</span>,
  fail: <span className="text-red-400 text-xs">✗</span>,
};

export const TestCaseCard: React.FC<TestCaseCardProps> = ({
  testCase, index, subprogramId,
  onDragStart, onDragOver, onDrop, isDragging,
}) => {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(testCase.coverageHint ?? '');
  const { updateTestCase, currentTestSets, setCurrentTests } = useTestCaseStore();
  const { subprograms } = useSubprogramStore();
  const { setHighlight, setActiveTab } = useEditorStore();

  const sub = subprograms.find((s) => s.id === subprogramId);

  const handleCardClick = () => {
    if (sub) {
      setHighlight({ start: sub.startLine, end: sub.endLine });
      setActiveTab('code');
      setTimeout(() => setActiveTab('tests'), 100);
    }
  };

  const handleClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tests = currentTestSets[subprogramId] || [];
    const cloned = { ...testCase, id: crypto.randomUUID() };
    setCurrentTests(subprogramId, [...tests, cloned]);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tests = (currentTestSets[subprogramId] || []).filter((t) => t.id !== testCase.id);
    setCurrentTests(subprogramId, tests);
  };

  const inputStr = Object.entries(testCase.inputs)
    .map(([k, v]) => `${k} => ${JSON.stringify(v)}`)
    .join(', ');

  return (
    <>
      <div
        className={`rounded-lg border transition-all cursor-pointer hover:border-zinc-600 ${isDragging ? 'opacity-40 scale-95' : ''}`}
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
        onClick={handleCardClick}
        draggable
        onDragStart={() => onDragStart?.(index)}
        onDragOver={(e) => { e.preventDefault(); onDragOver?.(index); }}
        onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Drag handle */}
          <span
            className="text-zinc-700 hover:text-zinc-400 cursor-grab active:cursor-grabbing flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} />
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <span className="text-xs font-mono text-zinc-500">Test_{index + 1}:</span>
          <Badge variant={typeVariant[testCase.type]}>{testCase.type}</Badge>
          <div className="ml-auto flex items-center gap-1">
            {testCase.runStatus && statusIcon[testCase.runStatus]}
          </div>
        </div>

        {/* Body */}
        <div className="px-3 pb-2 pl-8">
          <p className="text-xs font-mono text-zinc-400">
            Input =&gt; ({inputStr})
          </p>
          <p className="text-xs font-mono text-zinc-400">
            Expected =&gt; <span className="text-zinc-200">{String(testCase.expected)}</span>
          </p>
          {testCase.coverageHint && (
            <p className="text-[10px] font-mono text-amber-500/70 italic mt-1">
              {testCase.coverageHint}
            </p>
          )}
          {testCase.runStatus === 'fail' && testCase.actualOutput && (
            <p className="text-[10px] font-mono text-red-400 mt-1">
              Actual: {testCase.actualOutput}
            </p>
          )}
        </div>

        {/* Expanded detail */}
        <div
          className="accordion-content px-3"
          style={{ maxHeight: expanded ? '200px' : '0', opacity: expanded ? 1 : 0 }}
        >
          <div className="pb-2 border-t pt-2" style={{ borderColor: 'var(--border-default)' }}>
            <p className="text-[10px] font-mono text-zinc-600 mb-1">Full Input Record:</p>
            {Object.entries(testCase.inputs).map(([k, v]) => (
              <p key={k} className="text-[10px] font-mono text-zinc-500 pl-2">
                {k} : {typeof v} := {JSON.stringify(v)};
              </p>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 px-3 py-1.5 border-t"
          style={{ borderColor: 'var(--border-default)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-colors">
            <Play size={9} /> Run
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            <Edit2 size={9} /> Edit
          </button>
          <button
            onClick={handleClone}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <Copy size={9} /> Clone
          </button>
          <button
            onClick={() => setShowNote((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${showNote ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10'}`}
          >
            <MessageSquare size={9} /> Note
          </button>
          <button
            onClick={handleRemove}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
          >
            <X size={9} /> Remove
          </button>
        </div>

        {/* Inline note editor */}
        {showNote && (
          <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--border-default)' }} onClick={(e) => e.stopPropagation()}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => updateTestCase(subprogramId, testCase.id, { coverageHint: note })}
              placeholder="Add a note or coverage hint..."
              rows={2}
              className="w-full mt-2 px-2 py-1.5 text-[10px] font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none transition-colors"
            />
          </div>
        )}
      </div>

      {editing && (
        <TestCaseEditor
          testCase={testCase}
          onSave={(updates) => updateTestCase(subprogramId, testCase.id, updates)}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
};
