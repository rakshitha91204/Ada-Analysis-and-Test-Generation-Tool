import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { TestCase, TestCaseType } from '../../types/testcase.types';
import { Button } from '../shared/Button';

interface TestCaseEditorProps {
  testCase: TestCase;
  onSave: (updates: Partial<TestCase>) => void;
  onClose: () => void;
}

export const TestCaseEditor: React.FC<TestCaseEditorProps> = ({ testCase, onSave, onClose }) => {
  const [inputs, setInputs] = useState({ ...testCase.inputs });
  const [expected, setExpected] = useState(String(testCase.expected));
  const [type, setType] = useState<TestCaseType>(testCase.type);
  const [coverageHint, setCoverageHint] = useState(testCase.coverageHint ?? '');

  const handleSave = () => {
    onSave({ inputs, expected, type, coverageHint });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent-primary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <h3 className="text-sm font-mono font-semibold text-zinc-200">Edit Test Case</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-mono text-zinc-500 mb-1.5 block">Type</label>
            <div className="flex gap-2">
              {(['normal', 'edge', 'invalid'] as TestCaseType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1 rounded text-xs font-mono font-semibold uppercase transition-colors ${
                    type === t
                      ? t === 'normal' ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                        : t === 'edge' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div>
            <label className="text-xs font-mono text-zinc-500 mb-1.5 block">Inputs</label>
            <div className="flex flex-col gap-2">
              {Object.entries(inputs).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-amber-400 w-16 flex-shrink-0">{key}</span>
                  <input
                    type="text"
                    value={String(val)}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 px-2 py-1 text-xs font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Expected */}
          <div>
            <label className="text-xs font-mono text-zinc-500 mb-1.5 block">Expected Output</label>
            <input
              type="text"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Coverage hint */}
          <div>
            <label className="text-xs font-mono text-zinc-500 mb-1.5 block">Coverage Note</label>
            <input
              type="text"
              value={coverageHint}
              onChange={(e) => setCoverageHint(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-amber-500/50"
              placeholder="Optional coverage hint..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Save size={12} />} onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
