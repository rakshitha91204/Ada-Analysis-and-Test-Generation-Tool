import { useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useTestCaseStore } from '../store/useTestCaseStore';
import { useSubprogramStore } from '../store/useSubprogramStore';
import { useSettingsStore } from '../store/useSettingsStore';

export function useKeyboardShortcuts(onOpenCommandPalette?: (open: boolean) => void) {
  const { setActiveTab, toggleRightPanel, toggleBottomPanel } = useEditorStore();
  const { exportCurrent } = useTestCaseStore();
  const { selectedSubprogramId, subprograms } = useSubprogramStore();
  const { fontSize, setFontSize, minimapEnabled, setMinimapEnabled } = useSettingsStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Ctrl+K → command palette
      if (ctrl && e.key === 'k' && !inInput) {
        e.preventDefault();
        onOpenCommandPalette?.(true);
        return;
      }

      // ? → keyboard shortcuts modal (not in input)
      if (e.key === '?' && !inInput && !ctrl) {
        e.preventDefault();
        // Dispatch custom event picked up by EditorPage
        window.dispatchEvent(new CustomEvent('ada:shortcuts'));
        return;
      }

      // Ctrl+Shift+T → Test Cases tab
      if (ctrl && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setActiveTab('tests');
        return;
      }

      // Ctrl+Shift+G → Graph tab
      if (ctrl && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setActiveTab('graph');
        return;
      }

      // Ctrl+Shift+P → focus subprogram search
      if (ctrl && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        (document.getElementById('subprogram-search') as HTMLInputElement)?.focus();
        return;
      }

      // Ctrl+E → export JSON
      if (ctrl && e.key === 'e' && !inInput) {
        e.preventDefault();
        if (selectedSubprogramId) {
          const sub = subprograms.find((s) => s.id === selectedSubprogramId);
          if (sub) exportCurrent(selectedSubprogramId, sub.name);
        }
        return;
      }

      // Ctrl+\ → toggle right panel
      if (ctrl && e.key === '\\') {
        e.preventDefault();
        toggleRightPanel();
        return;
      }

      // Ctrl+` → toggle bottom panel
      if (ctrl && e.key === '`') {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      // Ctrl++ → increase font
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setFontSize(fontSize + 1);
        return;
      }

      // Ctrl+- → decrease font
      if (ctrl && e.key === '-') {
        e.preventDefault();
        setFontSize(fontSize - 1);
        return;
      }

      // Ctrl+M → toggle minimap
      if (ctrl && e.key === 'm' && !inInput) {
        e.preventDefault();
        setMinimapEnabled(!minimapEnabled);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    setActiveTab, toggleRightPanel, toggleBottomPanel, exportCurrent,
    selectedSubprogramId, subprograms, fontSize, setFontSize,
    minimapEnabled, setMinimapEnabled, onOpenCommandPalette,
  ]);

  // Listen for shortcuts modal event
  useEffect(() => {
    const h = () => window.dispatchEvent(new CustomEvent('ada:shortcuts'));
    return () => {};
  }, []);
}
