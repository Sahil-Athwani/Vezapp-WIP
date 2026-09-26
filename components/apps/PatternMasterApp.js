'use client';
import { useCallback, useEffect, useState } from 'react';
import VoiceBar from '@/components/VoiceBar';
import FieldGrid from '@/components/FieldGrid';
import { understand } from '@/lib/understand';
import { api, filledSummary, downloadCsv, fmtDate } from '@/lib/client';

const IDS = ['patternName', 'mouldingLine', 'mouldingProcess', 'customerPartName', 'grade', 'subGrade', 'noOfCavities'];
const EMPTY = Object.fromEntries(IDS.map(id => [id, '']));

export default function PatternMasterApp({ isAdmin }) {
  const [form, setForm] = useState(EMPTY);
  const [editingUid, setEditingUid] = useState(null);
  const [flash, setFlash] = useState([]);
  const [flashKey, setFlashKey] = useState(0);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api('/api/patterns' + (search ? `?q=${encodeURIComponent(search)}` : ''));
      setRows(d.rows);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function onTranscript(text) {
    const { values, corrections, unclear } = await understand(text, IDS);
    if (!Object.keys(values).length) return filledSummary(values, corrections, unclear);
    setForm(f => ({ ...f, ...values }));
    setFlash(Object.keys(values));
    setFlashKey(k => k + 1);
    return filledSummary(values, corrections, unclear);
  }

  function reset() {
    setForm(EMPTY);
    setEditingUid(null);
    setFlash([]);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      if (editingUid) {
        await api(`/api/patterns/${editingUid}`, { method: 'PUT', body: form });
        setMsg({ type: 'ok', text: `Pattern ${form.patternName} updated` });
      } else {
        try {
          await api('/api/patterns', { method: 'POST', body: form });
          setMsg({ type: 'ok', text: `Pattern ${form.patternName} saved` });
        } catch (e) {
          if (!e.data?.exists) throw e;
          if (!confirm(`${e.message}. Update it with the fields you filled? (Blank fields keep their current values.)`)) return;
          await api(`/api/patterns/${e.data.uid}`, { method: 'PUT', body: { ...form, partial: true } });
          setMsg({ type: 'ok', text: `Pattern ${form.patternName} updated` });
        }
      }
      reset();
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  function edit(row) {
    setEditingUid(row.uid);
    setForm(Object.fromEntries(IDS.map(id => [id, row[id] ?? ''])));
    setFlash([]);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(row) {
    if (!confirm(`Delete pattern ${row.patternName}?`)) return;
    try {
      await api(`/api/patterns/${row.uid}`, { method: 'DELETE' });
      if (editingUid === row.uid) reset();
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Pattern Master</h2>
          <p>Create and update patterns — line, process, customer part, grade and cavities.</p>
        </div>
      </div>
      <VoiceBar onTranscript={onTranscript}
        example="Pattern name PT 102, moulding line 3, grade FG 260, number of cavities 4" />

      <section className="card">
        <h2>{editingUid ? `Editing ${form.patternName || 'pattern'}` : 'New pattern'}</h2>
        <FieldGrid ids={IDS} values={form} onChange={setForm} flash={flash} flashKey={flashKey} />
        {msg && <p className={msg.type === 'error' ? 'error' : 'ok'} role="status">{msg.text}</p>}
        <div className="actions">
          <button type="button" className="secondary" onClick={reset}>{editingUid ? 'Cancel edit' : 'Clear'}</button>
          <button type="button" onClick={save} disabled={busy || !form.patternName.trim()}>
            {busy ? 'Saving…' : editingUid ? 'Update pattern' : 'Save pattern'}
          </button>
        </div>
      </section>

      <section className="card list">
        <div className="list-head">
          <h2>Patterns <span className="count">{rows.length}</span></h2>
          <div className="list-tools">
            <input type="search" placeholder="Search pattern or part" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search patterns" />
            <button type="button" className="secondary small" disabled={!rows.length}
              onClick={() => downloadCsv('pattern-master.csv', [
                { key: 'patternName', label: 'Pattern Name' }, { key: 'mouldingLine', label: 'Moulding Line' },
                { key: 'mouldingProcess', label: 'Moulding Process' }, { key: 'customerPartName', label: 'Customer Part Name' },
                { key: 'grade', label: 'Grade' }, { key: 'subGrade', label: 'Sub Grade' },
                { key: 'noOfCavities', label: 'No. Of Cavities' }, { key: 'totalGoodMoulds', label: 'Total Good Moulds' },
              ], rows)}>Download CSV</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Pattern</th><th>Line</th><th>Process</th><th>Customer Part</th><th>Grade</th><th>Sub Grade</th>
              <th className="num">Cavities</th><th className="num">Good Moulds (all time)</th><th>Updated</th><th />
            </tr></thead>
            <tbody>
              {rows.length ? rows.map(r => (
                <tr key={r.uid} className={editingUid === r.uid ? 'selected' : ''}>
                  <td><strong>{r.patternName}</strong></td><td>{r.mouldingLine}</td><td>{r.mouldingProcess}</td>
                  <td>{r.customerPartName}</td><td>{r.grade}</td><td>{r.subGrade}</td>
                  <td className="num">{r.noOfCavities}</td><td className="num">{Number(r.totalGoodMoulds).toLocaleString('en-IN')}</td>
                  <td>{fmtDate(r.updatedAt)}</td>
                  <td className="row-actions">
                    <button type="button" className="secondary small" onClick={() => edit(r)}>Edit</button>
                    {isAdmin && <button type="button" className="secondary small danger" onClick={() => remove(r)}>Delete</button>}
                  </td>
                </tr>
              )) : <tr><td colSpan={10} className="empty">No patterns yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

