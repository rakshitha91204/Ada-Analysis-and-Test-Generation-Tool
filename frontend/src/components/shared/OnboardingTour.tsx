import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  target?: string; // CSS selector to highlight
  position: 'center' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const TOUR_KEY = 'ada_tour_completed';

const steps: TourStep[] = [
  {
    title: 'Welcome to Ada IDE',
    description: 'This is a web-based IDE for Ada source code analysis and automatic test case generation. Let\'s take a quick tour.',
    position: 'center',
  },
  {
    title: 'File Manager & Package Hierarchy',
    description: 'The right panel shows your uploaded files grouped by package. It detects procedures, functions, tasks, and exceptions automatically.',
    position: 'top-right',
  },
  {
    title: 'Subprogram Explorer',
    description: 'Search for any subprogram by name. Click it to jump directly to that line in the editor. The blue dot shows where your cursor is.',
    position: 'top-right',
  },
  {
    title: 'Code Editor',
    description: 'Monaco editor with Ada syntax highlighting. Error squiggles show diagnostics inline. Gutter icons show test pass/fail status per subprogram.',
    position: 'center',
  },
  {
    title: 'Test Case Generation',
    description: 'Click any subprogram to auto-generate test cases (normal, edge, invalid). Edit, clone, run, and export them. History is saved automatically.',
    position: 'center',
  },
  {
    title: 'Call Graph',
    description: 'Visualize how subprograms call each other using Graphviz. Right-click any subprogram → Call Graph, or use Ctrl+Shift+G.',
    position: 'center',
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Press ? anytime to see all shortcuts. Ctrl+K opens the command palette. Ctrl+\\ toggles the right panel. Ctrl+E exports tests.',
    position: 'bottom-right',
  },
];

export const OnboardingTour: React.FC = () => {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      // Small delay so the page renders first
      setTimeout(() => setActive(true), 1200);
    }
  }, []);

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setActive(false);
  };

  const next = () => {
    if (step < steps.length - 1) setStep((s) => s + 1);
    else finish();
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  if (!active) return null;

  const current = steps[step];

  const positionClass: Record<TourStep['position'], string> = {
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'top-right': 'top-20 right-4',
    'bottom-left': 'bottom-20 left-4',
    'bottom-right': 'bottom-20 right-4',
  };

  return (
    <div className="fixed inset-0 z-[9993] pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={finish}
      />

      {/* Tour card */}
      <div
        className={`absolute pointer-events-auto w-80 rounded-xl border shadow-2xl context-menu-enter ${positionClass[current.position]}`}
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent-primary)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-sm font-mono font-semibold text-zinc-200 flex-1">{current.title}</span>
          <button onClick={finish} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-xs text-zinc-400 leading-relaxed">{current.description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
          {/* Step dots */}
          <div className="flex items-center gap-1 flex-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step ? 'w-4 h-1.5 bg-amber-500' : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500'
                }`}
              />
            ))}
          </div>

          <span className="text-[10px] font-mono text-zinc-600">{step + 1}/{steps.length}</span>

          <button
            onClick={prev}
            disabled={step === 0}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-900 bg-amber-500 hover:bg-amber-400 transition-colors"
          >
            {step === steps.length - 1 ? 'Done' : 'Next'}
            {step < steps.length - 1 && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export function resetTour() {
  localStorage.removeItem(TOUR_KEY);
}
