import { handler, requireUser } from '@/lib/api';
import { query } from '@/lib/db';
import { PATTERN_SELECT } from '@/lib/patterns';
import { patternKey, editDistance } from '@/lib/patternKey';

// Finds the Pattern Master entry for a spoken pattern name.
// Exact match ignores case, spaces and symbols ("pt 102" == "PT-102"). Otherwise it returns close
// candidates for the user to pick — never auto-picks, so moulds aren't reported against the wrong pattern.
export const GET = handler(async req => {
  const user = await requireUser({ apps: ['pattern', 'mould'] });
  const key = patternKey(new URL(req.url).searchParams.get('name'));
  if (!key) return Response.json({ match: null, candidates: [] });

  const [exact] = await query(
    `SELECT ${PATTERN_SELECT} FROM PatternMaster p WHERE p.CompanyID = ? AND p.PatternKey = ?`,
    [user.cid, key],
  );
  if (exact) return Response.json({ match: exact, candidates: [] });

  const all = await query(
    `SELECT ${PATTERN_SELECT}, p.PatternKey AS patternKey FROM PatternMaster p WHERE p.CompanyID = ?`,
    [user.cid],
  );
  const scored = all
    .map(p => {
      let d = editDistance(key, p.patternKey);
      if (p.patternKey.includes(key) || key.includes(p.patternKey)) d = Math.min(d, 1);
      return { p, d };
    })
    .filter(x => x.d <= Math.max(1, Math.floor(key.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);

  return Response.json({
    match: null,
    candidates: scored.map(({ p: { patternKey: _k, ...rest } }) => rest),
  });
});
