'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import VoiceBar from '@/components/VoiceBar';
import FieldGrid from '@/components/FieldGrid';
import { parse } from '@/lib/voiceParser';
import { patternKey } from '@/lib/patternKey';
import { api, filledSummary, downloadCsv, fmtDate, today, daysAgo, speak } from '@/lib/client';

const IDS = ['patternName', 'mouldingDate', 'plannedMouldNo', 'goodMould', 'rejectMould', 'cavitiesBlocked'];
const PATTERN_IDS = ['mouldingLine', 'mouldingProcess', 'customerPartName', 'grade', 'subGrade', 'noOfCavities'];
const EMPTY = Object.fromEntries(IDS.map(id => [id, '']));
const n = v => Number(v || 0).toLocaleString('en-IN');

export default function MouldReportingApp({ isAdmin }) {
  const [form, setForm] = useState(EMPTY);
  const [flash, setFlash] = useState([]);
  const [flashKey, setFlashKey] = useState(0);
  const [pattern, setPattern] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [lookup, setLookup] = useState('idle'); // idle | searching | done
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState({ from: daysAgo(30), to: today() });
  const [data, setData] = useState({ rows: [], summary: [] });
  const lookupSeq = useRef(0);

  const findPattern = useCallback(async name => {
    const seq = ++lookupSeq.current;
    setLookup('searching');
    let d;
    try {
      d = await api(`/api/patterns/match?name=${encodeURIComponent(name)}`);
    } catch (e) {
      if (seq === lookupSeq.current) setLookup('idle');
      throw e;
    }
    if (seq !== lookupSeq.current) return d;
    setPattern(d.match);
    setCandidates(d.candidates);
    setLookup('done');
    return d;
  }, []);

  // Typed pattern names are looked up too (voice-filled ones are looked up in onTranscript)
  useEffect(() => {
    const key = patternKey(form.patternName);
    if (pattern && patternKey(pattern.patternName) === key) return;
    if (pattern) setPattern(null); // name changed: never save against the previously matched pattern
    if (!key) { lookupSeq.current++; setCandidates([]); setLookup('idle'); return; }
    const t = setTimeout(() => findPattern(form.patternName).catch(e => setMsg({ type: 'error', text: e.message })), 400);
    return () => clearTimeout(t);
  }, [form.patternName, pattern, findPattern]);

  const load = useCallback(async () => {
    if (!range.from || !range.to) return;
    try {
      setData(await api(`/api/mould-reports?from=${range.from}&to=${range.to}`));
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  async function onTranscript(text) {
    const values = parse(text, IDS);
    if (!Object.keys(values).length) return "Sorry, I didn't catch any Mould Reporting field names.";
    setForm(f => ({ ...f, ...values }));
    setFlash(Object.keys(values));
    setFlashKey(k => k + 1);
    let said = filledSummary(values);
    if (values.patternName) {
      const d = await findPattern(values.patternName);
      if (d.match) {
        setForm(f => ({ ...f, patternName: d.match.patternName }));
        said += `. Pattern ${d.match.patternName} found`
          + (d.match.customerPartName ? `, customer part ${d.match.customerPartName}` : '')
          + (d.match.noOfCavities != null ? `, ${d.match.noOfCavities} cavities` : '') + '.';
      } else if (d.candidates.length) {
        said += `. Pattern ${values.patternName} is not in Pattern Master. Did you mean ${d.candidates.slice(0, 3).map(c => c.patternName).join(', or ')}?`;
      } else {
        said += `. Pattern ${values.patternName} is not in Pattern Master. Add it there first.`;
      }
    }
    return said;
  }

  function pick(c) {
    setPattern(c);
    setCandidates([]);
    setForm(f => ({ ...f, patternName: c.patternName }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/mould-reports', { method: 'POST', body: { ...form, patternUid: pattern.uid } });
      const text = `Reported ${n(form.goodMould)} good moulds against ${pattern.patternName}`;
      setMsg({ type: 'ok', text });
      speak(text);
      setForm({ ...EMPTY, mouldingDate: form.mouldingDate });
      setFlash([]);
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const planned = Number(form.plannedMouldNo), made = Number(form.goodMould || 0) + Number(form.rejectMould || 0);
  const overPlan = form.plannedMouldNo !== '' && made > planned;
  const missing = !pattern ? 'Pick a pattern' : !form.mouldingDate ? 'Enter the moulding date' : form.goodMould === '' ? 'Enter good moulds' : '';

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Mould Reporting</h2>
          <p>Say the pattern name to pull its details from Pattern Master, then report the moulds.</p>
        </div>
      </div>
      <VoiceBar onTranscript={onTranscript}
        example="Pattern name PT 102, moulding date today, planned moulds 120, good moulds 110, reject moulds 10" />

      <section className="card">
        <h2>New report</h2>
        <FieldGrid ids={IDS} values={form} onChange={setForm} flash={flash} flashKey={flashKey} />

        <div className="pattern-box">
          {lookup === 'searching' && <p className="muted">Looking up pattern…</p>}
          {lookup === 'done' && !pattern && (
            <div className="warn-box">
              <strong>"{form.patternName}" is not in Pattern Master.</strong>
              {candidates.length ? (
                <div className="chips">
                  <span>Did you mean:</span>
                  {candidates.map(c => <button key={c.uid} type="button" className="chip" onClick={() => pick(c)}>{c.patternName}</button>)}
                </div>
              ) : <span> Add it in Pattern Master first.</span>}
            </div>
          )}
          {pattern && (
            <>
              <h3>From Pattern Master: {pattern.patternName}</h3>
              <FieldGrid ids={PATTERN_IDS} values={pattern} onChange={() => {}} readOnly={PATTERN_IDS} />
            </>
          )}
        </div>

        {overPlan && <p className="warn-text">Good + reject moulds ({made}) is more than planned ({planned}).</p>}
        {msg && <p className={msg.type === 'error' ? 'error' : 'ok'} role="status">{msg.text}</p>}
        <div className="actions">
          <button type="button" className="secondary" onClick={() => { setForm(EMPTY); setFlash([]); setMsg(null); }}>Clear</button>
          <button type="button" onClick={save} disabled={busy || !!missing} title={missing}>
            {busy ? 'Saving…' : missing || 'Save report'}
          </button>
        </div>
      </section>

      <section className="card list">
        <div className="list-head">
          <h2>Good moulds by pattern</h2>
          <div className="list-tools">
            <label>From <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} /></label>
            <label>To <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} /></label>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pattern</th><th>Customer Part</th><th className="num">Reports</th><th className="num">Planned</th><th className="num">Good Moulds</th><th className="num">Rejected</th></tr></thead>
            <tbody>
              {data.summary.length ? data.summary.map(s => (
                <tr key={s.patternUid}>
                  <td><strong>{s.patternName}</strong></td><td>{s.customerPartName}</td>
                  <td className="num">{s.reports}</td><td className="num">{n(s.planned)}</td>
                  <td className="num"><strong>{n(s.good)}</strong></td><td className="num">{n(s.rejected)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="empty">No reports in this date range.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card list">
        <div className="list-head">
          <h2>Reports <span className="count">{data.rows.length}</span></h2>
          <button type="button" className="secondary small" disabled={!data.rows.length}
            onClick={() => downloadCsv(`mould-reporting-${range.from}-to-${range.to}.csv`, [
              { key: 'mouldingDate', label: 'Moulding Date' }, { key: 'patternName', label: 'Pattern Name' },
              { key: 'mouldingLine', label: 'Moulding Line' }, { key: 'mouldingProcess', label: 'Moulding Process' },
              { key: 'customerPartName', label: 'Customer Part Name' }, { key: 'grade', label: 'Grade' },
              { key: 'subGrade', label: 'Sub Grade' }, { key: 'noOfCavities', label: 'No. Of Cavities' },
              { key: 'plannedMouldNo', label: 'Planned Mould No' }, { key: 'goodMould', label: 'Good Mould' },
              { key: 'rejectMould', label: 'Reject Mould' }, { key: 'cavitiesBlocked', label: 'Cavities Blocked' },
              { key: 'createdByName', label: 'Entered By' },
            ], data.rows)}>Download CSV</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Date</th><th>Pattern</th><th>Line</th><th>Customer Part</th><th>Grade</th>
              <th className="num">Planned</th><th className="num">Good</th><th className="num">Reject</th><th className="num">Cav. Blocked</th><th>By</th><th />
            </tr></thead>
            <tbody>
              {data.rows.length ? data.rows.map(r => (
                <tr key={r.uid}>
                  <td>{fmtDate(r.mouldingDate)}</td><td><strong>{r.patternName}</strong></td><td>{r.mouldingLine}</td>
                  <td>{r.customerPartName}</td><td>{r.grade}{r.subGrade ? ` / ${r.subGrade}` : ''}</td>
                  <td className="num">{r.plannedMouldNo}</td><td className="num">{r.goodMould}</td>
                  <td className="num">{r.rejectMould}</td><td className="num">{r.cavitiesBlocked}</td><td>{r.createdByName}</td>
                  <td className="row-actions">
                    {isAdmin && <button type="button" className="secondary small danger" onClick={async () => {
                      if (!confirm(`Delete the ${fmtDate(r.mouldingDate)} report for ${r.patternName}?`)) return;
                      try { await api(`/api/mould-reports/${r.uid}`, { method: 'DELETE' }); load(); }
                      catch (e) { setMsg({ type: 'error', text: e.message }); }
                    }}>Delete</button>}
                  </td>
                </tr>
              )) : <tr><td colSpan={11} className="empty">No reports in this date range.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

