import { jsLiteral, toIdent } from './util.js';
import type { DashboardFile, DashboardVariable, DashboardAnnotation, DashboardPanel } from './types.js';

type VizPanelOpts = {
    title: string,
    description: string | undefined,
    pluginId: string,
    pluginVersion: string,
    options: Record<string, unknown>,
    fieldConfig: {
        defaults: Record<string, unknown>,
        overrides: Record<string, unknown>[]
    },
    displayMode: string | undefined,
    hoverHeader: undefined,
    links: any[] | undefined,
  }

/* ------------------------------------------------------------------ */
/*  Panel-type → Scenes pluginId mapping                              */
/* ------------------------------------------------------------------ */

const PANEL_TYPE_MAP: { [key: string]: string } = {
  graph: 'timeseries',
  timeseries: 'timeseries',
  stat: 'stat',
  singlestat: 'stat',
  gauge: 'gauge',
  bargauge: 'bargauge',
  table: 'table',
  'table-old': 'table',
  barchart: 'barchart',
  piechart: 'piechart',
  text: 'text',
  heatmap: 'heatmap',
  logs: 'logs',
  news: 'news',
  nodeGraph: 'nodeGraph',
  state: 'state-timeline',
  'state-timeline': 'state-timeline',
  'status-history': 'status-history',
  histogram: 'histogram',
  geomap: 'geomap',
  candlestick: 'candlestick',
  canvas: 'canvas',
  trend: 'trend',
};

function mapPanelType(type: string) {
  return PANEL_TYPE_MAP[type] || type || 'timeseries';
}

/* ------------------------------------------------------------------ */
/*  Variable code generation                                          */
/* ------------------------------------------------------------------ */

function genVariable(v: DashboardVariable) {
  const common = {
    name: v.name,
    label: v.label || undefined,
    description: v.description || undefined,
    hide: v.hide,
    skipUrlSync: v.skipUrlSync,
  };

  switch (v.type) {
    case 'query':
      return `new QueryVariable(${jsLiteral({
        ...common,
        datasource: v.datasource,
        query: v.query,
        regex: v.regex || undefined,
        sort: v.sort,
        refresh: v.refresh,
        isMulti: v.multi,
        includeAll: v.includeAll,
        allValue: v.allValue || undefined,
        value: v.current?.value,
        text: v.current?.text,
      })})`;
    case 'custom':
      return `new CustomVariable(${jsLiteral({
        ...common,
        query: typeof v.query === 'string'
          ? v.query
          : (v.options || []).map((o) => o.value).join(','),
        isMulti: v.multi,
        includeAll: v.includeAll,
        allValue: v.allValue || undefined,
        value: v.current?.value,
        text: v.current?.text,
      })})`;
    case 'constant':
      return `new ConstantVariable(${jsLiteral({
        ...common,
        value: v.current?.value ?? v.query,
      })})`;
    case 'textbox':
      return `new TextBoxVariable(${jsLiteral({
        ...common,
        value: v.current?.value ?? v.query ?? '',
      })})`;
    case 'interval':
      return `new IntervalVariable(${jsLiteral({
        ...common,
        intervals:
          typeof v.query === 'string'
            ? v.query.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        value: v.current?.value,
        autoEnabled: v.auto,
        autoMinInterval: v.auto_min,
        autoStepCount: v.auto_count,
      })})`;
    case 'datasource':
      return `new DataSourceVariable(${jsLiteral({
        ...common,
        pluginId: v.query,
        regex: v.regex || undefined,
        isMulti: v.multi,
        includeAll: v.includeAll,
        value: v.current?.value,
        text: v.current?.text,
      })})`;
    case 'adhoc':
      // Best-effort: Scenes has AdHocFiltersVariable
      return `new AdHocFiltersVariable(${jsLiteral({
        ...common,
        datasource: v.datasource,
        filters: [],
      })})`;
    default:
      return `new CustomVariable(${jsLiteral({
        ...common,
        query: String(v.query || ''),
      })})`;
  }
}

/* ------------------------------------------------------------------ */
/*  Annotations                                                       */
/* ------------------------------------------------------------------ */

function genAnnotations(annotations: DashboardAnnotation[]) {
  if (!annotations.length) return 'undefined';
  const layers = annotations.map(
    (a) => `new dataLayers.AnnotationsDataLayer(${jsLiteral({
      name: a.name,
      query: {
        datasource: a.datasource,
        enable: a.enable,
        iconColor: a.iconColor,
        name: a.name,
        target: a.target,
        expr: a.expr,
        hide: a.hide,
        builtIn: a.builtIn,
        type: a.type,
      },
    })})`
  );
  return `new SceneDataLayerSet({
    layers: [
      ${layers.join(',\n      ')}
    ],
  })`;
}

/* ------------------------------------------------------------------ */
/*  Panel code generation                                             */
/* ------------------------------------------------------------------ */

function genPanel(p: DashboardPanel, idx: number) {
  const pluginId = mapPanelType(p.type);

  const queries = (p.targets || []).map((t, i) => {
    const refId = t.refId || String.fromCharCode(65 + i);
    // Pass through whole target to retain datasource-specific fields.
    return { ...t, refId };
  });

  const queryRunner = `new SceneQueryRunner(${jsLiteral({
    datasource: p.datasource,
    queries,
    maxDataPoints: p.maxDataPoints,
    minInterval: p.interval,
    cacheTimeout: p.cacheTimeout,
  })})`;

  const dataExpr = p.transformations && p.transformations.length
    ? `new SceneDataTransformer({
        $data: ${queryRunner},
        transformations: ${jsLiteral(p.transformations)},
      })`
    : queryRunner;

  const vizPanelOpts: VizPanelOpts = {
    title: p.title,
    description: p.description || undefined,
    pluginId,
    pluginVersion: p.pluginVersion,
    options: p.options || {},
    fieldConfig: p.fieldConfig || { defaults: {}, overrides: [] },
    displayMode: p.transparent ? 'transparent' : undefined,
    hoverHeader: undefined,
    links: p.links || undefined,
  };

  // Strip undefineds for cleaner output
  Object.keys(vizPanelOpts).forEach(
    (k: string) => vizPanelOpts[k as keyof VizPanelOpts] === undefined && delete vizPanelOpts[k as keyof VizPanelOpts]
  );

  const panelVar = `panel_${idx}`;
  const panelCode = `const ${panelVar} = new VizPanel({
    ...${jsLiteral(vizPanelOpts)},
    $data: ${dataExpr},
  });`;

  return { panelVar, panelCode, gridPos: p.gridPos };
}

/* ------------------------------------------------------------------ */
/*  Scene file per dashboard                                          */
/* ------------------------------------------------------------------ */

export function generateSceneFile(dashboard: DashboardFile) {
  const panelEntries = dashboard.panels.map((p, idx) => genPanel(p, idx));

  const panelDeclarations = panelEntries.map((e) => '  ' + e.panelCode).join('\n\n');

  const gridChildren = panelEntries
    .map(
      (e) => `    new SceneGridItem({
      x: ${e.gridPos.x ?? 0}, y: ${e.gridPos.y ?? 0},
      width: ${e.gridPos.w ?? 12}, height: ${e.gridPos.h ?? 8},
      body: ${e.panelVar},
    })`
    )
    .join(',\n');

  const variableDefs = dashboard.variables
    .map((v) => '      ' + genVariable(v))
    .join(',\n');

  const annotationsExpr = genAnnotations(dashboard.annotations);

  return `// AUTO-GENERATED from ${dashboard.sourceFile}
// Dashboard: ${dashboard.title} (uid: ${dashboard.uid})

import {
  EmbeddedScene,
  SceneGridLayout,
  SceneGridItem,
  SceneQueryRunner,
  SceneDataTransformer,
  SceneTimePicker,
  SceneRefreshPicker,
  SceneTimeRange,
  SceneVariableSet,
  SceneDataLayerSet,
  dataLayers,
  VizPanel,
  QueryVariable,
  CustomVariable,
  ConstantVariable,
  TextBoxVariable,
  IntervalVariable,
  DataSourceVariable,
  AdHocFiltersVariable,
  VariableValueSelectors,
} from '@grafana/scenes';

export function getScene() {
${panelDeclarations}

  const scene = new EmbeddedScene({
    $timeRange: new SceneTimeRange(${jsLiteral({
      from: dashboard.timeRange.from,
      to: dashboard.timeRange.to,
      timeZone: dashboard.timezone || undefined,
    })}),
    $variables: new SceneVariableSet({
      variables: [
${variableDefs}
      ],
    }),
    $data: ${annotationsExpr},
    body: new SceneGridLayout({
      isDraggable: false,
      isResizable: false,
      children: [
${gridChildren}
      ],
    }),
    controls: [
      new VariableValueSelectors({}),
      new SceneTimePicker({}),
      new SceneRefreshPicker(${jsLiteral({
        refresh: dashboard.refresh || '',
      })}),
    ],
  });

  return scene;
}

export const meta = ${jsLiteral({
  uid: dashboard.uid,
  slug: dashboard.slug,
  title: dashboard.title,
  description: dashboard.description,
  tags: dashboard.tags,
})};
`;
}

/* ------------------------------------------------------------------ */
/*  App entry — combines all dashboards into one SceneApp             */
/* ------------------------------------------------------------------ */

export function generateAppFile(dashboards: DashboardFile[]) {
  const imports = dashboards
    .map(
      (d) =>
        `import { getScene as get_${toIdent(d.slug)}, meta as meta_${toIdent(
          d.slug
        )} } from './dashboards/${d.slug}';`
    )
    .join('\n');

  const pages = dashboards
    .map(
      (d) => `    new SceneAppPage({
      title: meta_${toIdent(d.slug)}.title,
      subTitle: meta_${toIdent(d.slug)}.description,
      url: \`/a/\${meta_${toIdent(d.slug)}.slug}\`,
      hideFromBreadcrumbs: false,
      getScene: () => get_${toIdent(d.slug)}(),
    })`
    )
    .join(',\n');

  return `// AUTO-GENERATED app entry
${imports}

import { SceneApp, SceneAppPage } from '@grafana/scenes';

export function getSceneApp() {
  return new SceneApp({
    pages: [
${pages}
    ],
  });
}
`;
}

/* ------------------------------------------------------------------ */
/*  React entry                                                       */
/* ------------------------------------------------------------------ */

export function generateReactEntry(appName: string, dashboards: DashboardFile[]) {
  const navLinks = dashboards
    .map(
      (d) =>
        `        <a href={\`#/a/${d.slug}\`} style={{ marginRight: 12 }}>${d.title.replace(/</g, '&lt;')}</a>`
    )
    .join('\n');

  return `import React from 'react';
import { getSceneApp } from './sceneApp';

export const App = () => {
  const app = getSceneApp();
  return (
    <div style={{ padding: 16 }}>
      <h1>${appName}</h1>
      <nav style={{ marginBottom: 16 }}>
${navLinks}
      </nav>
      <app.Component model={app} />
    </div>
  );
};

export default App;
`;
}

export function generateMainTsx() {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}

export function generateIndexHtml(appName: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

export function generatePackageJson(appName: string) {
  return JSON.stringify(
    {
      name: appName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        '@grafana/data': '^11.3.0',
        '@grafana/runtime': '^11.3.0',
        '@grafana/schema': '^11.3.0',
        '@grafana/ui': '^11.3.0',
        '@grafana/scenes': '^5.21.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.2.0',
        typescript: '^5.3.0',
        vite: '^5.0.0',
      },
    },
    null,
    2
  );
}

export function generateTsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
      },
      include: ['src'],
    },
    null,
    2
  );
}

export function generateViteConfig() {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@grafana/scenes',
      '@grafana/schema',
      '@grafana/data',
      '@grafana/ui',
      '@grafana/runtime',
    ],
  },
});
`;
}
