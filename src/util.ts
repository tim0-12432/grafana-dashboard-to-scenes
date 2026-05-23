export function toSlug(str: string) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'dashboard';
}

export function toIdent(str: string) {
  let s = String(str || '').replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s || 'Item';
}

export function pascalCase(str: string) {
  return String(str || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Page';
}

// Stringify a JS value into source code (objects/arrays/primitives only).
// We just use JSON.stringify since everything from a dashboard is JSON-safe.
export function jsLiteral(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return '[' + value.map(jsLiteral).join(', ') + ']';
  }

  if (typeof value === 'object') {
    // Raw-code marker — emit the string as JS, unquoted.
    if ('__raw__' in (value as any) && typeof (value as any).__raw__ === 'string') {
      return (value as any).__raw__;
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)}: ${jsLiteral(v)}`);
    return '{' + entries.join(', ') + '}';
  }

  return JSON.stringify(value);
}

export function toPluginIdFromAppName(name: string) {
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${safe || 'myorg'}-app`;
}

export function applyColorMap<T>(obj: T, colorMap?: Record<string, string>): T {
  if (!colorMap) return obj;
  const json = JSON.stringify(obj);
  const replaced = json.replace(
    /"(green|red|yellow|blue|purple|orange|semi-dark-[a-z]+|dark-[a-z]+|light-[a-z]+|super-light-[a-z]+)"/g,
    (match, color) => (colorMap[color] ? `"${colorMap[color]}"` : match)
  );
  return JSON.parse(replaced);
}

// Sentinel wrapper so jsLiteral can emit raw code (not a quoted string).
// Requires jsLiteral to recognize this marker — see util.ts change below.
export function rawCode(code: string) {
  return { __raw__: code };
}
