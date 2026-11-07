import { useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export default function EntryScreen({ onEnter }: { onEnter: () => void }) {
  const activated = useRef(false);
  const reduced = useReducedMotion();
  return <motion.button className="entry-screen" type="button" data-entry-screen autoFocus
    aria-label="Очаровательная Поля, прошу вас нажать пальчиком на экран. Спасибо :)"
    initial={{ opacity: 1 }}
    exit={{ opacity: 0, scale: reduced ? 1 : 1.025, filter: reduced ? 'none' : 'blur(9px)', transition: { duration: reduced ? 0.5 : 1.8, ease: [0.22, 1, 0.36, 1] } }}
    onClick={() => { if (activated.current) return; activated.current = true; onEnter(); }}>
    <motion.span className="entry-moon" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }}/>
    <motion.span className="entry-message" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, ease: 'easeOut' }}>
      <span>Очаровательная Поля,</span>{' '}<span>прошу вас нажать пальчиком на экран.</span>{' '}<span>Спасибо :)</span>
    </motion.span>
  </motion.button>;
}
