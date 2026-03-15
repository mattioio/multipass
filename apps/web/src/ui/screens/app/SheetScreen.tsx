import { useRef, useCallback, type PropsWithChildren } from "react";
import { Screen } from "../../components";

export interface SheetScreenProps extends PropsWithChildren {
  id: string;
  active?: boolean;
  className?: string;
  panelClassName?: string;
  onClose?: () => void;
}

export function SheetScreen({
  id,
  active = false,
  className = "",
  panelClassName = "",
  onClose,
  children
}: SheetScreenProps) {
  const trayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number | null;
    startY: number;
    currentY: number;
  }>({ pointerId: null, startY: 0, currentY: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Don't start drag from buttons or interactive elements
    if (target.closest("button, a, input, [data-sheet-close]")) return;
    // Only start drag from the header area
    if (!target.closest("[data-sheet-header]")) return;

    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      currentY: e.clientY
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (trayRef.current) trayRef.current.style.transition = "none";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current.currentY = e.clientY;
    const dy = Math.max(0, dragRef.current.currentY - dragRef.current.startY);
    if (trayRef.current) {
      trayRef.current.style.transform = `translateY(${dy}px)`;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current.pointerId !== e.pointerId) return;
      const dy = dragRef.current.currentY - dragRef.current.startY;
      dragRef.current.pointerId = null;

      if (trayRef.current) {
        trayRef.current.style.transition = "";
        trayRef.current.style.transform = "";
      }

      if (dy >= 120) {
        onClose?.();
      }
    },
    [onClose]
  );

  return (
    <Screen id={id} className={`sheet-screen ${className}`.trim()} active={active}>
      <div
        className="sheet-backdrop"
        data-sheet-close="true"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="sheet-tray"
        ref={trayRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={`sheet-panel ${panelClassName}`.trim()}
          data-sheet-panel="true"
        >
          {children}
        </div>
      </div>
    </Screen>
  );
}
