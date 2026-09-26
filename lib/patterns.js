import { text, count, HttpError } from './api';
import { patternKey } from './patternKey';

export const PATTERN_SELECT = `
  p.PatternUID AS uid, p.PatternName AS patternName, p.MouldingLine AS mouldingLine,
  p.MouldingProcess AS mouldingProcess, p.CustomerPartName AS customerPartName, p.Grade AS grade,
  p.SubGrade AS subGrade, p.NoOfCavities AS noOfCavities`;

// Validates a request body into PatternMaster columns. Blank values become NULL.
export function patternColumns(b) {
  const name = text(b.patternName, 'Pattern Name', { max: 100, required: true });
  const key = patternKey(name);
  if (!key) throw new HttpError(400, 'Pattern Name must contain letters or numbers');
  return {
    PatternName: name,
    PatternKey: key,
    MouldingLine: text(b.mouldingLine, 'Moulding Line', { max: 100 }),
    MouldingProcess: text(b.mouldingProcess, 'Moulding Process', { max: 100 }),
    CustomerPartName: text(b.customerPartName, 'Customer Part Name', { max: 255 }),
    Grade: text(b.grade, 'Grade', { max: 60 }),
    SubGrade: text(b.subGrade, 'Sub Grade', { max: 60 }),
    NoOfCavities: count(b.noOfCavities, 'No. Of Cavities', { max: 1000 }),
  };
}
