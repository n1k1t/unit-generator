import path from 'path';
import _ from 'lodash';

import { buildRenderer, extractCoberturaItems, extractIgnoredPaths } from './utils';
import { IUnitGeneratorCliOptions } from '../types';
import { Assistant } from '../models';

import env from '../env';

interface IParameters extends Partial<Pick<IUnitGeneratorCliOptions['generate'], 'all' | 'model'>> {
  target?: number;
  limit?: number;

  paths?: string[];
  iterations?: number;
}

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

  if (env.parallel) {
    await Promise.all(assistants.map((assistant) => assistant.run()));
  } else {
    for (const assistant of assistants) {
      await assistant.run();
    }
  }

  intervals.forEach((interval) => interval.unref());
  render(assistants);
};
