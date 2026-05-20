import { extractCoberturaItems, extractIgnoredPaths } from './utils';
import { CoberturaItem } from '../models';
import { cast } from '../utils';

import env from '../env';

interface IParameters {
  target?: number;
  limit?: number;

  paths?: string[];
}

export default async (parameters: IParameters = {}) => {
  const cwd = process.cwd();

  const ignore = await extractIgnoredPaths(cwd);
  const extracted = await extractCoberturaItems(env.cobertura, {
    ignore,
    cwd,

    target: parameters.target ?? Number(env.target),
    limit: parameters.limit,
    paths: parameters.paths,
  });

  console.table(extracted, cast<(keyof CoberturaItem)[]>(['path', 'rate']));
}
