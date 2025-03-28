import path from 'path';

import { extractFilesCoverage, cast, extractIgnorePaths } from '../utils';
import { IUnitGeneratorCliOptions, IExtractedCoverage } from '../types';

import env from '../env';

interface IParameters extends Partial<Pick<IUnitGeneratorCliOptions['analyze'], 'all'>> {
  target?: number;
  limit?: number;

  paths?: string[];
}

export default async (parameters: IParameters = {}) => {
  const cwd = process.cwd();

  const ignore = await extractIgnorePaths(cwd);
  const extracted = await extractFilesCoverage(path.join(cwd, env.cobertura), {
    ignore,

    target: parameters.target ?? Number(env.target),
    limit: parameters.limit,

    paths: parameters.paths,
    all: parameters.all,
  });

  console.table(extracted, cast<(keyof IExtractedCoverage)[]>(['file', 'rate']));
}
