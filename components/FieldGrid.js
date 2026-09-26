'use client';
import { FIELDS } from '@/lib/voiceParser';

// Renders inputs for the given field ids. `flash` holds ids just filled by voice; bumping `flashKey`
// remounts those inputs so the highlight animation replays.
export default function FieldGrid({ ids, values, onChange, flash = [], flashKey = 0, readOnly = [], datalists = {} }) {
  return (
    <div className="grid">
      {ids.map(id => {
        const f = FIELDS[id];
        const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
        return (
          <label key={id} className="field">
            <span>{f.label}</span>
            <input
              key={flash.includes(id) ? `${id}-${flashKey}` : id}
              className={flash.includes(id) ? 'flash' : ''}
              name={id}
              type={type}
              inputMode={type === 'number' ? 'numeric' : undefined}
              min={type === 'number' ? 0 : undefined}
              step={type === 'number' ? 1 : undefined}
              value={values[id] ?? ''}
              readOnly={readOnly.includes(id)}
              list={datalists[id]}
              autoComplete="off"
              onChange={e => onChange({ ...values, [id]: e.target.value })}
            />
          </label>
        );
      })}
    </div>
  );
}
