import { useCallback, useState } from 'react';
import { useSubprogramStore } from '../store/useSubprogramStore';
import { useTestCaseStore } from '../store/useTestCaseStore';

export function useTestGenerator() {
  const [generating, setGenerating] = useState(false);
  const { subprograms, selectedSubprogramId } = useSubprogramStore();
  const { generateTests, currentTestSets, saveToHistory } = useTestCaseStore();
  const { updateTestCount } = useSubprogramStore();

  const generateForSelected = useCallback(() => {
    if (!selectedSubprogramId) return;
    const sub = subprograms.find((s) => s.id === selectedSubprogramId);
    if (!sub) return;

    setGenerating(true);
    setTimeout(() => {
      generateTests(sub);
      updateTestCount(sub.id, 5);
      setGenerating(false);
    }, 400);
  }, [selectedSubprogramId, subprograms, generateTests, updateTestCount]);

  const generateForAll = useCallback(() => {
    setGenerating(true);
    let delay = 0;
    for (const sub of subprograms) {
      setTimeout(() => {
        generateTests(sub);
        updateTestCount(sub.id, 5);
      }, delay);
      delay += 200;
    }
    setTimeout(() => setGenerating(false), delay + 100);
  }, [subprograms, generateTests, updateTestCount]);

  const saveCurrentToHistory = useCallback(
    (subprogramId: string) => {
      const sub = subprograms.find((s) => s.id === subprogramId);
      if (!sub) return;
      const tests = currentTestSets[subprogramId] || [];
      saveToHistory({
        id: crypto.randomUUID(),
        subprogramId,
        subprogramName: sub.name,
        timestamp: new Date().toISOString(),
        testCases: tests,
      });
    },
    [subprograms, currentTestSets, saveToHistory]
  );

  return { generating, generateForSelected, generateForAll, saveCurrentToHistory };
}
