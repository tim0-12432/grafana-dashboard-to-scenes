import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { listDashboardFiles, parseDashboardFile } from './parser.js';
import {
  generateSceneFile,
  generateAppFile,
  generateReactEntry,
  generateMainTsx,
  generateIndexHtml,
  generatePackageJson,
  generateTsConfig,
  generateViteConfig,
} from './generator.js';
import type { DashboardFile } from './types.js';

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

  // App + React + project files
  await fs.writeFile(path.join(outputDir, 'src', 'sceneApp.ts'), generateAppFile(dashboards));
  await fs.writeFile(path.join(outputDir, 'src', 'App.tsx'), generateReactEntry(appName, dashboards));
  await fs.writeFile(path.join(outputDir, 'src', 'main.tsx'), generateMainTsx());
  await fs.writeFile(path.join(outputDir, 'index.html'), generateIndexHtml(appName));
  await fs.writeFile(path.join(outputDir, 'package.json'), generatePackageJson(appName));
  await fs.writeFile(path.join(outputDir, 'tsconfig.json'), generateTsConfig());
  await fs.writeFile(path.join(outputDir, 'vite.config.ts'), generateViteConfig());
  await fs.writeFile(
    path.join(outputDir, 'README.md'),
    `# ${appName}

Auto-generated Grafana Scenes app from a directory of dashboards.

## Dashboards included

${dashboards.map((d) => `- **${d.title}** (\`${d.slug}\`) — ${d.panels.length} panels`).join('\n')}

## Setup

\`\`\`bash
npm install
npm run dev
\`\`\`
`
  );

  return { dashboardCount: dashboards.length };
}
