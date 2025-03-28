#!/usr/bin/env node

import cursorPosition from 'get-cursor-position';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

import { Command, program } from 'commander';
import { exec, spawn } from 'child_process';
import { Readline } from 'readline/promises';

import { IExtractedCoverage, IUnitGeneratorCliOptions, IProcessedCoverage } from './types';
import { cast, extractIgnorePaths, wait } from './utils';
import {
  actualizeProcessedCoverageRate,
  extractFilesCoverage,
  extractOverallCoverage,
  renderProcessedCoverage,
} from './utils';

const config = dotenv.config();

const env = {
  token: config.parsed?.UNIT_GENERATOR_API_KEY,
  model: config.parsed?.UNIT_GENERATOR_MODEL ?? 'gpt-4o-mini',

  command: config.parsed?.UNIT_GENERATOR_TEST_COMMAND ?? 'npm test',
  cobertura: config.parsed?.UNIT_GENERATOR_COBERTURA_PATH ?? 'coverage/cobertura-coverage.xml',

  iterations: config.parsed?.UNIT_GENERATOR_MAX_ITERATIONS ?? '5',
  target: config.parsed?.UNIT_GENERATOR_COVERAGE_TARGET ?? '0.8',
};

if (!env.token) {
  console.error('Cannot define [env.UNIT_GENERATOR_API_KEY]');
  process.exit(1);
}

program
  .description('It generates unit-tests by Jest coverage')
  .addCommand(
    new Command()
      .command('summary')
      .description('Returns an overall coverage in the project')
      .option('-f --format [table|number]', 'Output format', 'table')
      .action(async (options: IUnitGeneratorCliOptions['summary']) => {
        const extracted = await extractOverallCoverage(path.join(process.cwd(), env.cobertura));

        options.format === 'table'
          ? console.table([{ rate: extracted.rate, updated: extracted.timestamp.toLocaleString() }])
          : console.log(String(extracted.rate));

        process.exit(0);
      })
  )
  .addCommand(
    new Command()
      .command('calculate')
      .description('Calculates a coverage of the whole project and returns summary')
      .action(async () => {
        await new Promise<void>((resolve, reject) =>
          exec(`${env.command} -- --coverage --forceExit --silent --workerThreads`, (error) =>
            error ? reject(error) : resolve()
          )
        );

        const extracted = await extractOverallCoverage(path.join(process.cwd(), env.cobertura));

        console.table([{ rate: extracted.rate, updated: extracted.timestamp.toLocaleString() }]);
        process.exit(0);
      })
  )
  .addCommand(
    new Command()
      .command('analyze [pattern]')
      .description('Returns a table of low covered project files')
      .option('-t, --target [value]', 'Desired coverage target of an each file', env.target)
      .option('-l --limit [value]', 'Files limit', '5')
      .option('-a --all', 'Takes all paths provided by pattern', false)
      .action(async (pattern: string | undefined, options: IUnitGeneratorCliOptions['analyze'], command: Command) => {
        const cwd = process.cwd();

        const ignore = await extractIgnorePaths(cwd);
        const extracted = await extractFilesCoverage(path.join(cwd, env.cobertura), {
          ignore,

          target: Number(options.target),
          limit: Number(options.limit),

          paths: command.args,
          all: options.all,
        });

        console.table(extracted, cast<(keyof IExtractedCoverage)[]>(['file', 'rate']));
        process.exit(0);
      })
  )
  .addCommand(
    new Command()
      .command('generate [pattern]')
      .description('Generates unit tests')
      .option('-t, --target [value]', 'Desired coverage target of an each file', env.target)
      .option('-m, --model [value]', 'AI model to use for unit tests generation', env.model)
      .option('-i, --iterations [value]', 'Iterations maximum of unit tests generation', env.iterations)
      .option('-l --limit [value]', 'Files limit', '5')
      .option('-v --verbose', 'Replaces pretty table with a raw Keploy as output', false)
      .option('-a --all', 'Takes all paths provided by pattern', false)
      .action(async (pattern: string | undefined, options: IUnitGeneratorCliOptions['generate'], command: Command) => {
        const timestamp = Date.now();

        const target = Number(options.target);
        const cwd = process.cwd();

        const terminal = new Readline(process.stdout);
        const cursor = cursorPosition.sync();

        const ignore = await extractIgnorePaths(cwd);
        const extracted = await extractFilesCoverage(path.join(cwd, env.cobertura), {
          ignore,
          target,

          paths: command.args,
          limit: Number(options.limit),

          all: options.all,
        });

        const processed = extracted.map((item): IProcessedCoverage => {
          const parsed = path.parse(item.file);
          const temp = path.join(path.relative(cwd, __dirname), 'generated', item.id);

          return Object.assign(item, {
            target,
            temp,

            spec: path.join(parsed.dir, `${parsed.name}.spec${parsed.ext}`),
            cobertura: path.join(temp, 'cobertura-coverage.xml'),

            status: cast<'DONE' | 'ERROR' | 'PENDING'>('PENDING'),
            spent: 0,
          });
        });

        if (!options.verbose) {
          setInterval(() => actualizeProcessedCoverageRate(cwd, processed), 1500);
          setInterval(() => {
            terminal.cursorTo(0, cursor.row - 1).clearScreenDown().commit();
            renderProcessedCoverage(timestamp, processed);
          }, 100);
        }

        await Promise.all(
          processed.map(async (item) => {
            const jest = [
              `${env.command} -- ${item.spec}`,
              '--coverage --forceExit --silent',
              `--coverageDirectory=${item.temp}`,
              `--collectCoverageFrom=${item.file}`,
            ].join(' ');

            if (!(await fs.stat(item.spec).catch(() => null))) {
              await fs.writeFile(item.spec, Buffer.from([]), 'utf8');
            }
            if (!(await fs.stat(item.temp).catch(() => null))) {
              await fs.mkdir(item.temp);
            }

            const spawned = spawn(
              'keploy',
              [
                'gen',
                `--model="${options.model}"`,
                `--test-command="${jest}"`,
                `--test-file-path="${item.spec}"`,
                `--max-iterations="${options.iterations}"`,
                `--source-file-path="${item.file}"`,
                `--expected-coverage="${item.target * 100}"`,
                `--coverage-report-path="${item.cobertura}"`,
              ],
              {
                shell: true,
                env: Object.assign(process.env, { API_KEY: env.token }),
              }
            );

            if (options.verbose) {
              spawned.stdout.on('data', (chunk) => process.stdout.write(chunk));
            }

            await new Promise<void>((resolve) =>
              spawned.once('exit', (code) => {
                item.status = code === 0 ? 'DONE' : 'ERROR';
                resolve();
              })
            );

            await actualizeProcessedCoverageRate(cwd, [item]);
            await fs.rm(item.temp, { recursive: true, force: true });
          })
        );

        await wait(200);
        process.exit(0);
      })
  )
  .parse();
