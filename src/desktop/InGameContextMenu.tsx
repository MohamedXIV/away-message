import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface GameContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface GameContextMenuState {
  x: number;
  y: number;
  label: string;
  items: GameContextMenuItem[];
}

/** UI-only menu for the simulated world and OS. Never invokes the host browser
 * menu, follows the current target, and doesn't create a simulation owner. */
export function InGameContextMenu({
  menu, onClose, testId = 'in-game-context-menu',
}: {
  menu: GameContextMenuState | null;
  onClose: () => void;
  testId?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        if (!items.length) return;
        event.preventDefault();
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : event.key === 'ArrowDown' ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    const dismiss = () => onClose();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  const menuWidth = 225;
  const menuHeight = 20 + menu.items.length * 32;
  const x = Math.max(4, Math.min(menu.x, window.innerWidth - menuWidth - 4));
  const y = Math.max(4, Math.min(menu.y, window.innerHeight - menuHeight - 4));
  return createPortal(
    <div ref={menuRef} data-testid={testId} role="menu" aria-label={menu.label}
      className="os-context-menu"
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
      style={{ position: 'fixed', left: x, top: y, zIndex: 2147483000, width: menuWidth,
        maxHeight: 'calc(100vh - 8px)', overflowY: 'auto', fontFamily: 'Tahoma, sans-serif',
        fontSize: 12 }}>
      <div className="border-b border-gray-500/60 px-2 py-1 text-[11px] font-semibold opacity-80">
        {menu.label}
      </div>
      {menu.items.map((item, index) => (
        <div key={index}>
          {item.separatorBefore && <div role="separator" className="my-1 border-t border-gray-500/60" />}
          <button type="button" role="menuitem" className="os-context-item"
            disabled={item.disabled}
            onClick={() => { onClose(); item.onSelect(); }}>
            {item.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
