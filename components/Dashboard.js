'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers, CheckCircle2, TriangleAlert, FileText, Filter, TrendingUp, ExternalLink, Trophy,
  PackageSearch, Wind, CircleX, FilePlus2, Factory,
} from 'lucide-react';
import MouldChart from '@/components/MouldChart';
import { api, today, daysAgo } from '@/lib/client';

const fmt = n => Number(n || 0).toLocaleString('en-IN');
const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');

function startOf(unit) {
  const d = new Date();
  const s = unit === 'year' ? new Date(d.getFullYear(), 0, 1) : new Date(d.getFullYear(), d.getMonth(), 1);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
}
const PRESETS = [
  { label: 'This Month', range: () => ({ from: startOf('month'), to: today() }) },
  { label: 'Last 30 Days', range: () => ({ from: daysAgo(29), to: today() }) },
  { label: 'Last 90 Days', range: () => ({ from: daysAgo(89), to: today() }) },
  { label: 'This Year', range: () => ({ from: startOf('year'), to: today() }) },
];

function Stat({ label, value, note, Icon, tone }) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon${tone ? ' ' + tone : ''}`}><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        {note && <div className="stat-note">{note}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ firstName, allowed }) {
  const [range, setRange] = useState(PRESETS[0].range());
  const [patternUid, setPatternUid] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const can = k => allowed.includes(k);

  const load = useCallback(async () => {
    if (!range.from || !range.to || range.from > range.to) return;
    try {
      setError('');
      const q = new URLSearchParams({ from: range.from, to: range.to, ...(patternUid && { patternUid }) });
      setData(await api(`/api/dashboard?${q}`));
    } catch (e) {
      setError(e.message);
    }
  }, [range, patternUid]);
  useEffect(() => { load(); }, [load]);

  const m = data?.mould, w = data?.wip;
  const stats = [];
  if (data?.patterns) stats.push({ label: 'Total Patterns', value: fmt(data.patterns.length), note: 'in Pattern Master', Icon: Layers });
  if (m) {
    stats.push({ label: 'Good Moulds', value: fmt(m.totals.good), note: m.totals.planned ? `${pct(m.totals.good, m.totals.planned)} of ${fmt(m.totals.planned)} planned` : 'in selected range', Icon: CheckCircle2, tone: 'good' });
    stats.push({ label: 'Rejected Moulds', value: fmt(m.totals.reject), note: `Rejection rate ${pct(m.totals.reject, m.totals.good + m.totals.reject)}`, Icon: TriangleAlert, tone: 'danger' });
  }
  if (w) stats.push({ label: 'WIP Entries', value: fmt(w.entries), note: 'in selected range', Icon: PackageSearch });
  else if (m) stats.push({ label: 'Mould Reports', value: fmt(m.totals.reports), note: 'in selected range', Icon: FileText });

  const topMax = Math.max(1, ...(m?.top || []).map(t => t.good));

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Welcome back, {firstName}</h2>
          <p>Real-time moulding output, pattern performance and WIP health.</p>
        </div>
        <div className="head-actions">
          {can('pattern') && <Link href="/pattern-master" className="btn secondary"><FilePlus2 size={18} aria-hidden="true" /> New Pattern</Link>}
          {can('mould') && <Link href="/mould-reporting" className="btn"><Factory size={18} aria-hidden="true" /> New Mould Report</Link>}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="stats">
        {(data ? stats : [0, 1, 2, 3].map(() => ({ label: ' ', value: '…', Icon: FileText }))).map((s, i) => <Stat key={i} {...s} />)}
      </div>

      <div className="card filters">
        <span className="filters-label"><Filter size={16} aria-hidden="true" /> Filters</span>
        <label className="field"><span>From</span>
          <input type="date" value={range.from} max={range.to} onChange={e => setRange({ ...range, from: e.target.value })} />
        </label>
        <label className="field"><span>To</span>
          <input type="date" value={range.to} min={range.from} onChange={e => setRange({ ...range, to: e.target.value })} />
        </label>
        {data?.patterns && m && (
          <label className="field grow"><span>Pattern</span>
            <select value={patternUid} onChange={e => setPatternUid(e.target.value)}>
              <option value="">All patterns</option>
              {data.patterns.map(p => <option key={p.uid} value={p.uid}>{p.patternName}</option>)}
            </select>
          </label>
        )}
        <div className="chips">
          {PRESETS.map(p => {
            const r = p.range();
            const on = r.from === range.from && r.to === range.to;
            return <button key={p.label} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setRange(r)}>{p.label}</button>;
          })}
        </div>
      </div>

      <div className="dash-grid">
        {m && (
          <section className="card">
            <div className="card-head">
              <div>
                <h3 className="card-title"><TrendingUp size={20} aria-hidden="true" /> Mould Output Over Time</h3>
                <p className="card-sub">{fmt(m.totals.reports)} mould report{m.totals.reports === 1 ? '' : 's'} in the selected range</p>
              </div>
              <Link href="/mould-reporting" className="head-link">View Reports <ExternalLink size={16} aria-hidden="true" /></Link>
            </div>
            <MouldChart series={m.series} from={range.from} to={range.to} />
          </section>
        )}

        {(m || w) && (
          <section className="card">
            {m && (
              <>
                <div className="card-head">
                  <div>
                    <h3 className="card-title"><Trophy size={20} aria-hidden="true" /> Top Patterns</h3>
                    <p className="card-sub">Good moulds by pattern</p>
                  </div>
                  {can('pattern') && <Link href="/pattern-master" className="head-link">Pattern Master <ExternalLink size={16} aria-hidden="true" /></Link>}
                </div>
                {m.top.length ? (
                  <div className="hbars">
                    {m.top.map(t => (
                      <div key={t.uid} className="hbar-row" title={`${t.patternName}: ${fmt(t.good)} good, ${fmt(t.reject)} rejected`}>
                        <span className="label">{t.patternName}</span>
                        <span className="hbar-track"><span className="hbar-fill" style={{ display: 'block', width: `${(t.good / topMax) * 100}%` }} /></span>
                        <span className="val">{fmt(t.good)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted">No mould reports in this range.</p>}
              </>
            )}
            {w && (
              <>
                <div className={m ? 'section-label' : 'card-head'}>
                  {m ? 'WIP snapshot' : <h3 className="card-title"><PackageSearch size={20} aria-hidden="true" /> WIP Snapshot</h3>}
                </div>
                <div className="mini-tiles" style={m ? { marginTop: 0 } : undefined}>
                  <div className="mini good">
                    <div className="m-label"><PackageSearch size={15} aria-hidden="true" /> Knockout</div>
                    <div className="m-value">{fmt(w.knockoutStock)}</div>
                    <div className="m-note">in stock</div>
                  </div>
                  <div className="mini">
                    <div className="m-label"><Wind size={15} aria-hidden="true" /> Shot Blast</div>
                    <div className="m-value">{fmt(w.shotBlastStock)}</div>
                    <div className="m-note">in stock</div>
                  </div>
                  <div className="mini danger">
                    <div className="m-label"><CircleX size={15} aria-hidden="true" /> Rejected</div>
                    <div className="m-value">{fmt(w.knockoutRej + w.shotBlastRej)}</div>
                    <div className="m-note">KO {fmt(w.knockoutRej)} · SB {fmt(w.shotBlastRej)}</div>
                  </div>
                </div>
                <p className="card-sub" style={{ marginTop: 10 }}>
                  Stock = latest entry per part ({fmt(w.parts)} part{w.parts === 1 ? '' : 's'}). Rejections are totals for the range.
                </p>
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
