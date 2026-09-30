import { useEffect, useRef } from 'react';

/**
 * Close a floating panel when the student acts outside it.
 *
 * Applied to every menu, dropdown and popover in the app. Without it a panel
 * that opened stays open under the cursor, which is the most common way a
 * window stops feeling solid: you click somewhere else and nothing happens.
 *
 * Handles the awkward cases rather than the easy one: a press that *begins*
 * inside the panel does not close it even if the pointer ends up outside, so a
 * text selection that drags out of the box does not throw it away, and a press
 * on the trigger itself is left to the trigger's own logic.
 */
export function useDismissOnOutside<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
  options: {
    /** Clicks on these are treated as outside, even if inside the panel. */
    ignore?: Array<React.RefObject<HTMLElement | null>>;
    /** Also dismiss on Escape. On by default. */
    escape?: boolean;
  } = {}
) {
  const ref = useRef<T | null>(null);
  const ignore = options.ignore ?? [];
  const escape = options.escape !== false;

  useEffect(() => {
    if (!open) return;

    const isInside = (target: EventTarget | null): boolean => {
      if (!(target instanceof Node)) return false;
      if (ref.current?.contains(target)) return true;
      return ignore.some((r) => r.current?.contains(target));
    };

    const onPointerDown = (e: PointerEvent) => {
      // A press that starts inside belongs to the panel, even if the pointer is
      // released elsewhere.
      if (isInside(e.target)) return;
      onDismiss();
    };

    const onKey = (e: KeyboardEvent) => {
      if (escape && e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };

    // Capture phase so a nested panel cannot stop the press from reaching this.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onDismiss, escape, ignore]);

  return ref;
}

/**
 * The same idea for a panel that anchors to a button: closing on the next press
 * anywhere, *including* the trigger, is what makes a menu feel like a menu.
 */
export function useToggleOnOutside<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
  trigger?: React.RefObject<HTMLElement | null>
) {
  return useDismissOnOutside<T>(open, onDismiss, { ignore: trigger ? [trigger] : [] });
}
