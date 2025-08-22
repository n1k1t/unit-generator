import path from 'path';

import { extractCoberturaItems, extractIgnoredPaths } from './utils';
import { IUnitGeneratorCliOptions } from '../types';
import { CoberturaItem } from '../models';
import { cast } from '../utils';

import env from '../env';

interface IParameters extends Partial<Pick<IUnitGeneratorCliOptions['analyze'], 'all'>> {
  target?: number;
  limit?: number;

  paths?: string[];
}

export default async (parameters: IParameters = {}) => {
  const cwd = process.cwd();

  const ignore = await extractIgnoredPaths(cwd);
  const extracted = await extractCoberturaItems(path.join(cwd, env.cobertura), {
    ignore,
    cwd,

    target: parameters.target ?? Number(env.target),
    limit: parameters.limit,

    paths: parameters.paths,
    all: parameters.all,
  });

  console.table(extracted, cast<(keyof CoberturaItem)[]>(['path', 'rate']));
}
