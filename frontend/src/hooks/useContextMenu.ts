import { useState, useEffect, useCallback } from 'react';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetId: string | null;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetId: null,
  });

  const open = useCallback((e: React.MouseEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ visible: true, x: e.clientX, y: e.clientY, targetId });
  }, []);

  const close = useCallback(() => {
    setMenu((prev) => ({ ...prev, visible: false, targetId: null }));
  }, []);

  useEffect(() => {
    if (!menu.visible) return;

    const handleClick = () => close();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu.visible, close]);

  return { menu, open, close };
}
