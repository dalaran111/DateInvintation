import { useEffect, useRef, useState, type RefObject } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import type { CloudsInstance } from './canvasui/Clouds';
import { effectBudget } from '../viewport-utils.mjs';

export default function Atmosphere({ scrollRef, paused = false }: { scrollRef: RefObject<HTMLDivElement | null>; paused?: boolean }) {
  const source = useRef<HTMLCanvasElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const output = useRef<HTMLCanvasElement>(null);
  const engine = useRef<CloudsInstance | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [ready, setReady] = useState(false);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const y = useTransform(scrollYProgress, [0, 1], ['-3%', '5%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1.12, 1.23]);
  useEffect(() => { engine.current?.setPaused(paused); }, [paused]);

  useEffect(() => {
    if (!source.current || !content.current || !output.current) return;
    let disposed = false;
    // The standalone WebGL engine draws clouds without experimental DOM capture.
    // Canvas UI source: https://canvasui.dev/docs/components/clouds
    void (async () => {
      try {
        const { createClouds } = await import('./canvasui/Clouds');
        if (disposed || !source.current || !content.current || !output.current) return;
        const budget = effectBudget(window.innerWidth);
        engine.current = createClouds({ source: source.current, content: content.current, output: output.current }, {
        captureContent: false, maxFps: budget.cloudFps, pixelRatioCap: budget.cloudRatio,
        color: [0.22, 0.3, 0.32], speed: 0.45, scale: 1.15, cover: 0.28,
        density: 2.1, opacity: 0.78, shading: 0.7, shadow: 0.08,
        wind: 0.65, windRadius: 180, quality: budget.cloudQuality,
        });
        engine.current?.setPaused(pausedRef.current);
        setReady(Boolean(engine.current));
      } catch { if (!disposed) setReady(false); }
    })();
    const relayPointer = (event: PointerEvent) => {
      if (pausedRef.current || !content.current || event.target === content.current) return;
      content.current.dispatchEvent(new PointerEvent('pointermove', { clientX: event.clientX, clientY: event.clientY }));
    };
    const leave = () => content.current?.dispatchEvent(new PointerEvent('pointerleave'));
    window.addEventListener('pointermove', relayPointer, { passive: true });
    window.addEventListener('pointerdown', relayPointer, { passive: true });
    window.addEventListener('pointerup', leave, { passive: true });
    return () => {
      disposed = true;
      window.removeEventListener('pointermove', relayPointer);
      window.removeEventListener('pointerdown', relayPointer);
      window.removeEventListener('pointerup', leave);
      engine.current?.destroy(); engine.current = null;
    };
  }, []);

  return <div className={`atmosphere ${ready ? 'webgl-ready' : ''}`} aria-hidden="true">
    <motion.img className="atmosphere-photo" src={`${import.meta.env.BASE_URL}images/petersburg.jpg`} alt="" style={{ y, scale }} />
    <div className="atmosphere-shade" />
    <div className="cloud-surface" ref={content}>
      <canvas ref={source} className="cloud-source" />
      <canvas ref={output} className="cloud-output" />
    </div>
    <div className="atmosphere-vignette" />
  </div>;
}
