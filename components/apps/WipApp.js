'use client';
import { useCallback, useEffect, useState } from 'react';
import VoiceBar from '@/components/VoiceBar';
import FieldGrid from '@/components/FieldGrid';
import { parse } from '@/lib/voiceParser';
import { api, filledSummary, downloadCsv, fmtDate, today, daysAgo } from '@/lib/client';

const IDS = ['partName', 'knockoutStock', 'shotBlastStock', 'knockoutRej', 'shotBlastRej'];
const EMPTY = Object.fromEntries(IDS.map(id => [id, '']));

export default function WipApp({ isAdmin }) {
  const [form, setForm] = useState(EMPTY);
  const [flash, setFlash] = useState([]);
  const [flashKey, setFlashKey] = useState(0);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState({ from: daysAgo(7), to: today() });
  const [rows, setRows] = useState([]);
  const [parts, setParts] = useState([]);

  const load = useCallback(async () => {
    if (!range.from || !range.to) return;
    try {
      setRows((await api(`/api/wip?from=${range.from}&to=${range.to}`)).rows);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  // Part name suggestions from Pattern Master's customer part names
  useEffect(() => {
    api('/api/patterns')
      .then(d => setParts([...new Set(d.rows.map(r => r.customerPartName).filter(Boolean))]))
      .catch(() => {});
  }, []);

  async function onTranscript(text) {
    const values = parse(text, IDS);
    if (!Object.keys(values).length) return "Sorry, I didn't catch any WIP field names.";
    setForm(f => ({ ...f, ...values }));
    setFlash(Object.keys(values));
    setFlashKey(k => k + 1);
    return filledSummary(values);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/wip', { method: 'POST', body: form });
      setMsg({ type: 'ok', text: `WIP saved for ${form.partName}` });
      setForm(EMPTY);
      setFlash([]);
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>WIP Reporting</h2>
          <p>Record knockout and shot blast stock and rejections by part.</p>
        </div>
      </div>
      <VoiceBar onTranscript={onTranscript}
        example="Part name brake drum, knockout stock 45, shot blast stock 30, knockout rejection 2, shot blasting rejection 1" />

      <section className="card">
        <h2>New WIP entry</h2>
        <FieldGrid ids={IDS} values={form} onChange={setForm} flash={flash} flashKey={flashKey} datalists={{ partName: 'part-names' }} />
        <datalist id="part-names">{parts.map(p => <option key={p} value={p} />)}</datalist>
        {msg && <p className={msg.type === 'error' ? 'error' : 'ok'} role="status">{msg.text}</p>}
        <div className="actions">
          <button type="button" className="secondary" onClick={() => { setForm(EMPTY); setFlash([]); setMsg(null); }}>Clear</button>
          <button type="button" onClick={save} disabled={busy || !form.partName.trim()}>{busy ? 'Saving…' : 'Save entry'}</button>
        </div>
      </section>

      <section className="card list">
        <div className="list-head">
          <h2>Entries <span className="count">{rows.length}</span></h2>
          <div className="list-tools">
            <label>From <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} /></label>
            <label>To <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} /></label>
            <button type="button" className="secondary small" disabled={!rows.length}
              onClick={() => downloadCsv(`wip-${range.from}-to-${range.to}.csv`, [
                { key: 'createdAt', label: 'Entered At' }, { key: 'partName', label: 'Part Name' },
                { key: 'knockoutStock', label: 'Knockout Stock' }, { key: 'shotBlastStock', label: 'Shot Blast Stock' },
                { key: 'knockoutRej', label: 'Knockout Rej' }, { key: 'shotBlastRej', label: 'Shot Blasting Rej' },
                { key: 'createdByName', label: 'Entered By' },
              ], rows)}>Download CSV</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Date</th><th>Part Name</th><th className="num">Knockout Stock</th><th className="num">Shot Blast Stock</th>
              <th className="num">Knockout Rej</th><th className="num">Shot Blasting Rej</th><th>By</th><th />
            </tr></thead>
            <tbody>
              {rows.length ? rows.map(r => (
                <tr key={r.uid}>
                  <td>{fmtDate(r.createdAt)}</td><td><strong>{r.partName}</strong></td>
                  <td className="num">{r.knockoutStock}</td><td className="num">{r.shotBlastStock}</td>
                  <td className="num">{r.knockoutRej}</td><td className="num">{r.shotBlastRej}</td><td>{r.createdByName}</td>
                  <td className="row-actions">
                    {isAdmin && <button type="button" className="secondary small danger" onClick={async () => {
                      if (!confirm(`Delete this WIP entry for ${r.partName}?`)) return;
                      try { await api(`/api/wip/${r.uid}`, { method: 'DELETE' }); load(); }
                      catch (e) { setMsg({ type: 'error', text: e.message }); }
                    }}>Delete</button>}
                  </td>
                </tr>
              )) : <tr><td colSpan={8} className="empty">No WIP entries in this date range.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

