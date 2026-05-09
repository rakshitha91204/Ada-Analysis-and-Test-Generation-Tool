import React from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Subprogram } from '../../types/subprogram.types';
import { useState } from 'react';

interface ParametersModalProps {
  sub: Subprogram;
  onClose: () => void;
}

const modeColor: Record<string, string> = {
  'in': '#60a5fa',
  'out': '#4ade80',
  'in out': '#c084fc',
};

export const ParametersModal: React.FC<ParametersModalProps> = ({ sub, onClose }) => {
  const [copied, setCopied] = useState(false);

  const signature = sub.kind === 'function'
    ? `function ${sub.name} (\n${sub.parameters.map((p) => `  ${p.name} : ${p.mode} ${p.paramType}`).join(';\n')}\n) return ${sub.returnType ?? 'Unknown'}`
    : `procedure ${sub.name} (\n${sub.parameters.map((p) => `  ${p.name} : ${p.mode} ${p.paramType}`).join(';\n')}\n)`;

  const handleCopy = () => {
    navigator.clipboard.writeText(signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{ background: '#111111', border: '1px solid #facc15', maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e1e', background: '#0d0d0d' }}>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#52525b' }}>{sub.kind}</p>
            <p className="text-base font-mono font-bold" style={{ color: '#facc15' }}>{sub.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors"
              style={{ background: '#1a1a1a', color: copied ? '#4ade80' : '#a1a1aa', border: '1px solid #2a2a2a' }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy signature'}
            </button>
            <button onClick={onClose} style={{ color: '#52525b' }} className="hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Parameters */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {sub.parameters.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm font-mono" style={{ color: '#52525b' }}>No parameters</p>
              <p className="text-xs font-mono mt-1" style={{ color: '#3f3f46' }}>This {sub.kind} takes no arguments</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: '#52525b' }}>
                Parameters ({sub.parameters.length})
              </p>
              <div className="flex flex-col gap-2">
                {sub.parameters.map((p, i) => (
                  <div
                    key={`${p.name}_${i}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: '#1a1a1a', border: '1px solid #222' }}
                  >
                    {/* Mode badge */}
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: `${modeColor[p.mode]}18`,
                        color: modeColor[p.mode],
                        border: `1px solid ${modeColor[p.mode]}40`,
                      }}
                    >
                      {p.mode}
                    </span>
                    {/* Name */}
                    <span className="text-sm font-mono font-semibold flex-1" style={{ color: '#e4e4e7' }}>
                      {p.name}
                    </span>
                    {/* Type */}
                    <span className="text-sm font-mono" style={{ color: '#fb923c' }}>
                      {p.paramType}
                    </span>
                  </div>
                ))}
              </div>

              {/* Return type */}
              {sub.returnType && (
                <div className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: '#1a1a1a', border: '1px solid #222' }}>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: '#fb923c18', color: '#fb923c', border: '1px solid #fb923c40' }}>
                    return
                  </span>
                  <span className="text-sm font-mono font-semibold" style={{ color: '#fb923c' }}>{sub.returnType}</span>
                </div>
              )}

              {/* Full signature preview */}
              <div className="mt-4">
                <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#52525b' }}>Ada Signature</p>
                <pre
                  className="text-xs font-mono p-3 rounded-lg overflow-x-auto"
                  style={{ background: '#0a0a0a', color: '#a1a1aa', border: '1px solid #1e1e1e', lineHeight: 1.6 }}
                >
                  {signature}
                </pre>
              </div>
            </>
          )}

          {/* Line info */}
          <div className="mt-4 flex items-center gap-4 text-[10px] font-mono" style={{ color: '#3f3f46' }}>
            <span>Lines {sub.startLine}–{sub.endLine}</span>
            <span>·</span>
            <span>{sub.endLine - sub.startLine + 1} lines</span>
            {sub.lastGeneratedAt && (
              <>
                <span>·</span>
                <span>Tests generated</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
