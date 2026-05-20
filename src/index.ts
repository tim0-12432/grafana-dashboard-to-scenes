import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { listDashboardFiles, parseDashboardFile } from './parser.js';
import {
  generateSceneFile,
  generateAppFile,
  generatePackageJson,
  generateTsConfig,
  generateDockerCompose,
  generateLogoSvg,
  generateModuleTsx,
  generatePluginJson,
  generateWebpackConfig,
  generateWebpackConstants,
  generatePluginsYaml,
} from './generator.js';
import type { DashboardFile } from './types.js';
import { toPluginIdFromAppName } from './util.js';

export async function generateScenesApp({ inputDir, outputDir, appName, recursive }: { inputDir: string, outputDir: string, appName: string, recursive: boolean }) {
  const stat = await fs.stat(inputDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Input must be an existing directory: ${inputDir}`);
  }

  const files = await listDashboardFiles(inputDir, recursive);
  if (files.length === 0) {
    throw new Error(`No .yaml/.yml/.json dashboards found in ${inputDir}`);
  }

  console.log(chalk.cyan(`📁 Found ${files.length} dashboard file(s).`));

  const dashboards: DashboardFile[] = [];
  const seenSlugs = new Set();

  for (const f of files) {
    try {
      const d = await parseDashboardFile(f);
      // Ensure unique slugs across all dashboards
      let slug = d.slug;
      let n = 1;
      while (seenSlugs.has(slug)) {
        slug = `${d.slug}-${++n}`;
      }
      d.slug = slug;
      seenSlugs.add(slug);

      console.log(
        chalk.gray(`  • ${path.relative(inputDir, f)}  →  "${d.title}" (${d.panels.length} panels, ${d.variables.length} vars)`)
      );
      dashboards.push(d);
    } catch (e: any) {
      console.warn(chalk.yellow(`  ! Skipping ${f}: ${e.message}`));
    }
  }

  if (dashboards.length === 0) {
    throw new Error('No parsable dashboards.');
  }

  // Write app skeleton
  await fs.ensureDir(outputDir);
  await fs.ensureDir(path.join(outputDir, 'src'));
  await fs.ensureDir(path.join(outputDir, 'src', 'dashboards'));

  // Per-dashboard scene files
  for (const d of dashboards) {
    const filePath = path.join(outputDir, 'src', 'dashboards', `${d.slug}.ts`);
    await fs.writeFile(filePath, generateSceneFile(d));
  }

  // Plugin entry + manifest
  await fs.writeFile(path.join(outputDir, 'src', 'sceneApp.ts'), generateAppFile(dashboards));
  await fs.writeFile(path.join(outputDir, 'src', 'module.tsx'), generateModuleTsx());
  await fs.writeFile(path.join(outputDir, 'src', 'plugin.json'), generatePluginJson(appName, dashboards));

  // Logo placeholder
  await fs.ensureDir(path.join(outputDir, 'src', 'img'));
  await fs.writeFile(path.join(outputDir, 'src', 'img', 'logo.svg'), generateLogoSvg());

  // Project tooling
  await fs.writeFile(path.join(outputDir, 'package.json'), generatePackageJson(appName));
  await fs.writeFile(path.join(outputDir, 'tsconfig.json'), generateTsConfig());

  // Webpack config under .config/webpack/
  await fs.ensureDir(path.join(outputDir, '.config', 'webpack'));
  await fs.writeFile(path.join(outputDir, '.config', 'webpack', 'webpack.config.ts'), generateWebpackConfig());
  await fs.writeFile(path.join(outputDir, '.config', 'webpack', 'constants.js'), generateWebpackConstants());

  // Local Grafana via docker-compose
  await fs.writeFile(path.join(outputDir, 'docker-compose.yaml'), generateDockerCompose(appName));
  await fs.ensureDir(path.join(outputDir, 'provisioning', 'plugins'));
  await fs.writeFile(path.join(outputDir, 'provisioning', 'plugins', 'plugins.yaml'), generatePluginsYaml(appName));

  // README with instructions
  await fs.writeFile(
    path.join(outputDir, 'README.md'),
    `# ${appName}

Auto-generated **Grafana App Plugin** from a directory of dashboards.

## Dashboards included

${dashboards.map((d) => `- **${d.title}** (\`${d.slug}\`) — ${d.panels.length} panels`).join('\n')}

## Build

\`\`\`bash
npm install
npm run build
\`\`\`

Output goes into \`./dist\`.

## Run locally (Docker)

\`\`\`bash
npm run server
\`\`\`

Then open http://localhost:3000 → Administration → Plugins → enable the app.

## Install in an existing Grafana

1. Copy \`./dist\` to \`<grafana-data-dir>/plugins/${toPluginIdFromAppName(appName)}/\`
2. Allow unsigned in \`grafana.ini\`:
   \`\`\`ini
   [plugins]
   allow_loading_unsigned_plugins = ${toPluginIdFromAppName(appName)}
   \`\`\`
3. Restart Grafana, then enable the plugin in the UI.
`
  );

  return { dashboardCount: dashboards.length };
}
