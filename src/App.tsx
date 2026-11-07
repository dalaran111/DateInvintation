import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from 'react';
import { animate, AnimatePresence, MotionConfig, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowSquareOut, CalendarBlank, Check, CheckCircle, Clock, EnvelopeSimpleOpen, FilmSlate, ForkKnife, Heart, MapPin, NavigationArrow, PencilSimpleLine, ShareNetwork, Ticket, X } from '@phosphor-icons/react';
import Atmosphere from './components/Atmosphere';
import MusicPlayer, { type MusicPlayerHandle } from './components/MusicPlayer';
import ButtonRipples, { rippleOrigin, useScreenRipple } from './components/ButtonRipples';
import MoonlitFinale from './components/MoonlitFinale';
import MoonButton from './components/MoonButton';
import EntryScreen from './components/EntryScreen';
import { useViewportLayout } from './useViewportLayout';
import { effectBudget } from './viewport-utils.mjs';
import type { DatePlan } from './model';
import { buildCalendar, buildReply, isFutureDate } from './date-utils.mjs';
import { sendEmailReply } from './email-reply.mjs';
import { ACTIVITY_OPTIONS, INVITATION_DATE, TIME_OPTIONS, activityTitle, normalizePoint, pointDescription, pointUrl } from './plan-utils.mjs';

const STORAGE_KEY = 'date-invitation-v2';
const MeetingMap = lazy(() => import('./components/MeetingMap'));
const chapters = ['Приглашение', 'Наш вечер', 'Время для нас', 'Место встречи', 'Это свидание'];
const activities = [
  { id: 'cinema' as const, icon: FilmSlate, title: 'Пойдём в кино', description: 'Последний ряд или самый первый — выбирай.', number: '01' },
  { id: 'dinner' as const, icon: ForkKnife, title: 'Покушаем вкусно', description: 'Что-нибудь вкусное и разговоры обо всём.', number: '02' },
  { id: 'custom' as const, icon: PencilSimpleLine, title: 'У меня своя идея', description: 'Этот вечер может быть каким угодно.', number: '03' },
];

function loadPlan(): DatePlan {
  const initial: DatePlan = { activity: 'cinema', customActivity: '', time: '', point: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return initial;
    return {
      activity: ACTIVITY_OPTIONS.includes(saved.activity) ? saved.activity : initial.activity,
      customActivity: typeof saved.customActivity === 'string' ? saved.customActivity.slice(0, 140) : '',
      time: TIME_OPTIONS.includes(saved.time) ? saved.time : '', point: normalizePoint(saved.point),
    };
  } catch { return initial; }
}

function Scene({ index, active, scrollRef, children, action, className = '' }: { index: number; active: boolean; scrollRef: RefObject<HTMLDivElement | null>; children: ReactNode; action?: ReactNode; className?: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const mobile = effectBudget(window.innerWidth).mobile;
  const { scrollYProgress } = useScroll({ container: scrollRef, target: sectionRef, offset: ['start end', 'end start'] });
  const shift = reduced ? 0 : mobile ? 42 : 110;
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [shift, 0, -shift]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.5, 0.7, 1], [0, 0.45, 1, 0.45, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [reduced ? 1 : 0.94, 1, reduced ? 1 : 0.94]);
  return <section ref={sectionRef} className={`scene scene-${index} ${className}`} id={`scene-${index}`} aria-label={chapters[index]} inert={!active}>
    <motion.div className={`scene-content ${action ? 'has-action' : ''}`} style={{ y, opacity, scale }}>{action ? <><div className="scene-body">{children}</div><div className="scene-actions">{action}</div></> : children}</motion.div>
  </section>;
}

function SceneHeading({ number, eyebrow, children, description }: { number: string; eyebrow: string; children: ReactNode; description?: string }) {
  return <div className="scene-heading"><span className="eyebrow"><span>{number}</span>{eyebrow}</span><h1>{children}</h1>{description && <p>{description}</p>}</div>;
}

function Intro({ onNext }: { onNext: () => void }) {
  const [opened, setOpened] = useState(false);
  const reduced = useReducedMotion();
  const ripple = useScreenRipple();
  return <AnimatePresence mode="wait" initial={false}>
    {!opened ? <motion.div key="intro" className="intro-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30, filter: reduced ? 'none' : 'blur(8px)' }} transition={{ duration: 0.5 }}>
      <span className="eyebrow">ОДИН ВЕЧЕР. ДВА ЧЕЛОВЕКА.</span>
      <h1 className="intro-title">Давай<br /><em>увидимся.</em></h1>
      <div className="memory-frame"><motion.img src={`${import.meta.env.BASE_URL}images/petersburg.jpg`} alt="Вечерний канал в Петербурге" fetchPriority="high" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 2 }} /><div className="memory-shade"/><span className="memory-city"><MapPin size={12} weight="light"/>Санкт-Петербург</span><span className="memory-date">08<span>НОЯБРЯ</span></span><span className="memory-caption">я знаю, с кем хочу быть здесь</span></div>
      <p className="intro-copy">У меня на тебя планы.<br />И, кажется, тебе они понравятся.</p>
      <MoonButton className="button button-light" onClick={() => setOpened(true)}><EnvelopeSimpleOpen size={19} weight="light"/>Это письмо тебе<ArrowRight size={18}/></MoonButton>
    </motion.div> : <motion.div key="letter" className="letter-content" initial={{ opacity: 0, rotateX: -12, y: 40 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 80, damping: 20 }}>
      <span className="eyebrow">ЛИЧНОЕ. ДЛЯ ТЕБЯ.</span><EnvelopeSimpleOpen className="letter-symbol" size={38} weight="light"/>
      <h1>Привет,<br /><em>это приглашение.</em></h1>
      <p>Давай оставим дела на потом<br />и проведём этот вечер вместе.</p><p>Посмотрим кино, найдём что-нибудь вкусное.<br />А может, у тебя есть идея получше?</p><p className="letter-signature">Всё, что нужно, — ты.</p>
      <MoonButton className="button button-light" onClick={onNext}>Давай придумаем наш вечер<ArrowDown size={17}/></MoonButton><button className="quiet-button" data-ripple-managed onClick={(event) => { void ripple.transition(() => setOpened(false), rippleOrigin(event)); }}>Вернуться к открытке</button>
    </motion.div>}
  </AnimatePresence>;
}

export default function App() {
  return <MotionConfig reducedMotion="user"><ButtonRipples><InvitationApp/></ButtonRipples></MotionConfig>;
}

function InvitationApp() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<MusicPlayerHandle>(null);
  const navigation = useRef<ReturnType<typeof animate> | null>(null);
  const navigationId = useRef(0);
  const navigationTarget = useRef<number | null>(null);
  const activeRef = useRef(0);
  const layout = useViewportLayout({ scrollRef, activeRef, navigationTarget });
  const [entry, setEntry] = useState<'closed' | 'opening' | 'open'>('closed');
  const ripple = useScreenRipple();
  const [active, setActive] = useState(0);
  const [mapMounted, setMapMounted] = useState(false);
  const [plan, setPlan] = useState<DatePlan>(loadPlan);
  const [accepted, setAccepted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [delivery, setDelivery] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const sendingRef = useRef(false);
  const deliveredRef = useRef('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [calendarSaved, setCalendarSaved] = useState(false);
  const [postpone, setPostpone] = useState(false);
  const reduced = useReducedMotion();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { scrollY, scrollYProgress } = useScroll({ container: scrollRef });
  const progress = useTransform(scrollYProgress, [0, 1], [0.2, 1]);

  useMotionValueEvent(scrollY, 'change', (position) => {
    if (layout.guard.current && navigationTarget.current === null) return;
    const height = scrollRef.current?.clientHeight || 1;
    const index = Math.min(4, Math.max(0, Math.round(position / height)));
    if (activeRef.current !== index) { activeRef.current = index; setActive(index); }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch { /* Storage is optional. */ }
  }, [plan]);
  useEffect(() => { if (active !== 4) setCelebrating(false); }, [active]);
  useEffect(() => {
    // Load code ahead of the map scene, without creating tiles during the slide.
    if (active === 2) void import('./components/MeetingMap').catch(() => {});
  }, [active]);
  useEffect(() => {
    if (mapMounted || active !== 3 || ripple.busy) return;
    const scroller = scrollRef.current;
    let timer: ReturnType<typeof setTimeout>;
    const settled = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setMapMounted(true), 180);
    };
    settled();
    scroller?.addEventListener('scroll', settled, { passive: true });
    return () => { clearTimeout(timer); scroller?.removeEventListener('scroll', settled); };
  }, [active, ripple.busy, mapMounted]);
  useEffect(() => {
    return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); navigation.current?.stop(); };
  }, []);

  const goTo = useCallback(async (index: number) => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    layout.releaseInputLock();
    const destination = Math.max(0, Math.min(4, index));
    navigationTarget.current = destination;
    (document.activeElement as HTMLElement | null)?.blur();
    setError('');
    const id = ++navigationId.current;
    navigation.current?.stop();
    viewport.style.scrollSnapType = 'none';
    viewport.style.scrollBehavior = 'auto';
    const target = destination * viewport.clientHeight;
    try {
      if (reduced) viewport.scrollTo({ top: target, behavior: 'instant' });
      else {
        const animation = animate(viewport.scrollTop, target, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (value) => { viewport.scrollTop = value; } });
        navigation.current = animation;
        await animation;
      }
    } finally {
      if (navigationId.current === id) {
        viewport.style.scrollSnapType = ''; viewport.style.scrollBehavior = ''; navigation.current = null;
        navigationTarget.current = null; activeRef.current = destination; setActive(destination); layout.refresh();
      }
    }
  }, [reduced]);
  const rippleGoTo = (index: number, event: ReactMouseEvent<HTMLElement>) => ripple.transition(() => goTo(index), rippleOrigin(event));
  const updatePlan = useCallback((patch: Partial<DatePlan>) => { setPlan((current) => ({ ...current, ...patch })); setAccepted(false); setCelebrating(false); setCalendarSaved(false); setError(''); }, []);
  const notify = (value: string) => { setMessage(value); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setMessage(''), 4500); };
  const validateActivity = () => { if (plan.activity === 'custom' && !plan.customActivity.trim()) { setError('Расскажи, что тебе хочется — хотя бы пару слов.'); document.getElementById('custom-activity')?.focus(); return false; } return true; };
  const validateTime = () => { if (!TIME_OPTIONS.includes(plan.time)) { setError('Выбери время, в которое тебе удобно.'); return false; } if (!isFutureDate(INVITATION_DATE, plan.time)) { setError('Это время уже прошло. Приглашение было на 8 ноября 2026 года.'); return false; } return true; };
  const validatePoint = () => { if (!plan.point) { setError('Коснись карты и выбери, где мы встретимся.'); return false; } return true; };
  const validateAll = () => {
    if (!validateActivity()) { goTo(1); notify('Напиши свою идею для вечера.'); return false; }
    if (!validateTime()) { goTo(2); notify('Выбери удобное время 8 ноября.'); return false; }
    if (!validatePoint()) { goTo(3); notify('Поставь точку встречи на карте.'); return false; }
    return true;
  };
  const details = { date: INVITATION_DATE, time: plan.time, activity: activityTitle(plan), location: plan.point ? pointDescription(plan.point) : '', coordinates: plan.point || undefined };
  async function deliverReply() {
    const key = JSON.stringify(details);
    if (sendingRef.current || deliveredRef.current === key) return;
    sendingRef.current = true; setDelivery('sending');
    try {
      await sendEmailReply(details);
      deliveredRef.current = key; setDelivery('sent');
    } catch { setDelivery('error'); }
    finally { sendingRef.current = false; }
  }
  function finishCelebration() {
    setCelebrating(false);
    void deliverReply();
  }

  async function share() {
    if (!validateAll() || sharing) return;
    setSharing(true);
    try {
      const text = buildReply(details);
      if (navigator.share) await navigator.share({ title: '8 ноября. У нас свидание.', text });
      else { await navigator.clipboard.writeText(text); notify('Приглашение скопировано. Отправь его мне в чат.'); }
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) notify('Выдели и скопируй текст билета ниже.'); }
    finally { setSharing(false); }
  }

  function calendar() {
    if (!validateAll()) return;
    try {
      const blob = new Blob([buildCalendar(details)], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'наше-свидание-8-ноября.ics'; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000); setCalendarSaved(true);
    } catch { notify('Не получилось сохранить событие. Попробуй ещё раз.'); }
  }

  return <div className="invitation-app">
    <Atmosphere scrollRef={scrollRef} paused={entry === 'closed'}/>
    <motion.div className={`experience ${ripple.busy ? 'is-transitioning' : ''}`} inert={entry !== 'open' || ripple.busy || celebrating} initial={{ opacity: 0 }} animate={{ opacity: entry === 'closed' ? 0 : 1 }} transition={{ duration: reduced ? 0.5 : 1.8, delay: entry === 'opening' && !reduced ? 0.25 : 0, ease: 'easeInOut' }}>
    <header className="app-header"><a href="#scene-0" className="city-mark" onClick={(event) => { event.preventDefault(); void rippleGoTo(0, event); }}><span className="city-indicator"/><span>САНКТ-ПЕТЕРБУРГ<small>08 НОЯБРЯ · ДЛЯ НАС</small></span></a><MusicPlayer ref={musicRef}/></header>
    <div className="scene-scroll" ref={scrollRef} tabIndex={0} aria-label="Приглашение: листай вниз между пятью сценами" onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); void ripple.transition(() => goTo(active + 1)); }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); void ripple.transition(() => goTo(active - 1)); }
    }}>
      <Scene index={0} active={active === 0} scrollRef={scrollRef} className="intro-scene"><Intro onNext={() => goTo(1)}/></Scene>

      <Scene index={1} active={active === 1} scrollRef={scrollRef} action={<MoonButton className="button button-light scene-continue" beforeTransition={validateActivity} onClick={() => goTo(2)}>Теперь выберем время<ArrowDown size={17}/></MoonButton>}>
        <SceneHeading number="01" eyebrow="КАК ПРОВЕДЁМ ЭТОТ ВЕЧЕР?">Выбирай.<br /><em>Я за любой план.</em></SceneHeading>
        <div className="activity-options" role="group" aria-label="Выбери занятие">{activities.map((item, index) => <motion.div key={item.id} className={`activity-drift activity-drift-${item.id}`} initial={false}
          animate={reduced || active !== 1 ? { y: 0, rotate: [-1.2, 1.15, -0.65][index] } : { y: [0, -4 - index, 0], rotate: [[-1.2, -0.65, -1.2], [1.15, 0.5, 1.15], [-0.65, -1.15, -0.65]][index] }}
          transition={reduced || active !== 1 ? { duration: 0.4 } : { duration: 6.5 + index * 1.1, repeat: Infinity, ease: 'easeInOut', delay: index * 0.45 }}>
          <motion.button className={`activity-option ${plan.activity === item.id ? 'selected' : ''}`} onClick={() => updatePlan({ activity: item.id })} aria-pressed={plan.activity === item.id} whileTap={{ scale: 0.975 }} whileHover={reduced ? undefined : { scale: 1.01 }}>
          <span className={`activity-icon activity-icon-${item.id}`}><item.icon size={27} weight="light"/></span><span className="activity-copy"><strong>{item.title}</strong><small>{item.description}</small></span><span className="choice-mark">{plan.activity === item.id ? <Check size={14} weight="bold"/> : <span>{item.number}</span>}</span>
        </motion.button></motion.div>)}</div>
        <AnimatePresence>{plan.activity === 'custom' && <motion.div className="custom-activity" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onAnimationComplete={() => {
          if (plan.activity !== 'custom') return;
          const panel = document.getElementById('custom-activity')?.closest<HTMLElement>('.scene-content');
          if (panel) panel.scrollTo({ top: panel.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
        }}><label htmlFor="custom-activity">Твоя идея</label><input id="custom-activity" maxLength={140} placeholder="Например, боулинг и горячий шоколад" value={plan.customActivity} onChange={(event) => updatePlan({ customActivity: event.target.value })}/></motion.div>}</AnimatePresence>
        {active === 1 && error && <p className="form-error" role="alert">{error}</p>}
      </Scene>

      <Scene index={2} active={active === 2} scrollRef={scrollRef} action={<MoonButton className="button button-light scene-continue" beforeTransition={validateTime} onClick={() => goTo(3)}>Найдём место встречи<ArrowDown size={17}/></MoonButton>}>
        <SceneHeading number="02" eyebrow="ВРЕМЯ ДЛЯ НАС">Оставим вечер<br /><em>друг для друга.</em></SceneHeading>
        <div className="date-display"><span className="date-number">08</span><span className="date-month">ноября<span>Воскресенье, 2026</span></span><CalendarBlank size={27} weight="thin"/></div>
        <div className="time-heading"><Clock size={15} weight="light"/><span>Во сколько тебя ждать?</span><small>МСК</small></div>
        <div className="time-options" role="group" aria-label="Время встречи 8 ноября">{TIME_OPTIONS.map((time) => <motion.button key={time} aria-pressed={time === plan.time} className={time === plan.time ? 'selected' : ''} onClick={() => updatePlan({ time })} whileTap={{ scale: 0.94 }}>{time}{time === plan.time && <motion.span layoutId="chosen-time" className="chosen-time" transition={{ type: 'spring', stiffness: 320, damping: 28 }}/>}</motion.button>)}</div>
        <p className="time-note">В этот день никуда не торопимся.</p>
        {active === 2 && error && <p className="form-error" role="alert">{error}</p>}
      </Scene>

      <Scene index={3} active={active === 3} scrollRef={scrollRef} className="map-scene" action={<MoonButton className="button button-light scene-continue" beforeTransition={validatePoint} onClick={() => goTo(4)}>Вот здесь и встретимся<ArrowDown size={17}/></MoonButton>}>
        <SceneHeading number="03" eyebrow="ГДЕ НАЧНЁТСЯ НАШ ВЕЧЕР?">Поставь точку.<br /><em>Я буду там.</em></SceneHeading>
        <p className="map-description">Выбирай любое место на карте Петербурга.</p>
        {mapMounted ? <Suspense fallback={<div className="meeting-map-shell map-placeholder" role="status">Открываем Петербург…</div>}><MeetingMap active point={plan.point} onChange={(point) => updatePlan({ point })}/></Suspense> : <div className="meeting-map-shell map-placeholder"/>}
        <div className={`point-summary ${plan.point ? 'has-point' : ''}`} aria-live="polite"><MapPin size={17} weight="light"/><span>{plan.point ? `${plan.point.lat.toFixed(5)}° N, ${plan.point.lng.toFixed(5)}° E` : 'Твоя точка встречи появится здесь'}</span>{plan.point && <CheckCircle size={17} weight="fill"/>}</div>
        <input className="place-name-input" aria-label="Название места встречи, по желанию" placeholder={plan.point ? 'Как называется место? Необязательно' : 'Сначала выбери точку на карте'} disabled={!plan.point} maxLength={100} value={plan.point?.label ?? ''} onChange={(event) => { if (plan.point) updatePlan({ point: { ...plan.point, label: event.target.value } }); }}/>
        {active === 3 && error && <p className="form-error" role="alert">{error}</p>}
      </Scene>

      <Scene index={4} active={active === 4} scrollRef={scrollRef} className="ticket-scene">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={accepted ? 'accepted' : 'invitation'} className="final-content"
            initial={{ opacity: 0, y: reduced ? 0 : accepted ? 8 : 18, scale: reduced ? 1 : 1.015, filter: reduced ? 'none' : 'blur(7px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: reduced ? 'none' : 'blur(0px)' }}
            exit={{ opacity: 0, y: reduced ? 0 : -4, filter: reduced ? 'none' : 'blur(7px)', transition: { duration: reduced ? 0.25 : 0.8, ease: 'easeInOut' } }}
            transition={{ duration: reduced ? 0.4 : accepted ? 1.6 : 0.65, delay: accepted && !reduced ? 1.25 : 0, ease: [0.22, 1, 0.36, 1] }}>
            <div className="final-heading"><span className="eyebrow">{accepted ? 'СОХРАНИМ ЭТОТ ВЕЧЕР' : 'ПЛАН ЕСТЬ. ОСТАЛОСЬ ТВОЁ «ДА».'}</span><h1>{accepted ? <>Значит,<br /><em>это свидание.</em></> : <>Ну что,<br /><em>увидимся?</em></>}</h1></div>
            <motion.div className={`date-ticket ${accepted ? 'ticket-accepted' : ''}`} layout><div className="ticket-topline"><span><Ticket size={15} weight="light"/>ОДИН ВЕЧЕР НА ДВОИХ</span><Heart size={18} weight={accepted ? 'fill' : 'light'}/></div><div className="ticket-date"><strong>8 ноября</strong><span>{plan.time || 'Выбери время'}<small>ВОСКРЕСЕНЬЕ · МСК</small></span></div><div className="ticket-rule"/>
              <button className="ticket-row" data-ripple-managed onClick={(event) => { void rippleGoTo(1, event); }}><span className="ticket-row-icon">{plan.activity === 'cinema' ? <FilmSlate size={20} weight="light"/> : plan.activity === 'dinner' ? <ForkKnife size={20} weight="light"/> : <PencilSimpleLine size={20} weight="light"/>}</span><span><small>НАШ ПЛАН</small><strong>{activityTitle(plan) || 'Твоя идея для вечера'}</strong></span><PencilSimpleLine className="ticket-edit" size={14}/></button>
              <button className="ticket-row" data-ripple-managed onClick={(event) => { void rippleGoTo(3, event); }}><span className="ticket-row-icon"><MapPin size={20} weight="light"/></span><span><small>НАШЕ МЕСТО</small><strong>{plan.point ? plan.point.label.trim() || 'Точка на карте Петербурга' : 'Выбери точку на карте'}</strong>{plan.point && <em>{plan.point.lat.toFixed(5)}, {plan.point.lng.toFixed(5)}</em>}</span><PencilSimpleLine className="ticket-edit" size={14}/></button>
              <div className="ticket-bottomline"><span>ТЫ + Я + ЭТОТ ГОРОД</span><span>08 · 11 · 26</span></div>
              <AnimatePresence>{accepted && <motion.span className="ticket-stamp" initial={{ scale: reduced ? 1 : 1.08, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -14 }} transition={{ duration: 1.1, delay: reduced ? 0 : 2.25, ease: 'easeOut' }}><Check size={14} weight="bold"/>ДО ВСТРЕЧИ</motion.span>}</AnimatePresence>
            </motion.div>
            {!accepted ? <><MoonButton className="button button-light final-yes" beforeTransition={validateAll} onClick={() => { setAccepted(true); setCelebrating(true); }}>Да. У нас свидание.<Heart size={17} weight="light"/></MoonButton><button className="quiet-button" data-ripple-managed onClick={(event) => { void ripple.transition(() => setPostpone(true), rippleOrigin(event)); }}>Мне нужно немного подумать</button></> : <><p className="ticket-hint" role="status" aria-live="polite">{delivery === 'sending' ? 'Отправляю твой ответ…' : delivery === 'sent' ? 'Ответ отправлен ♡ До встречи.' : delivery === 'error' ? 'Не получилось отправить ответ. Попробуй ещё раз.' : 'Сохрани билет на наш вечер.'}</p>{delivery === 'error' && <MoonButton className="button button-glass" onClick={deliverReply}>Попробовать ещё раз<ArrowRight size={17}/></MoonButton>}<div className="final-actions"><MoonButton className="button button-light" immediate onClick={share} disabled={sharing}><ShareNetwork size={18} weight="light"/>{sharing ? 'Секунду…' : 'Поделиться билетом'}</MoonButton><MoonButton className="button button-glass calendar-button" immediate onClick={calendar} aria-label="Добавить встречу в календарь">{calendarSaved ? <Check size={21}/> : <CalendarBlank size={21} weight="light"/>}</MoonButton></div>{plan.point && <a className="map-external-link" href={pointUrl(plan.point)} target="_blank" rel="noreferrer"><NavigationArrow size={13}/>Открыть наше место<ArrowSquareOut size={12}/></a>}<details className="reply-details"><summary>Скопировать текст билета</summary><textarea aria-label="Текст билета" readOnly value={buildReply(details)} onFocus={(event) => event.target.select()}/></details></>}
          </motion.div>
        </AnimatePresence>
      </Scene>
    </div>

    <nav className="chapter-nav" aria-label="Разделы приглашения"><div className="chapter-caption"><span>0{active + 1}<i>/ 05</i></span><AnimatePresence mode="wait" initial={false}><motion.span key={active} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>{chapters[active]}</motion.span></AnimatePresence><button data-ripple-managed onClick={(event) => { void rippleGoTo(active - 1, event); }} disabled={active === 0} aria-label="Предыдущая сцена"><ArrowLeft size={16}/></button></div><div className="chapter-track">{chapters.map((title, index) => <button key={title} className={active === index ? 'active' : ''} data-ripple-managed onClick={(event) => { void rippleGoTo(index, event); }} aria-label={`Сцена ${index + 1}: ${title}`} aria-current={active === index ? 'step' : undefined}><span/></button>)}</div></nav>
    <motion.div className="overall-progress" style={{ scaleX: progress }}/>

    <AnimatePresence>{message && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}><Check size={16}/><span>{message}</span><button aria-label="Закрыть уведомление" onClick={() => setMessage('')}><X size={15}/></button></motion.div>}</AnimatePresence>
    <AnimatePresence>{postpone && <motion.div className="pause-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(event) => { if (event.target === event.currentTarget) setPostpone(false); }}><PauseCard onClose={() => setPostpone(false)}/></motion.div>}</AnimatePresence>
    </motion.div>
    {celebrating && <MoonlitFinale onComplete={finishCelebration}/>}
    <AnimatePresence onExitComplete={() => setEntry('open')}>
      {entry === 'closed' && <EntryScreen key="entry" onEnter={() => { musicRef.current?.startFromGesture(); setEntry('opening'); }}/>}
    </AnimatePresence>
  </div>;
}

function PauseCard({ onClose }: { onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const content = card.current;
    content?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const buttons = content?.querySelectorAll<HTMLButtonElement>('button');
      const first = buttons?.[0], last = buttons?.[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === content)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === content)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <motion.div className="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title" ref={card} tabIndex={-1} initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}><button className="pause-close" aria-label="Закрыть" onClick={onClose}><X size={20}/></button><Heart size={38} weight="thin"/><h2 id="pause-title">Без спешки.</h2><p>Возвращайся, когда захочется.<br />Мне важно, чтобы тебе тоже хотелось.</p><MoonButton className="button button-light" onClick={onClose}>Хорошо</MoonButton></motion.div>;
}
