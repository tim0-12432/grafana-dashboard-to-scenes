import { rawCode } from "./util.js";


const MAPPING_TYPE_ENUM: Record<string, string> = {
  value:   'MappingType.ValueToText',
  range:   'MappingType.RangeToText',
  regex:   'MappingType.RegexToText',
  special: 'MappingType.SpecialValue',
};

const SPECIAL_MATCH_ENUM: Record<string, string> = {
  true:       'SpecialValueMatch.True',
  false:      'SpecialValueMatch.False',
  null:       'SpecialValueMatch.Null',
  nan:        'SpecialValueMatch.NaN',
  'null+nan': 'SpecialValueMatch.NullAndNaN',
  empty:      'SpecialValueMatch.Empty',
};

function normalizeMapping(m: any): any {
  if (!m || typeof m !== 'object') return m;

  const typeRaw = String(m.type ?? '').toLowerCase();
  const typeEnum = MAPPING_TYPE_ENUM[typeRaw];

  const out: any = {
    ...m,
    type: typeEnum ? rawCode(typeEnum) : m.type,
  };

  if (typeRaw === 'special' && m.options && typeof m.options === 'object') {
    const matchRaw = String(m.options.match ?? '').toLowerCase();
    const matchEnum = SPECIAL_MATCH_ENUM[matchRaw];
    out.options = {
      ...m.options,
      match: matchEnum ? rawCode(matchEnum) : m.options.match,
    };
  }

  return out;
}

export function normalizeThresholds<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(normalizeThresholds) as any;
  }
  const out: any = {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (k === 'thresholds' && v && typeof v === 'object') {
      const t = v as any;
      out[k] = {
        ...t,
        mode:
          t.mode === 'percentage'
            ? rawCode('ThresholdsMode.Percentage')
            : rawCode('ThresholdsMode.Absolute'),
        steps: Array.isArray(t.steps)
          ? t.steps.map((s: any, i: number) => ({
              color: s?.color ?? 'green',
              // First step (base) has no numeric value in exported JSON.
              // Threshold type requires `value: number`; use -Infinity as raw code.
              value:
                typeof s?.value === 'number'
                  ? s.value
                  : i === 0
                  ? rawCode('-Infinity')
                  : 0,
            }))
          : t.steps,
      };
    } else if (k === 'mappings' && Array.isArray(v)) {
      out[k] = v.map(normalizeMapping);
    } else {
      out[k] = normalizeThresholds(v);
    }
  }
  return out;
}
