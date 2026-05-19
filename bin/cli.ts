#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { generateScenesApp } from '../src/index.js';

const program = new Command();

program
  .name('dashboards-to-scenes')
  .description('Generate a single Grafana Scenes app from a directory of dashboard YAML/JSON files')
  .version('0.2.0')
  .requiredOption('-i, --input <dir>', 'Input directory containing dashboard YAML/JSON files')
  .option('-o, --output <dir>', 'Output directory', './scenes-app')
  .option('-n, --name <name>', 'App name', 'my-scenes-app')
  .option('-r, --recursive', 'Recurse into subdirectories', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔧 Generating Grafana Scenes app...'));
      const result = await generateScenesApp({
        inputDir: path.resolve(options.input),
        outputDir: path.resolve(options.output),
        appName: options.name,
        recursive: !!options.recursive,
      });
      console.log(
        chalk.green(
          `✅ Done! ${result.dashboardCount} dashboard(s) → ${options.output}`
        )
      );
      console.log(
        chalk.yellow(
          `\nNext steps:\n  cd ${options.output}\n  npm install\n  npm run dev`
        )
      );
    } catch (err: any) {
      console.error(chalk.red('❌ Error:'), err.stack || err.message);
      process.exit(1);
    }
  });

program.parse();
