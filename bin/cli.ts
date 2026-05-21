#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { generateScenesApp } from '../src/index.js';
import { version } from '../package.json';

const program = new Command();

program
  .name('dashboards-to-scenes')
  .description('Generate a single Grafana Scenes app from a directory of dashboard YAML/JSON files')
  .version(version)
  .requiredOption('-i, --input <dir>', 'Input directory containing dashboard YAML/JSON files')
  .option('-o, --output <dir>', 'Output directory', './scenes-app')
  .option('-n, --name <name>', 'App name', 'my-scenes-app')
  .option('-r, --recursive', 'Recurse into subdirectories', false)
  .option('-s, --css <file>', 'Path to a custom CSS file to inject into the app')
  .option('-c, --colors <file>', 'Path to a JSON file with color mappings, e.g. {"green":"#00ff00","red":"#ff0000"}')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔧 Generating Grafana Scenes app...'));
      const result = await generateScenesApp({
        inputDir: path.resolve(options.input),
        outputDir: path.resolve(options.output),
        appName: options.name,
        recursive: !!options.recursive,
        cssFile: options.css,
        colorsFile: options.colors,
      });
      console.log(
        chalk.green(
          `✅ Done! ${result.dashboardCount} dashboard(s) → ${options.output}`
        )
      );
      console.log(
        chalk.yellow(
          `\nNext steps:\n  cd ${options.output}\n  npm install\n  npm run build\n  npm run server   # launches Grafana in Docker with the plugin loaded`
        )
      );
    } catch (err: any) {
      console.error(chalk.red('❌ Error:'), err.stack || err.message);
      process.exit(1);
    }
  });

program.parse();
