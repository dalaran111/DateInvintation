import { useEffect, useRef, useState, type RefObject } from 'react';
import { resolveViewport } from './viewport-utils.mjs';

type Options = {
  scrollRef: RefObject<HTMLDivElement | null>;
  activeRef: RefObject<number>;
  navigationTarget: RefObject<number | null>;
};

function editable(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && (element.matches('input:not([disabled]), textarea') || element.isContentEditable);
}

export function useViewportLayout({ scrollRef, activeRef, navigationTarget }: Options) {
  const guard = useRef(false);
  const lockedScene = useRef<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const scroller = scrollRef.current;
    const app = scroller?.closest<HTMLElement>('.invitation-app');
    const header = app?.querySelector<HTMLElement>('.app-header');
    const footer = app?.querySelector<HTMLElement>('.chapter-nav');
    if (!app || !scroller) return;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let keyboard = false;
    let frame = 0;
    let resizing = false;
    let disposed = false;

    const css = (name: string, value: string) => { if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value); };
    const measureChrome = () => {
      const bounds = app.getBoundingClientRect();
      if (header) css('--header-height', `${Math.ceil(header.getBoundingClientRect().bottom - bounds.top)}px`);
      if (footer) css('--footer-height', `${Math.ceil(bounds.bottom - footer.getBoundingClientRect().top)}px`);
    };
    const update = () => {
      frame = 0;
      if (disposed) return;
      const focused = editable(document.activeElement);
      const next = resolveViewport({ width: window.innerWidth, layoutHeight: window.innerHeight, visualHeight: viewport?.height ?? window.innerHeight, visualTop: viewport?.offsetTop ?? 0, scale: viewport?.scale ?? 1, focused, previousWidth: width, previousHeight: height, wasKeyboardOpen: keyboard });
      if (next.rotated) { lockedScene.current = null; if (focused) (document.activeElement as HTMLElement).blur(); }
      keyboard = next.keyboardOpen;
      if (!focused && !keyboard) lockedScene.current = null;
      guard.current = lockedScene.current !== null;
      root.toggleAttribute('data-keyboard-open', keyboard);
      app.toggleAttribute('data-editing', guard.current);
      css('--keyboard-inset', `${next.keyboardInset}px`);
      setKeyboardOpen(keyboard);

      // Defer real viewport changes until an in-flight page animation finishes.
      if (navigationTarget.current === null && next.height !== height) {
        resizing = true; guard.current = true;
        const scene = lockedScene.current ?? activeRef.current;
        const snap = scroller.style.scrollSnapType;
        const behavior = scroller.style.scrollBehavior;
        scroller.style.scrollSnapType = 'none'; scroller.style.scrollBehavior = 'auto';
        height = next.height; css('--viewport-height', `${height}px`);
        scroller.scrollTop = scene * scroller.clientHeight;
        scroller.style.scrollSnapType = snap; scroller.style.scrollBehavior = behavior;
        resizing = false; guard.current = lockedScene.current !== null;
      }
      width = window.innerWidth;
      app.dataset.compact = String(height < 760);
      measureChrome();

      // Scroll only the editor's panel. scrollIntoView would move the scene deck.
      if (focused && keyboard) {
        const field = document.activeElement as HTMLElement;
        const panel = field.closest<HTMLElement>('.scene-content');
        if (panel) {
          const fieldRect = field.getBoundingClientRect();
          const panelRect = panel.getBoundingClientRect();
          const top = Math.max(panelRect.top, viewport?.offsetTop ?? 0) + 12;
          const bottom = Math.min(panelRect.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)) - 12;
          if (fieldRect.bottom > bottom) panel.scrollTop += fieldRect.bottom - bottom;
          else if (fieldRect.top < top) panel.scrollTop -= top - fieldRect.top;
        }
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    refreshRef.current = schedule;
    const focusIn = (event: FocusEvent) => {
      if (!editable(event.target as Element | null)) return;
      lockedScene.current = activeRef.current;
      guard.current = true; app.setAttribute('data-editing', '');
      schedule();
    };
    const keepScene = () => {
      if (!resizing && lockedScene.current !== null && navigationTarget.current === null) {
        const top = lockedScene.current * scroller.clientHeight;
        if (Math.abs(scroller.scrollTop - top) > 1) scroller.scrollTop = top;
      }
    };
    css('--viewport-height', `${height}px`);
    const observer = new ResizeObserver(schedule);
    if (header) observer.observe(header);
    if (footer) observer.observe(footer);
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', schedule);
    scroller.addEventListener('scroll', keepScene, { passive: true });
    scroller.addEventListener('scrollend', schedule);
    update();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      refreshRef.current = () => {};
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule); viewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', focusIn); document.removeEventListener('focusout', schedule);
      scroller.removeEventListener('scroll', keepScene); scroller.removeEventListener('scrollend', schedule);
      root.removeAttribute('data-keyboard-open'); app.removeAttribute('data-editing');
    };
  }, [scrollRef, activeRef, navigationTarget]);

  return { keyboardOpen, guard, refresh() { refreshRef.current(); }, releaseInputLock() { lockedScene.current = null; guard.current = false; } };
}
