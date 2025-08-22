import path from 'path';

import { IUnitGeneratorCliOptions } from '../types';
import { Cobertura } from '../models';

import env from '../env';

export default async (options: Partial<IUnitGeneratorCliOptions['summary']> = {}) => {
  const cobertura = await Cobertura.build(path.join(process.cwd(), env.cobertura));

  options.format === 'table'
    ? console.table([{ rate: cobertura.rate, updated: new Date(cobertura.timestamp).toLocaleString() }])
    : console.log(String(cobertura.rate));
}
