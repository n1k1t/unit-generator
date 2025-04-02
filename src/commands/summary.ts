import path from 'path';

import { IUnitGeneratorCliOptions } from '../types';
import { extractOverallCoverage } from '../utils';

import env from '../env';

export default async (options: Partial<IUnitGeneratorCliOptions['summary']> = {}) => {
  const extracted = await extractOverallCoverage(path.join(process.cwd(), env.cobertura));
  if (!extracted) {
    throw new Error('Invalid codertura');
  }

  options.format === 'table'
    ? console.table([{ rate: extracted.rate, updated: extracted.timestamp.toLocaleString() }])
    : console.log(String(extracted.rate));
}
