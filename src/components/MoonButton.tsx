import { useEffect, useRef, type ButtonHTMLAttributes } from 'react';
import { useReducedMotion } from 'motion/react';
import type { FlameWrapInstance } from './canvasui/FlameWrap';
import { rippleOrigin, useScreenRipple } from './ButtonRipples';
import { effectBudget } from '../viewport-utils.mjs';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  onClick?: () => unknown;
  beforeTransition?: () => boolean;
  immediate?: boolean;
};

export default function MoonButton({ children, className = '', type = 'button', onClick, beforeTransition, immediate = false, ...props }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const source = useRef<HTMLCanvasElement>(null);
  const output = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const ripple = useScreenRipple();

  useEffect(() => {
    const target = button.current;
    if (reduced || !target || !source.current || !output.current) return;
    let flame: FlameWrapInstance | null = null;
    let active = true;
    let visible = false;
    let loading = false;
    const allowed = () => active && visible && !document.hidden;
    const stop = () => { flame?.setPaused(true); };
    const start = async () => {
      if (!allowed() || !source.current || !output.current) return;
      if (flame) { flame.setPaused(false); return; }
      if (loading) return;
      loading = true;
      try {
        const { createFlameWrap } = await import('./canvasui/FlameWrap');
        if (!allowed() || !source.current || !output.current) return;
        const budget = effectBudget(window.innerWidth);
        flame = createFlameWrap({ source: source.current, content: target, output: output.current }, {
          captureContent: false, pixelRatioCap: budget.flameRatio, maxFps: budget.flameFps,
          color: [0.65, 0.8, 1], intensity: 0.85, height: 30, spread: 12,
          radius: 12, speed: 0.2, scale: 0.35, turbulence: 0.24,
          turbulenceScale: 0.5, turbulenceReach: 18, sparks: 0, smoke: 0,
          rim: 0.9, melt: 0, distortion: 1.6, ember: 0.22, scorch: 0,
        });
      } catch { /* Translucent moonlight styling remains without WebGL. */ }
      finally { loading = false; }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (allowed()) void start();
      else stop();
    }, { threshold: 0 });
    observer.observe(target);
    const visibility = () => {
      if (document.hidden) stop();
      else {
        const rect = target.getBoundingClientRect();
        visible = rect.bottom > 0 && rect.top < window.innerHeight;
        if (allowed()) void start();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      observer.disconnect(); flame?.destroy(); flame = null;
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [reduced]);

  return <button {...props} type={type} ref={button} className={className} data-ripple-managed aria-busy={ripple.busy || undefined} onClick={(event) => {
    if (!onClick || props.disabled || ripple.busy || beforeTransition && !beforeTransition()) return;
    const origin = rippleOrigin(event);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) focused.blur();
    // Share/download APIs must stay inside the original trusted gesture.
    if (immediate) { void ripple.feedback(origin); void onClick(); }
    else void ripple.transition(onClick, origin);
  }}>
    <span className="button-flame" aria-hidden="true"><canvas className="flame-source" ref={source}/><canvas className="flame-output" ref={output}/></span>{children}
  </button>;
}
