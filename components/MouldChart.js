'use client';
import { useMemo, useState } from 'react';

// Stacked bars of good vs rejected moulds over time. Colors validated for CVD separation
// (dataviz validator: #047857 / #f97316); numbers are always available via tooltip, legend and table.
export const GOOD = '#047857';
export const REJECT = '#f97316';

const W = 720, H = 280, M = { top: 12, right: 8, bottom: 30, left: 46 };
const fmt = n => Number(n).toLocaleString('en-IN');

function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// Day buckets up to a month, weeks (Mon start) up to ~6 months, months beyond.
function buckets(series, from, to) {
  const start = parse(from), end = parse(to);
  const days = Math.round((end - start) / 86400000) + 1;
  const unit = days <= 31 ? 'day' : days <= 186 ? 'week' : 'month';
  const keyOf = d => {
    if (unit === 'day') return iso(d);
    if (unit === 'week') { const k = new Date(d); k.setDate(k.getDate() - ((k.getDay() + 6) % 7)); return iso(k); }
    return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const map = new Map();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = keyOf(d);
    if (!map.has(k)) map.set(k, { key: k, good: 0, reject: 0 });
  }
  for (const r of series) {
    const b = map.get(keyOf(parse(r.date)));
    if (b) { b.good += r.good; b.reject += r.reject; }
  }
  const label = k => {
    const d = parse(k);
    return unit === 'month'
      ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  const title = k => {
    const d = parse(k);
    if (unit === 'day') return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (unit === 'week') return 'Week of ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };
  return { unit, rows: [...map.values()].map(b => ({ ...b, label: label(b.key), title: title(b.key) })) };
}

function niceMax(v) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Rectangle with only the top corners rounded (the data end); flat on the baseline side.
function topRounded(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function MouldChart({ series, from, to }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const { unit, rows } = useMemo(() => buckets(series, from, to), [series, from, to]);
  const totals = rows.reduce((a, r) => ({ good: a.good + r.good, reject: a.reject + r.reject }), { good: 0, reject: 0 });
  const max = niceMax(Math.max(0, ...rows.map(r => r.good + r.reject)));
  const pw = W - M.left - M.right, ph = H - M.top - M.bottom;
  const band = pw / Math.max(1, rows.length);
  const bw = Math.max(3, Math.min(44, band * 0.62));
  const y = v => M.top + ph - (v / max) * ph;
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i);
  const every = Math.ceil(rows.length / 10);

  return (
    <>
      <div className="legend" style={{ marginBottom: 10 }}>
        <span><i className="swatch" style={{ background: GOOD }} /> Good moulds · {fmt(totals.good)}</span>
        <span><i className="swatch" style={{ background: REJECT }} /> Rejected · {fmt(totals.reject)}</span>
      </div>
      {totals.good + totals.reject === 0 ? (
        <div className="chart-empty">No mould reports in this range.</div>
      ) : (
        <div className="chart" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Good and rejected moulds per ${unit}`}>
            <g className="axis">
              {ticks.map(t => (
                <g key={t}>
                  <line className={t === 0 ? 'baseline' : 'grid-line'} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
                  <text x={M.left - 8} y={y(t) + 4} textAnchor="end">{fmt(Math.round(t))}</text>
                </g>
              ))}
              {rows.map((r, i) => (i % every === 0 ? (
                <text key={r.key} x={M.left + band * i + band / 2} y={H - 8} textAnchor="middle">{r.label}</text>
              ) : null))}
            </g>
            {rows.map((r, i) => {
              const x = M.left + band * i + (band - bw) / 2;
              const gTop = y(r.good), rTop = y(r.good + r.reject);
              const gh = M.top + ph - gTop;
              const gap = r.good > 0 && r.reject > 0 ? 2 : 0;
              const dim = hover !== null && hover !== i ? 0.45 : 1;
              return (
                <g key={r.key} opacity={dim}>
                  {r.good > 0 && (r.reject > 0
                    ? <rect x={x} y={gTop} width={bw} height={gh} fill={GOOD} />
                    : <path d={topRounded(x, gTop, bw, gh, 4)} fill={GOOD} />)}
                  {r.reject > 0 && (
                    <path d={topRounded(x, rTop, bw, Math.max(1, gTop - rTop - gap), 4)} fill={REJECT} />
                  )}
                </g>
              );
            })}
            {rows.map((r, i) => (
              <rect key={r.key} x={M.left + band * i} y={M.top} width={band} height={ph} fill="transparent"
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
            ))}
          </svg>
          {hover !== null && (() => {
            const r = rows[hover];
            const total = r.good + r.reject;
            const left = ((M.left + band * hover + band / 2) / W) * 100;
            // keep the tooltip inside the chart near either edge
            const shift = left > 75 ? '-100%' : left < 25 ? '0%' : '-50%';
            return (
              <div className="tooltip" style={{
                left: `${left}%`,
                top: `${(y(total) / H) * 100}%`,
                transform: `translate(${shift}, calc(-100% - 10px))`,
              }}>
                <div className="t-title">{r.title}</div>
                <div className="t-row"><span><i className="swatch" style={{ background: GOOD }} /> Good</span><b>{fmt(r.good)}</b></div>
                <div className="t-row"><span><i className="swatch" style={{ background: REJECT }} /> Rejected</span><b>{fmt(r.reject)}</b></div>
                {total > 0 && <div className="t-row"><span>Rejection rate</span><b>{((r.reject / total) * 100).toFixed(1)}%</b></div>}
              </div>
            );
          })()}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button type="button" className="link" onClick={() => setShowTable(s => !s)}>{showTable ? 'Hide table' : 'Show as table'}</button>
      </div>
      {showTable && (
        <div className="table-wrap" style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>{unit === 'day' ? 'Date' : unit === 'week' ? 'Week of' : 'Month'}</th><th className="num">Good</th><th className="num">Rejected</th></tr></thead>
            <tbody>
              {rows.filter(r => r.good || r.reject).map(r => (
                <tr key={r.key}><td>{r.title}</td><td className="num">{fmt(r.good)}</td><td className="num">{fmt(r.reject)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
