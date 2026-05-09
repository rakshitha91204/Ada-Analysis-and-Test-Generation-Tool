import { useCallback, useEffect, useRef, useState } from 'react';

type Direction = 'horizontal' | 'vertical';

export function useResizablePanel(
  initialSize: number,
  direction: Direction,
  onSizeChange?: (size: number) => void,
  min = 100,
  max = 800
) {
  const [size, setSize] = useState(initialSize);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(initialSize);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
      startSize.current = size;
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, size]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta =
        direction === 'horizontal'
          ? startPos.current - e.clientX
          : startPos.current - e.clientY;
      const newSize = Math.max(min, Math.min(max, startSize.current + delta));
      setSize(newSize);
      onSizeChange?.(newSize);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [direction, min, max, onSizeChange]);

  return { size, onMouseDown };
}
