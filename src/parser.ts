import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { toSlug } from './util.js';
import type { DashboardFile, DashboardPanel, DashboardVariable, DashboardAnnotation } from './types.js';

export async function listDashboardFiles(dir: string, recursive: boolean): Promise<string[]> {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive) {
        out.push(...(await listDashboardFiles(full, recursive)));
      }
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (['.yaml', '.yml', '.json'].includes(ext)) {
        out.push(full);
      }
    }
  }
  return out;
}

export async function parseDashboardFile(filePath: string): Promise<DashboardFile> {
  const content = await fs.readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  let data;
  if (ext === '.yaml' || ext === '.yml') {
    data = yaml.load(content);
  } else {
    data = JSON.parse(content);
  }

  // Grafana export wrappers:
  //   { dashboard: {...} }                 (API export)
  //   { spec: {...} }                      (K8s-style provisioning)
  //   { apiVersion, kind, spec: {...} }    (CRD)
  const dash =
    (data && data.dashboard) ||
    (data && data.spec) ||
    data ||
    {};

  const baseName = path.basename(filePath, ext);
  const uid = dash.uid || baseName;
  const title = dash.title || baseName;

  return {
    sourceFile: filePath,
    uid,
    slug: toSlug(uid || title),
    title,
    description: dash.description || '',
    tags: dash.tags || [],
    editable: dash.editable !== false,
    timeRange: dash.time || { from: 'now-6h', to: 'now' },
    timezone: dash.timezone || '',
    refresh: dash.refresh || '',
    panels: extractPanels(dash.panels || []),
    variables: extractVariables(dash.templating?.list || dash.variables || []),
    annotations: extractAnnotations(dash.annotations?.list || []),
    links: dash.links || [],
  };
}

function extractPanels(panels: any[], parentRow: { title: string }|null = null): DashboardPanel[] {
  const result = [];
  for (const p of panels) {
    if (p.type === 'row') {
      // Promote children, but preserve row info if needed
      if (Array.isArray(p.panels) && p.panels.length) {
        result.push(...extractPanels(p.panels, p));
      }
      continue;
    }
    result.push({
      id: p.id,
      title: p.title || '',
      description: p.description || '',
      type: p.type || 'timeseries',
      pluginVersion: p.pluginVersion,
      datasource: p.datasource,
      targets: (p.targets || []).map((t: any) => ({ ...t })),
      gridPos: p.gridPos || { x: 0, y: 0, w: 12, h: 8 },
      transformations: p.transformations || [],
      fieldConfig: p.fieldConfig || { defaults: {}, overrides: [] },
      options: p.options || {},
      links: p.links || [],
      transparent: !!p.transparent,
      repeat: p.repeat || null,
      repeatDirection: p.repeatDirection || null,
      maxDataPoints: p.maxDataPoints,
      interval: p.interval,
      timeFrom: p.timeFrom,
      timeShift: p.timeShift,
      hideTimeOverride: p.hideTimeOverride,
      cacheTimeout: p.cacheTimeout,
      rowTitle: parentRow ? parentRow.title : null,
    });
  }
  return result;
}

function extractVariables(vars: any[]): DashboardVariable[] {
  return vars.map((v) => ({
    name: v.name,
    label: v.label || '',
    description: v.description || '',
    type: v.type,
    hide: typeof v.hide === 'number' ? v.hide : 0,
    skipUrlSync: !!v.skipUrlSync,
    query:
      typeof v.query === 'string'
        ? v.query
        : v.query?.query || v.query || '',
    datasource: v.datasource,
    regex: v.regex || '',
    sort: v.sort || 0,
    refresh: typeof v.refresh === 'number' ? v.refresh : 1,
    multi: !!v.multi,
    includeAll: !!v.includeAll,
    allValue: v.allValue || null,
    current: v.current || undefined,
    options: v.options || [],
    // Used by interval/custom
    auto: !!v.auto,
    auto_count: v.auto_count,
    auto_min: v.auto_min,
  }));
}

function extractAnnotations(list: any[]): DashboardAnnotation[] {
  return list.map((a) => ({
    name: a.name || 'Annotations',
    enable: a.enable !== false,
    iconColor: a.iconColor || 'rgba(255, 96, 96, 1)',
    datasource: a.datasource,
    target: a.target,
    expr: a.expr,
    hide: !!a.hide,
    builtIn: a.builtIn || 0,
    type: a.type || 'dashboard',
  }));
}
