import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createTransitionSequence } from '../transition-sequence.mjs';
import { createRipple, type RippleInstance } from './canvasui/Ripple';
import { effectBudget } from '../viewport-utils.mjs';

type Point = { x: number; y: number };
type Splash = Point & { id: number; size: number };
type RippleControls = {
  busy: boolean;
  animating: boolean;
  feedback: (origin?: Point) => Promise<void>;
  transition: (action: () => unknown, origin?: Point) => Promise<boolean>;
};
const RippleContext = createContext<RippleControls | null>(null);

export function useScreenRipple() {
  const value = useContext(RippleContext);
  if (!value) throw new Error('Screen ripple needs its provider.');
  return value;
}

export function rippleOrigin(event: { clientX: number; clientY: number; detail: number; currentTarget: Element }): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.detail === 0 ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: event.clientX, y: event.clientY };
}

export default function ButtonRipples({ children }: { children: ReactNode }) {
  const surface = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLCanvasElement>(null);
  const output = useRef<HTMLCanvasElement>(null);
  const engine = useRef<RippleInstance | null>(null);
  const sequence = useRef<ReturnType<typeof createTransitionSequence> | null>(null);
  const fallbackDone = useRef<(() => void) | null>(null);
  const waveId = useRef(0);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fallback, setFallback] = useState<Splash | null>(null);

  const feedback = useCallback(async (origin?: Point) => {
    if (reduced || !surface.current) return;
    const id = ++waveId.current;
    const size = 360;
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    surface.current.style.left = `${x - size / 2}px`;
    surface.current.style.top = `${y - size / 2}px`;
    setVisible(true);
    if (engine.current) {
      engine.current.splash(size / 2, size / 2, 1);
      await engine.current.whenIdle();
    } else {
    fallbackDone.current?.();
    await new Promise<void>((resolve) => {
      fallbackDone.current = resolve;
      setFallback({ id, x: size / 2, y: size / 2, size });
    });
    }
    if (alive.current && id === waveId.current) setVisible(false);
  }, [reduced]);

  const transition = useCallback(async (action: () => unknown, origin?: Point) => {
    return await sequence.current?.run(() => feedback(origin), action) ?? false;
  }, [feedback]);

  useEffect(() => {
    alive.current = true;
    busyRef.current = false; setBusy(false); setVisible(false);
    sequence.current = createTransitionSequence((value) => { busyRef.current = value; setBusy(value); });
    if (!reduced && source.current && output.current && surface.current) {
      const budget = effectBudget(window.innerWidth);
      try {
        engine.current = createRipple({ source: source.current, output: output.current, content: surface.current }, {
          captureContent: false, trigger: 'none', pixelRatioCap: budget.rippleRatio, maxFps: budget.rippleFps,
          amplitude: 0.65, speed: 2.8, wavelength: 38, rings: 2, decay: 6.5,
          shine: 0.65, dispersion: 0, refraction: 0,
        });
      } catch { /* Motion fallback for devices without WebGL. */ }
    }
    const canvas = output.current;
    const lost = (event: Event) => { event.preventDefault(); engine.current?.destroy(); engine.current = null; };
    canvas?.addEventListener('webglcontextlost', lost);
    return () => {
      alive.current = false; sequence.current?.cancel();
      engine.current?.destroy(); engine.current = null;
      canvas?.removeEventListener('webglcontextlost', lost);
      fallbackDone.current?.(); fallbackDone.current = null;
    };
  }, [reduced]);

  useEffect(() => {
    const splash = (event: PointerEvent | MouseEvent) => {
      if (busyRef.current || reduced || event.type === 'click' && event.detail !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!button || button.disabled || button.hasAttribute('data-ripple-managed') || button.closest('[inert]') || button.closest('.meeting-map-shell') || button.hasAttribute('data-entry-screen')) return;
      const origin = rippleOrigin({ clientX: event.clientX, clientY: event.clientY, detail: event.type === 'click' ? event.detail : 1, currentTarget: button });
      void feedback(origin);
    };
    document.addEventListener('pointerdown', splash, { capture: true, passive: true });
    document.addEventListener('click', splash, { capture: true, passive: true });
    return () => { document.removeEventListener('pointerdown', splash, true); document.removeEventListener('click', splash, true); };
  }, [feedback, reduced]);

  const controls = useMemo(() => ({ busy, animating: busy || visible, feedback, transition }), [busy, visible, feedback, transition]);
  return <RippleContext.Provider value={controls}>{children}
    <div className="button-ripples" ref={surface} aria-hidden="true">
      <canvas ref={source} className="ripple-source"/><canvas ref={output} className="ripple-output"/>
      {fallback && <motion.span key={fallback.id} className="ripple-fallback"
        style={{ left: fallback.x, top: fallback.y, width: fallback.size, height: fallback.size }}
        initial={{ scale: 0.08, opacity: 0 }} animate={{ scale: 1, opacity: [0, 0.65, 0] }}
        transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1], opacity: { duration: 0.52, times: [0, 0.18, 1] } }}
        onAnimationComplete={() => { if (fallback.id === waveId.current) { fallbackDone.current?.(); fallbackDone.current = null; setFallback(null); } }}
      />}
    </div>
  </RippleContext.Provider>;
}
