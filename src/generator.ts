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
        `import { getScene as get_${toIdent(d.slug)}, meta as meta_${toIdent(d.slug)} } from './dashboards/${d.slug}';`
    )
    .join('\n');

  const pages = dashboards
    .map(
      (d) => `    new SceneAppPage({
      title: meta_${toIdent(d.slug)}.title,
      url: \`/a/\${PLUGIN_ID}/${d.slug}\`,
      routePath: \`/a/\${PLUGIN_ID}/${d.slug}\`,
      getScene: () => get_${toIdent(d.slug)}(),
    })`
    )
    .join(',\n');

  const firstSlug = dashboards[0]?.slug;

  return `import { SceneApp, SceneAppPage } from '@grafana/scenes';
${imports}

import pluginJson from './plugin.json';
const PLUGIN_ID = pluginJson.id;

let app: SceneApp | undefined;

export function getSceneApp() {
  if (!app) {
    app = new SceneApp({
      pages: [
        ${pages},
        new SceneAppPage({
          title: 'Home',
          url: \`/a/\${PLUGIN_ID}\`,
          routePath: \`/a/\${PLUGIN_ID}\`,
          getScene: () => get_${toIdent(firstSlug)}(),
        }),
      ],
    });
  }
  return app;
}
`;
}

/* ------------------------------------------------------------------ */
/*  Grafana App Plugin entry — module.tsx                             */
/* ------------------------------------------------------------------ */

export function generateModuleTsx() {
  return `import React from 'react';
import { AppPlugin, type AppRootProps } from '@grafana/data';
import { getSceneApp } from './sceneApp';

const RootPage = (_props: AppRootProps) => {
  const app = getSceneApp();
  // SceneApp is itself a SceneObject — render via its Component
  return <app.Component model={app} />;
};

export const plugin = new AppPlugin<{}>().setRootPage(RootPage);
`;
}

/* ------------------------------------------------------------------ */
/*  plugin.json manifest                                              */
/* ------------------------------------------------------------------ */

export function generatePluginJson(appName: string, dashboards: DashboardFile[]) {
  const pluginId = toPluginId(appName);
  const today = new Date().toISOString().slice(0, 10);

  // One nav entry per dashboard so they appear in the left-nav of the app
  const includes = [
    {
      type: 'page',
      name: 'Home',
      path: `/a/${pluginId}`,
      role: 'Viewer',
      addToNav: true,
      defaultNav: true,
    },
    ...dashboards.map((d) => ({
      type: 'page',
      name: d.title,
      path: `/a/${pluginId}/${d.slug}`,
      role: 'Viewer',
      addToNav: true,
    })),
  ];

  return JSON.stringify(
    {
      $schema: 'https://raw.githubusercontent.com/grafana/grafana/main/docs/sources/developers/plugins/plugin.schema.json',
      type: 'app',
      name: appName,
      id: pluginId,
      info: {
        keywords: ['scenes', 'dashboards'],
        description: 'Auto-generated Grafana Scenes app',
        author: { name: 'dashboards-to-scenes' },
        logos: {
          small: 'img/logo.svg',
          large: 'img/logo.svg',
        },
        screenshots: [],
        version: '1.0.0',
        updated: today,
      },
      dependencies: {
        grafanaDependency: '>=10.4.0',
        plugins: [],
      },
      includes,
    },
    null,
    2
  );
}

function toPluginId(appName: string) {
  // Grafana plugin ids must look like `<org>-<name>-app`
  const safe = appName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${safe || 'myorg'}-app`;
}

/* ------------------------------------------------------------------ */
/*  Logo placeholder                                                  */
/* ------------------------------------------------------------------ */

export function generateLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
`;
}

/* ------------------------------------------------------------------ */
/*  package.json — uses @grafana/create-plugin tooling                */
/* ------------------------------------------------------------------ */

export function generatePackageJson(appName: string) {
  const pluginId = toPluginId(appName);
  return JSON.stringify(
    {
      name: pluginId,
      version: '1.0.0',
      description: 'Auto-generated Grafana Scenes app plugin',
      private: true,
      scripts: {
        build: 'webpack -c ./.config/webpack/webpack.config.ts --env production',
        dev: 'webpack -w -c ./.config/webpack/webpack.config.ts --env development',
        typecheck: 'tsc --noEmit',
        server: 'docker-compose up --build',
      },
      dependencies: {
        '@grafana/data': '^11.3.0',
        '@grafana/runtime': '^11.3.0',
        '@grafana/schema': '^11.3.0',
        '@grafana/ui': '^11.3.0',
        '@grafana/scenes': '^5.21.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        tslib: '^2.6.0',
      },
      devDependencies: {
        '@swc/core': '^1.4.0',
        '@swc/helpers': '^0.5.0',
        '@types/node': '^20.10.0',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@types/webpack-livereload-plugin': '^2.3.6',
        'copy-webpack-plugin': '^12.0.0',
        'fork-ts-checker-webpack-plugin': '^9.0.0',
        'swc-loader': '^0.2.6',
        'terser-webpack-plugin': '^5.3.10',
        'ts-node': '^10.9.2',
        typescript: '^5.3.0',
        webpack: '^5.90.0',
        'webpack-cli': '^5.1.4',
        'webpack-livereload-plugin': '^3.0.2',
      },
    },
    null,
    2
  );
}

/* ------------------------------------------------------------------ */
/*  tsconfig.json                                                     */
/* ------------------------------------------------------------------ */

export function generateTsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'es2020',
        module: 'commonjs',
        moduleResolution: 'nodenext',
        jsx: 'react',
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
        forceConsistentCasingInFileNames: true,
        declaration: false,
        sourceMap: true,
        noEmit: true,
        outDir: './dist',
        rootDir: './src',
        baseUrl: './src',
      },
      include: ['src', '.config'],
    },
    null,
    2
  );
}

/* ------------------------------------------------------------------ */
/*  Webpack config (Grafana plugin standard)                          */
/* ------------------------------------------------------------------ */

export function generateWebpackConfig() {
  return `import path from 'path';
import { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import { DIST_DIR, SOURCE_DIR } from './constants.js';

const config = async (env: Record<string, unknown>): Promise<Configuration> => {
  const isProduction = env.production === true;
  return {
    cache: { type: 'filesystem', buildDependencies: { config: [__filename] } },
    context: path.join(process.cwd(), SOURCE_DIR),
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    entry: { module: \`./module.tsx\` },
    externals: [
      'react',
      'react-dom',
      'react-router-dom',
      '@grafana/data',
      '@grafana/runtime',
      '@grafana/ui',
    ],
    mode: isProduction ? 'production' : 'development',
    module: {
      rules: [
        {
          test: /\\.[tj]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                baseUrl: path.resolve(process.cwd(), SOURCE_DIR),
                target: 'es2015',
                loose: false,
                parser: { syntax: 'typescript', tsx: true, decorators: false, dynamicImport: true },
              },
            },
          },
        },
        { test: /\\.css$/, use: ['style-loader', 'css-loader'] },
        { test: /\\.s[ac]ss$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
        { test: /\\.(png|jpe?g|gif|svg)$/, type: 'asset/resource' },
      ],
    },
    output: {
      clean: { keep: new RegExp('.*?_amd64|.*?_arm64|.*?_arm|.*?_386') },
      filename: '[name].js',
      library: { type: 'amd' },
      path: path.resolve(process.cwd(), DIST_DIR),
      publicPath: 'public/plugins/\${(await import(\`../../src/plugin.json\`)).default.id}/',
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: 'plugin.json', to: '.' },
          { from: 'img/**/*', to: '.', noErrorOnMissing: true },
          { from: '../README.md', to: '.', force: true, noErrorOnMissing: true },
        ],
      }),
      new ForkTsCheckerWebpackPlugin({
        async: Boolean(env.development),
          typescript: {
            configFile: path.join(process.cwd(), 'tsconfig.json'),
            mode: 'write-references',
            diagnosticOptions: {
            semantic: true,
            syntactic: true,
          },
        },
      }),
      ...(isProduction ? [] : [new LiveReloadPlugin()]),
    ],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      unsafeCache: true,
    },
    optimization: {
      minimize: isProduction,
      minimizer: [new TerserPlugin({ extractComments: false })],
    },
  };
};

export default config;
`;
}

export function generateWebpackConstants() {
  return `export const SOURCE_DIR = 'src';
export const DIST_DIR = 'dist';
`;
}

/* ------------------------------------------------------------------ */
/*  docker-compose for local Grafana with plugin mounted              */
/* ------------------------------------------------------------------ */

export function generateDockerCompose(appName: string) {
  const pluginId = toPluginId(appName);
  return `version: '3.0'

services:
  grafana:
    image: grafana/grafana:11.3.0
    ports:
      - 3000:3000
    volumes:
      - ./dist:/var/lib/grafana/plugins/${pluginId}
      - ./provisioning:/etc/grafana/provisioning
    environment:
      - GF_DEFAULT_APP_MODE=development
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=${pluginId}
`;
}

/* ------------------------------------------------------------------ */
/*  provisioning.yaml to auto-load the plugin in local Grafana         */
/* ------------------------------------------------------------------ */

export function generatePluginsYaml(appName: string) {
    const pluginId = toPluginId(appName);
    return `apiVersion: 1
apps:
  - type: ${pluginId}
`;
}
