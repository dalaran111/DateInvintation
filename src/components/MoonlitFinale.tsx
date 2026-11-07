import { motion, useReducedMotion } from 'motion/react';

const motes = Array.from({ length: 14 }, (_, index) => {
  const angle = index / 14 * Math.PI * 2;
  const distance = 80 + index % 4 * 25;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 1.15 };
});

export default function MoonlitFinale({ onComplete }: { onComplete: () => void }) {
  const reduced = useReducedMotion();
  return <motion.div className="moonlit-finale" aria-hidden="true"
    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }}
    transition={{ duration: reduced ? 1 : 3.8, times: [0, 0.17, 0.57, 1], ease: 'easeInOut' }} onAnimationComplete={onComplete}>
    <motion.div className="finale-moonlight" initial={{ scale: reduced ? 1 : 0.65 }} animate={{ scale: reduced ? 1 : 1.65 }} transition={{ duration: 3.8, ease: 'easeOut' }}/>
    <div className="finale-center">
      {!reduced && <>{[0, 1, 2].map((index) => <motion.span key={index} className="finale-orbit" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.3 + index * 0.35], opacity: [0, 0.35, 0] }} transition={{ duration: 3.2, delay: index * 0.17, ease: 'easeOut' }}/>)}</>}
      <motion.svg className="finale-heart" width="94" height="88" viewBox="0 0 100 90" fill="none" initial={{ y: reduced ? 0 : 7 }} animate={{ y: 0 }} transition={{ duration: 2.2, ease: 'easeOut' }}>
        <motion.path d="M50 75C43 69 14 51 14 31 14 10 42 5 50 26 58 5 86 10 86 31 86 51 57 69 50 75Z" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" initial={{ pathLength: reduced ? 1 : 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reduced ? 0.3 : 2, delay: reduced ? 0 : 0.2, ease: 'easeInOut' }}/>
      </motion.svg>
      {!reduced && motes.map((point, index) => <motion.i key={index} className="finale-mote" initial={{ x: point.x * 0.25, y: point.y * 0.25, opacity: 0 }} animate={{ x: point.x, y: point.y, opacity: [0, 0.6, 0] }} transition={{ duration: 3.2, delay: index % 4 * 0.1, ease: 'easeOut' }}/>) }
      <motion.span className="finale-caption" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : 0.9, duration: 1.1 }}>До встречи.</motion.span>
    </div>
  </motion.div>;
}
