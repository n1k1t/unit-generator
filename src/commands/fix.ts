import path from 'path';
import _ from 'lodash';

import { buildRenderer, extractCoberturaItems, extractIgnoredPaths } from './utils';
import { IUnitGeneratorCliOptions } from '../types';
import { Assistant } from '../models';

import env from '../env';

interface IParameters extends Partial<Pick<IUnitGeneratorCliOptions['generate'], 'all' | 'model'>> {
  limit?: number;

  paths?: string[];
  iterations?: number;
}

export default async (parameters: IParameters = {}) => {
  const intervals: NodeJS.Timeout[] = [];
  const render = buildRenderer();

  const target = Infinity;
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
      strategies: ['FIX'],
    }))
  );

  intervals.push(setInterval(() => render(assistants), 100));
  await Promise.all(assistants.map((assistant) => assistant.run()));

  intervals.forEach((interval) => interval.unref());
  render(assistants);
};
