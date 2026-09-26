'use client';
import { useEffect, useRef, useState } from 'react';
import { api, speak, setTtsEnabled } from '@/lib/client';
import { startRecording } from '@/lib/wavRecorder';

const ERRORS = {
  'not-allowed': 'Microphone permission was denied. Allow mic access from the browser address bar.',
  'no-speech': 'No speech heard. Tap the mic and try again.',
  'audio-capture': 'No microphone found.',
  network: 'Network error — voice recognition needs an internet connection.',
};
const BROWSER = { id: 'browser', label: 'Browser (free)' };

// Mic + transcript + typed fallback. onTranscript(text) returns the message to show and read aloud.
// Speech engines: server engines (Google Cloud / Wispr Flow — audio is recorded and transcribed on our server,
// primed with the field names) or the browser's built-in recognition.
export default function VoiceBar({ onTranscript, example }) {
  const [engines, setEngines] = useState(null); // [{ id, label, maxSeconds? }] once detected
  const [engine, setEngine] = useState(null);
  const current = engines?.find(e => e.id === engine);
  const [listening, setListening] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('Tap the mic and speak');
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [lang, setLang] = useState('en-IN');
  const [tts, setTts] = useState(true);
  const [typed, setTyped] = useState('');
  const recRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const textRef = useRef('');
  const handlerRef = useRef(onTranscript);
  handlerRef.current = onTranscript;

  useEffect(() => {
    const browser = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const recording = !!(navigator.mediaDevices?.getUserMedia && window.AudioWorkletNode);
    let saved = null;
    try {
      if (localStorage.getItem('vf_tts') === 'off') setTts(false);
      saved = localStorage.getItem('vf_engine');
    } catch {}
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
    api('/api/transcribe')
      .then(d => (recording ? d.engines : []))
      .catch(() => [])
      .then(server => {
        const list = [...server, ...(browser ? [BROWSER] : [])];
        setEngines(list);
        // remembered choice if still available, else the first (most accurate) one
        setEngine((list.find(e => e.id === saved) || list[0])?.id ?? null);
      });
    return () => {
      recRef.current?.abort();
      recorderRef.current?.cancel();
      clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setTtsEnabled(tts);
    try { localStorage.setItem('vf_tts', tts ? 'on' : 'off'); } catch {}
  }, [tts]);

  function chooseEngine(e) {
    setEngine(e.target.value);
    try { localStorage.setItem('vf_engine', e.target.value); } catch {}
  }

  async function handle(text) {
    setStatus('Working…');
    try {
      const msg = await handlerRef.current(text);
      setStatus(msg || 'Done');
      speak(msg, lang);
    } catch (e) {
      setStatus(e.message);
      speak(e.message, lang);
    }
  }

  // ---- Server engines: record, then send the audio for transcription ----
  async function startServer() {
    try {
      recorderRef.current = await startRecording();
    } catch (e) {
      setStatus(e.name === 'NotAllowedError' ? ERRORS['not-allowed'] : 'Could not start the microphone: ' + e.message);
      return;
    }
    setFinalText('');
    setListening(true);
    setStatus('Listening… tap again when done');
    const max = current.maxSeconds;
    timerRef.current = setInterval(() => {
      const s = Math.floor(recorderRef.current?.seconds() || 0);
      if (s >= max) stopServer();
      else setStatus(`Listening… ${s}s — tap again when done`);
    }, 500);
  }

  async function stopServer() {
    clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) return;
    setListening(false);
    if (recorder.seconds() < 0.5) {
      await recorder.cancel();
      setStatus('That was too short. Tap the mic and speak.');
      return;
    }
    setWorking(true);
    setStatus(`Transcribing with ${current.label}…`);
    try {
      const audio = await recorder.stop();
      const { text } = await api('/api/transcribe', { method: 'POST', body: { audio, engine } });
      if (!text.trim()) { setStatus('No speech heard. Tap the mic and try again.'); return; }
      setFinalText(text);
      await handle(text);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setWorking(false);
    }
  }

  // ---- Browser speech recognition ----
  function startBrowser() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    textRef.current = '';
    setFinalText('');
    setInterim('');
    let failed = false;
    rec.onstart = () => { setListening(true); setStatus('Listening… tap again when done'); };
    rec.onresult = e => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) textRef.current += r[0].transcript + ' ';
        else live += r[0].transcript;
      }
      setFinalText(textRef.current);
      setInterim(live);
    };
    rec.onerror = e => { failed = true; setStatus(ERRORS[e.error] || 'Voice error: ' + e.error); };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      if (textRef.current.trim()) handle(textRef.current);
      else if (!failed) setStatus('Tap the mic and speak');
    };
    recRef.current = rec;
    rec.start();
  }

  function toggle() {
    if (working) return;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (engine !== 'browser') listening ? stopServer() : startServer();
    else if (listening) recRef.current?.stop();
    else startBrowser();
  }

  function submitTyped(e) {
    e.preventDefault();
    if (!typed.trim()) return;
    setFinalText(typed);
    handle(typed);
  }

  const loading = engines === null;
  const noEngine = !loading && !engine;

  return (
    <section className="voice-panel">
      <div className="voice-controls">
        <button type="button" className={`mic${listening ? ' live' : ''}${working ? ' busy' : ''}`} onClick={toggle}
          disabled={!engine || working} aria-label={listening ? 'Stop listening' : 'Start listening'}>
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" /></svg>
        </button>
        <div className="voice-status">
          <div className="status">
            {loading ? 'Getting the microphone ready…'
              : noEngine ? 'Voice input needs Google Chrome or Microsoft Edge, or a speech engine set up on the server — you can type below.'
              : status}
          </div>
          <div className="transcript" aria-live="polite">
            {finalText || interim ? <>{finalText}<span className="interim">{interim}</span></> : <span className="hint">Say: “{example}”</span>}
          </div>
        </div>
      </div>
      <div className="options">
        {engines?.length > 1 && (
          <label>Voice engine{' '}
            <select value={engine || ''} onChange={chooseEngine} disabled={listening || working}>
              {engines.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </label>
        )}
        {engine === 'browser' && (
          <label>Language{' '}
            <select value={lang} onChange={e => setLang(e.target.value)} disabled={listening}>
              <option value="en-IN">English (India)</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
            </select>
          </label>
        )}
        <label className="check"><input type="checkbox" checked={tts} onChange={e => setTts(e.target.checked)} /> Read back what was filled</label>
      </div>
      <details className="typed" open={noEngine}>
        <summary>No mic? Type the sentence instead</summary>
        <form className="typed-row" onSubmit={submitTyped}>
          <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={example} aria-label="Type the sentence" />
          <button type="submit">Fill</button>
        </form>
      </details>
    </section>
  );
}
