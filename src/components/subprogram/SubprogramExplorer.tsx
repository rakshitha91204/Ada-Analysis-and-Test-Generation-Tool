import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { ContextMenu } from './ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';
import { Subprogram } from '../../types/subprogram.types';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { generateTestCases } from '../../utils/testCaseGenerator';
import { useSettingsStore } from '../../store/useSettingsStore';

// ── Inline row ────────────────────────────────────────────────────────────────
const SubRow: React.FC<{
  sub: Subprogram;
  isActive: boolean;
  isCursor: boolean;
  searchQuery: string;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}> = ({ sub, isActive, isCursor, searchQuery, onContextMenu }) => {
  const { selectSubprogram } = useSubprogramStore();
  const { setActiveTab, openTab, navigateTo } = useEditorStore();
  const { setActiveFile } = useFileStore();
  const { currentTestSets, setCurrentTests } = useTestCaseStore();
  const { enableTestGen } = useSettingsStore();

  const handleClick = () => {
    selectSubprogram(sub.id);
    setActiveFile(sub.fileId);
    openTab(sub.fileId);
    navigateTo(sub.startLine, sub.fileId, sub.id);
    setActiveTab('code');
    if (enableTestGen && !currentTestSets[sub.id]?.length) {
      setCurrentTests(sub.id, generateTestCases(sub));
    }
  };

  // Highlight matching text in name
  const renderName = () => {
    if (!searchQuery.trim()) return <span>{sub.name}</span>;
    const idx = sub.name.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (idx === -1) return <span>{sub.name}</span>;
    return (
      <>
        {sub.name.slice(0, idx)}
        <span style={{ background: 'rgba(250,204,21,0.35)', color: '#fde047', borderRadius: 2, padding: '0 1px' }}>
          {sub.name.slice(idx, idx + searchQuery.length)}
        </span>
        {sub.name.slice(idx + searchQuery.length)}
      </>
    );
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); selectSubprogram(sub.id); onContextMenu(e, sub.id); }}
      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all select-none group"
      style={{
        background: isActive ? 'rgba(250,204,21,0.12)' : isCursor ? 'rgba(250,204,21,0.05)' : 'transparent',
        borderLeft: isActive ? '2px solid #facc15' : isCursor ? '2px solid rgba(250,204,21,0.4)' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = isCursor ? 'rgba(250,204,21,0.05)' : 'transparent';
      }}
    >
      {/* Kind indicator dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: sub.kind === 'procedure' ? '#facc15' : '#fb923c' }}
      />

      {/* Name */}
      <span
        className="flex-1 text-xs font-mono truncate"
        style={{ color: isActive ? '#facc15' : '#e4e4e7' }}
      >
        {renderName()}
      </span>

      {/* Line number */}
      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#52525b' }}>
        {sub.startLine}L
      </span>
    </div>
  );
};

// ── Main Explorer ─────────────────────────────────────────────────────────────
type KindTab = 'procedures' | 'functions';

export const SubprogramExplorer: React.FC = () => {
  const { subprograms, selectedSubprogramId } = useSubprogramStore();
  const { files, activeFileId } = useFileStore();
  const { cursorPosition, activeTab } = useEditorStore();
  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<KindTab>('procedures');
  const [procOpen, setProcOpen] = useState(true);
  const [funcOpen, setFuncOpen] = useState(true);
  const { menu, open, close } = useContextMenu();
  const searchRef = React.useRef<HTMLInputElement>(null);

  const currentLine = cursorPosition.line;
  const isParsing = files.some((f) => f.status === 'parsing' || f.status === 'pending');

  const cursorSubId = useMemo(() => {
    if (activeTab !== 'code') return null;
    return subprograms.find(
      (s) => s.fileId === activeFileId && s.startLine <= currentLine && s.endLine >= currentLine
    )?.id ?? null;
  }, [subprograms, currentLine, activeFileId, activeTab]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subprograms;
    const q = search.toLowerCase();
    return subprograms.filter(
      (s) => s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q)
    );
  }, [subprograms, search]);

  const procedures = useMemo(() => filtered.filter((s) => s.kind === 'procedure'), [filtered]);
  const functions = useMemo(() => filtered.filter((s) => s.kind === 'function'), [filtered]);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => open(e, id), [open]);

  // When searching, show both sections
  const showingSearch = search.trim().length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0a0a' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #1c1c1c' }}
      >
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: '#facc15' }}>
          Subprograms
        </span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: '#1c1c1c', color: '#71717a' }}
        >
          {subprograms.length}
        </span>
      </div>

      {/* ── Search ── */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #1c1c1c' }}>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#52525b' }} />
          <input
            ref={searchRef}
            id="subprogram-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subprograms..."
            className="w-full pl-7 pr-6 py-1.5 text-xs font-mono rounded focus:outline-none transition-all"
            style={{
              background: '#141414',
              border: `1px solid ${search ? '#facc15' : '#2a2a2a'}`,
              color: '#e4e4e7',
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); searchRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: '#52525b' }}
            >
              <X size={11} />
            </button>
          )}
        </div>
        {search && (
          <p className="text-[9px] font-mono mt-1" style={{ color: '#52525b' }}>
            {filtered.length} match{filtered.length !== 1 ? 'es' : ''}
          </p>
        )}
      </div>

      {/* ── Kind tabs (only when not searching) ── */}
      {!showingSearch && (
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid #1c1c1c' }}>
          {(['procedures', 'functions'] as KindTab[]).map((kind) => {
            const count = kind === 'procedures' ? procedures.length : functions.length;
            const isActive = activeKind === kind;
            return (
              <button
                key={kind}
                onClick={() => setActiveKind(kind)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider transition-all"
                style={{
                  background: isActive ? 'rgba(250,204,21,0.08)' : 'transparent',
                  color: isActive ? '#facc15' : '#52525b',
                  borderBottom: isActive ? '2px solid #facc15' : '2px solid transparent',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: kind === 'procedures' ? '#facc15' : '#fb923c' }}
                />
                {kind}
                <span
                  className="text-[9px] px-1 rounded"
                  style={{ background: '#1c1c1c', color: isActive ? '#facc15' : '#3f3f46' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {isParsing && subprograms.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent spin" style={{ borderColor: '#facc15', borderTopColor: 'transparent' }} />
            <p className="text-xs font-mono" style={{ color: '#52525b' }}>Parsing Ada files...</p>
          </div>
        ) : subprograms.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <p className="text-xs font-mono" style={{ color: '#3f3f46' }}>No subprograms detected</p>
            <p className="text-[10px] font-mono" style={{ color: '#27272a' }}>Upload an Ada file to begin</p>
          </div>
        ) : showingSearch ? (
          // Search results — show all kinds
          <>
            {procedures.length > 0 && (
              <Section
                label="Procedures"
                count={procedures.length}
                open={procOpen}
                onToggle={() => setProcOpen((v) => !v)}
                color="#facc15"
              >
                {procedures.map((s) => (
                  <SubRow key={s.id} sub={s} isActive={selectedSubprogramId === s.id} isCursor={cursorSubId === s.id} searchQuery={search} onContextMenu={handleContextMenu} />
                ))}
              </Section>
            )}
            {functions.length > 0 && (
              <Section
                label="Functions"
                count={functions.length}
                open={funcOpen}
                onToggle={() => setFuncOpen((v) => !v)}
                color="#fb923c"
              >
                {functions.map((s) => (
                  <SubRow key={s.id} sub={s} isActive={selectedSubprogramId === s.id} isCursor={cursorSubId === s.id} searchQuery={search} onContextMenu={handleContextMenu} />
                ))}
              </Section>
            )}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs font-mono" style={{ color: '#52525b' }}>No match for "{search}"</p>
              </div>
            )}
          </>
        ) : activeKind === 'procedures' ? (
          procedures.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs font-mono" style={{ color: '#3f3f46' }}>No procedures found</p>
            </div>
          ) : (
            procedures.map((s) => (
              <SubRow key={s.id} sub={s} isActive={selectedSubprogramId === s.id} isCursor={cursorSubId === s.id} searchQuery="" onContextMenu={handleContextMenu} />
            ))
          )
        ) : (
          functions.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs font-mono" style={{ color: '#3f3f46' }}>No functions found</p>
            </div>
          ) : (
            functions.map((s) => (
              <SubRow key={s.id} sub={s} isActive={selectedSubprogramId === s.id} isCursor={cursorSubId === s.id} searchQuery="" onContextMenu={handleContextMenu} />
            ))
          )
        )}

        {/* Cursor hint */}
        {cursorSubId && (
          <div
            className="mx-3 my-2 px-2.5 py-1.5 rounded text-[10px] font-mono flex items-center gap-2"
            style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.15)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#facc15' }} />
            <span style={{ color: '#52525b' }}>Cursor in:</span>
            <span className="font-semibold" style={{ color: '#facc15' }}>
              {subprograms.find((s) => s.id === cursorSubId)?.name}
            </span>
            <span className="ml-auto" style={{ color: '#3f3f46' }}>L{currentLine}</span>
          </div>
        )}
      </div>

      {menu.visible && menu.targetId && (
        <ContextMenu x={menu.x} y={menu.y} subprogramId={menu.targetId} onClose={close} />
      )}
    </div>
  );
};

// ── Collapsible section header ────────────────────────────────────────────────
const Section: React.FC<{
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  color: string;
  children: React.ReactNode;
}> = ({ label, count, open, onToggle, color, children }) => (
  <div>
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-1.5 transition-colors"
      style={{ borderBottom: '1px solid #1c1c1c' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {open ? <ChevronDown size={10} style={{ color: '#52525b' }} /> : <ChevronRight size={10} style={{ color: '#52525b' }} />}
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-[9px] font-mono uppercase tracking-widest flex-1 text-left" style={{ color: '#71717a' }}>
        {label}
      </span>
      <span className="text-[9px] font-mono px-1 rounded" style={{ background: '#1c1c1c', color: '#52525b' }}>
        {count}
      </span>
    </button>
    {open && children}
  </div>
);
