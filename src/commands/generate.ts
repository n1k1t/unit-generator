import cursorPosition from 'get-cursor-position';
import path from 'path';
import fs from 'fs/promises';

import { Readline } from 'readline/promises';
import { spawn } from 'child_process';

import { IUnitGeneratorCliOptions, IProcessedCoverage } from '../types';
import {
  actualizeProcessedCoverageRate,
  extractFilesCoverage,
  renderProcessedCoverage,
  cast,
  extractIgnorePaths,
} from '../utils';

import env from '../env';

interface IParameters extends Partial<Pick<IUnitGeneratorCliOptions['generate'], 'all' | 'model' | 'verbose'>> {
  target?: number;
  limit?: number;

  paths?: string[];
  iterations?: number;
}

export default async (parameters: IParameters = {}) => {
  const intervals: NodeJS.Timeout[] = [];
  const timestamp = Date.now();
  const cwd = process.cwd();

  const iterations = parameters.iterations ?? Number(env.iterations);
  const target = parameters.target ?? Number(env.target);

  const terminal = new Readline(process.stdout);
  const cursor = cursorPosition.sync();

  const ignore = await extractIgnorePaths(cwd);
  const extracted = await extractFilesCoverage(path.join(cwd, env.cobertura), {
    ignore,
    target,

    paths: parameters.paths,
    limit: parameters.limit,

    all: parameters.all,
  });

  const processed = extracted.map((item): IProcessedCoverage => {
    const parsed = path.parse(item.file);
    const temp = path.join(path.relative(cwd, path.join(__dirname, '../')), 'generated', item.id);

    return Object.assign(item, {
      target,
      temp,

      spec: path.join(parsed.dir, `${parsed.name}.spec${parsed.ext}`),
      cobertura: path.join(temp, 'cobertura-coverage.xml'),

      status: cast<'DONE' | 'ERROR' | 'PENDING'>('PENDING'),
      spent: 0,
    });
  });

  if (!parameters.verbose) {
    intervals.push(
      setInterval(() => actualizeProcessedCoverageRate(cwd, processed), 1000),
      setInterval(() => {
        terminal.cursorTo(0, cursor.row - 1).clearScreenDown().commit();
        renderProcessedCoverage(timestamp, processed);
      }, 100)
    );
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
          `--model="${parameters.model ?? env.model}"`,
          `--test-command="${jest}"`,
          `--test-file-path="${item.spec}"`,
          `--max-iterations="${iterations}"`,
          `--source-file-path="${item.file}"`,
          `--expected-coverage="${item.target * 100}"`,
          `--coverage-report-path="${item.cobertura}"`,
          env.url ? `--llmBaseUrl="${env.url}"` : '',
        ],
        {
          shell: true,
          env: Object.assign(process.env, { API_KEY: env.key }),
        }
      );

      if (parameters.verbose) {
        spawned.stdout.on('data', (chunk) => process.stdout.write(chunk));
      }

      await new Promise<void>((resolve) => spawned.once('exit', (code) => {
        item.status = code === 0 ? 'DONE' : 'ERROR';
        resolve();
      }));

      await actualizeProcessedCoverageRate(cwd, [item], { force: true });
      await fs.rm(item.temp, { recursive: true, force: true });
    })
  );

  intervals.forEach((interval) => interval.unref());

  terminal.cursorTo(0, cursor.row - 1).clearScreenDown().commit();
  renderProcessedCoverage(timestamp, processed);
};
