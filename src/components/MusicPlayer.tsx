import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Pause, SpeakerHigh, SpeakerSlash, VinylRecord } from '@phosphor-icons/react';

type Status = 'loading' | 'blocked' | 'playing' | 'paused' | 'error';
export type MusicPlayerHandle = { startFromGesture: () => void };

export default function MusicPlayer({ ref }: { ref?: Ref<MusicPlayerHandle> }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const graphRef = useRef<{ context: AudioContext; gain: GainNode; source: MediaElementAudioSourceNode } | null>(null);
  const wanted = useRef(false);
  const alive = useRef(true);
  const [status, setStatus] = useState<Status>('paused');

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !wanted.current || document.hidden) return;
    try {
      if (!graphRef.current) {
        const context = new AudioContext();
        const gain = context.createGain();
        gain.gain.value = 0.3;
        const source = context.createMediaElementSource(audio);
        source.connect(gain); gain.connect(context.destination);
        graphRef.current = { context, gain, source };
        // iOS ignores media volume. The Web Audio gain sets a real 30% level.
        audio.volume = 1;
      }
      const resume = graphRef.current?.context.resume();
      const playback = audio.play();
      if (graphRef.current?.context.state !== 'running' && alive.current) setStatus('blocked');
      void Promise.all([resume, playback]).then(() => {
        if (alive.current && wanted.current && graphRef.current?.context.state === 'running') setStatus('playing');
        else audio.pause();
      }).catch((reason: unknown) => {
        if (!alive.current || !wanted.current) return;
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setStatus(reason instanceof DOMException && reason.name === 'NotAllowedError' ? 'blocked' : 'error');
      });
    } catch { if (alive.current) setStatus('error'); }
  }, []);

  useImperativeHandle(ref, () => ({
    startFromGesture() { wanted.current = true; play(); },
  }), [play]);

  useEffect(() => {
    alive.current = true;
    const audio = audioRef.current!;
    if (!graphRef.current) audio.volume = 0.3;
    const unlock = (event: Event) => {
      if ((event.target as Element | null)?.closest?.('[data-music-toggle]')) return;
      if (wanted.current && (!graphRef.current || graphRef.current.context.state !== 'running' || audio.paused)) play();
    };
    const visibility = () => {
      if (document.hidden) audio.pause();
      else if (wanted.current) play();
    };
    document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    document.addEventListener('touchend', unlock, { capture: true, passive: true });
    document.addEventListener('click', unlock, { capture: true, passive: true });
    document.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive.current = false; audio.pause();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', visibility);
      // Keep the media graph connected across StrictMode's effect replay.
      void graphRef.current?.context.suspend();
    };
  }, [play]);

  const playing = status === 'playing';
  const label = status === 'blocked' ? 'Коснись для музыки' : status === 'error' ? 'Включить музыку' : playing ? 'Музыка играет' : status === 'paused' ? 'Музыка на паузе' : 'Включаем музыку';
  return <div className={`music-player ${playing ? 'is-playing' : ''}`}>
    <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/down-by-the-river.mp3`} loop preload="auto" onError={() => setStatus('error')} onPlaying={() => { if (wanted.current) setStatus(graphRef.current?.context.state === 'running' ? 'playing' : 'blocked'); }} />
    <button className="music-toggle" data-music-toggle aria-label={playing ? 'Поставить музыку на паузу' : label} aria-pressed={playing} onClick={() => {
      if (wanted.current && playing) { wanted.current = false; audioRef.current?.pause(); setStatus('paused'); }
      else { wanted.current = true; play(); }
    }}>
      <span className="record"><VinylRecord size={29} weight="thin" /><span className="record-control">{playing ? <Pause size={9} weight="fill" /> : <SpeakerHigh size={10} />}</span></span>
      <span className="music-label"><span>Down by the River</span><small>{label}</small></span>
      <span className="music-wave" aria-hidden="true">{playing ? <><i/><i/><i/><i/></> : <SpeakerSlash size={13} />}</span>
    </button>
  </div>;
}
