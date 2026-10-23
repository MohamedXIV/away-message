import React, { useCallback, useRef, useState } from 'react';
import { OsIcon } from './OsIcon';
import type { OsIconKind } from './osIconKinds';

export interface DesktopIconItem {
  id: string;
  label: string;
  appId: string;
  kind: OsIconKind;
  source?: 'system' | 'installed';
  disabled?: boolean;
  title?: string;
}

interface DesktopIconGridProps {
  icons: readonly DesktopIconItem[];
  onOpen: (icon: DesktopIconItem) => void;
  testId?: string;
  ariaLabel?: string;
}

type Direction = 'up' | 'down' | 'left' | 'right';

/** Shared responsive desktop icon surface. Icons flow top-to-bottom and then
 * into new columns, so short or narrow desktops grow sideways instead of
 * becoming one thin scrolling strip. */
export const DesktopIconGrid: React.FC<DesktopIconGridProps> = ({
  icons, onOpen, testId = 'desktop-icon-grid', ariaLabel = 'Desktop icons',
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const focusDirection = useCallback((from: HTMLButtonElement, direction: Direction) => {
    const grid = gridRef.current;
    if (!grid) return;
    const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>('[data-desktop-icon]'));
    const origin = from.getBoundingClientRect();
    const originX = origin.left + origin.width / 2;
    const originY = origin.top + origin.height / 2;
    let best: { button: HTMLButtonElement; score: number } | null = null;
    for (const button of buttons) {
      if (button === from) continue;
      const rect = button.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - originX;
      const dy = rect.top + rect.height / 2 - originY;
      const primary = direction === 'down' ? dy : direction === 'up' ? -dy : direction === 'right' ? dx : -dx;
      if (primary <= 2) continue;
      const secondary = direction === 'down' || direction === 'up' ? Math.abs(dx) : Math.abs(dy);
      const score = primary * 8 + secondary;
      if (!best || score < best.score) best = { button, score };
    }
    best?.button.focus();
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    const buttons = Array.from(
      gridRef.current?.querySelectorAll<HTMLButtonElement>('[data-desktop-icon]') ?? [],
    );
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusDirection(event.currentTarget, 'down');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusDirection(event.currentTarget, 'up');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusDirection(event.currentTarget, 'right');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusDirection(event.currentTarget, 'left');
    } else if (event.key === 'Home') {
      event.preventDefault();
      buttons[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      setSelectedId(null);
    }
  }, [focusDirection]);

  return (
    <div
      ref={gridRef}
      data-testid={testId}
      role="group"
      aria-label={ariaLabel}
      className="os-desktop-icon-grid"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setSelectedId(null);
      }}
    >
      {icons.map((icon) => {
        const unavailableLabel = `${icon.label} (installed; desktop app not available yet)`;
        return (
          <button
            key={icon.id}
            type="button"
            data-desktop-icon={icon.id}
            data-app-id={icon.appId}
            data-icon-source={icon.source ?? 'system'}
            data-selected={selectedId === icon.id ? 'true' : undefined}
            disabled={icon.disabled}
            aria-label={icon.disabled ? unavailableLabel : `Open ${icon.label}`}
            title={icon.title ?? (icon.disabled ? unavailableLabel : `Open ${icon.label}`)}
            className="os-desktop-icon"
            onFocus={() => setSelectedId(icon.id)}
            onClick={() => {
              setSelectedId(icon.id);
              if (!icon.disabled) onOpen(icon);
            }}
            onDoubleClick={() => {
              if (!icon.disabled) onOpen(icon);
            }}
            onKeyDown={handleKeyDown}
          >
            <span className="os-desktop-icon-glyph" aria-hidden="true">
              <OsIcon kind={icon.kind} size={32} />
            </span>
            <span className="os-desktop-icon-label">{icon.label}</span>
          </button>
        );
      })}
    </div>
  );
};
