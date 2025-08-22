import cursorPosition from 'get-cursor-position';
import path from 'path';
import _ from 'lodash';

import { Readline } from 'readline/promises';

import { extractCoberturaItems, extractIgnoredPaths } from './utils';
import { IUnitGeneratorCliOptions } from '../types';
import { Assistant } from '../models';

import env from '../env';

interface IParameters extends Partial<Pick<IUnitGeneratorCliOptions['generate'], 'all' | 'model'>> {
  target?: number;
  limit?: number;

  paths?: string[];
  iterations?: number;
}

const buildRenderer = () => {
  const terminal = new Readline(process.stdout);
  const cursor = cursorPosition.sync();

  return (assistants: Assistant[]) => {
    terminal.cursorTo(0, cursor.row - 1).clearScreenDown().commit();

    console.table(
      assistants.map((assistant) => ({
        file: assistant.source.code.path,
        rate: assistant.source.cobertura.rate,
        target: assistant.source.target,

        iteration: assistant.steps.length,
        strategy: assistant.state.strategy,

        status: assistant.state.status,
        spent: Number((assistant.calculateTimeSpent() / 1000).toFixed(3)),
      }))
    );
  };
};

export default async (parameters: IParameters = {}) => {
  const intervals: NodeJS.Timeout[] = [];
  const render = buildRenderer();

  const target = parameters.target ?? Number(env.target);
  const cwd = process.cwd();

  const ignore = await extractIgnoredPaths(cwd);
  const extracted = await extractCoberturaItems(path.join(cwd, env.cobertura), {
    ignore,
    target,
    cwd,

    paths: parameters.paths,
    limit: parameters.limit,

    all: parameters.all,
  });

  const assistants = await Promise.all(
    extracted.map((item) => Assistant.build(item.path, {
      cwd,
      target,

      model: parameters.model,

      iterations: parameters.iterations,
      rate: item.rate,
    }))
  );

  intervals.push(setInterval(() => render(assistants), 100));
  await Promise.all(assistants.map((assistant) => assistant.run()));

  intervals.forEach((interval) => interval.unref());
  render(assistants);
};
