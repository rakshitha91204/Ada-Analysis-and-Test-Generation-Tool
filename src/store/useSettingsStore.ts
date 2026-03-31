import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  enableTestGen: boolean;
  enableStaticAnalysis: boolean;
  rightPanelWidth: number;
  bottomPanelHeight: number;
  panelSizes: Record<string, number>;
  fontSize: number;
  minimapEnabled: boolean;
  splitEditor: boolean;
  theme: 'ada-dark' | 'ada-soft' | 'ada-purple';
  setEnableTestGen: (v: boolean) => void;
  setEnableStaticAnalysis: (v: boolean) => void;
  setRightPanelWidth: (w: number) => void;
  setBottomPanelHeight: (h: number) => void;
  setPanelSize: (key: string, size: number) => void;
  setFontSize: (s: number) => void;
  setMinimapEnabled: (v: boolean) => void;
  setSplitEditor: (v: boolean) => void;
  setTheme: (t: 'ada-dark' | 'ada-soft' | 'ada-purple') => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      enableTestGen: true,
      enableStaticAnalysis: true,
      rightPanelWidth: 280,
      bottomPanelHeight: 200,
      panelSizes: {},
      fontSize: 14,
      minimapEnabled: true,
      splitEditor: false,
      theme: 'ada-purple',

      setEnableTestGen: (v) => set({ enableTestGen: v }),
      setEnableStaticAnalysis: (v) => set({ enableStaticAnalysis: v }),
      setRightPanelWidth: (w) => set({ rightPanelWidth: Math.max(180, Math.min(600, w)) }),
      setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.max(100, Math.min(500, h)) }),
      setPanelSize: (key, size) =>
        set((state) => ({ panelSizes: { ...state.panelSizes, [key]: size } })),
      setFontSize: (s) => set({ fontSize: Math.max(10, Math.min(24, s)) }),
      setMinimapEnabled: (v) => set({ minimapEnabled: v }),
      setSplitEditor: (v) => set({ splitEditor: v }),
      setTheme: (t) => set({ theme: t }),
    }),
    { name: 'ada_settings' }
  )
);
