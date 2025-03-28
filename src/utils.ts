import minimatch from 'minimatch';
import path from 'path';
import fs from 'fs/promises';
import _ from 'lodash';

import { v4 as genUid } from 'uuid';
import { XMLParser } from 'fast-xml-parser';

import { IJestCoverage, IExtractedCoverage, IProcessedCoverage } from './types';

const xmlParser = new XMLParser({ ignoreAttributes: false });

export const extractOverallCoverage = async (cobertura: string): Promise<{ timestamp: Date; rate: number }> => {
  const raw = await fs.readFile(cobertura).catch((error) => {
    console.error('Cannot find cobertura file', error?.stack ?? error);
    throw error;
  });

  const coverage: IJestCoverage = xmlParser.parse(raw);

  return {
    timestamp: new Date(Number(coverage.coverage['@_timestamp'])),
    rate: Number((Number(coverage.coverage['@_line-rate']) || 0).toFixed(3)),
  };
};

export const extractFilesCoverage = async (
  cobertura: string,
  options?: {
    silent?: boolean;
    all?: boolean;

    target?: number;
    limit?: number;

    ignore?: string[];
    paths?: string[];
  }
): Promise<IExtractedCoverage[]> => {
  const target = options?.target ?? 1;
  const raw = await fs.readFile(cobertura).catch((error) => {
    if (options?.silent) {
      return null;
    }

    console.error('Cannot find cobertura file', error?.stack ?? error);
    throw error;
  });

  if (!raw) {
    return [];
  }

  const coverage: IJestCoverage = xmlParser.parse(raw);
  if (!coverage.coverage.packages.package) {
    return [];
  }

  const parsed = _.flatten([coverage.coverage.packages.package]).reduce<IExtractedCoverage[]>(
    (acc, item) =>
      acc.concat(
        (Array.isArray(item.classes.class) ? item.classes.class : [item.classes.class]).map((nested) => ({
          id: genUid(),
          file: nested['@_filename'],
          rate: Number(Number(nested['@_line-rate']).toFixed(3)),
        }))
      ),
    []
  );

  if (options?.all) {
    options.paths?.forEach((nested) =>
      parsed.some(({ file }) => file.includes(nested))
        ? null
        : parsed.push({ id: genUid(), file: nested, rate: 0 })
    );
  }

  const filtred = parsed.filter(({ file, rate }) => {
    if (rate > target) {
      return false;
    }
    if (path.parse(file).name.endsWith('.spec')) {
      return false;
    }
    if (options?.paths?.length && !options.paths.some((nested) => file.includes(nested))) {
      return false;
    }
    if (options?.ignore?.length && options.ignore.some((pattern) => minimatch(file, pattern))) {
      return false;
    }

    return true;
  });

  const separated = filtred.reduce<{
    modules: IExtractedCoverage[];
    indexes: IExtractedCoverage[];
  }>((acc, coverage) => {
    path.parse(coverage.file).name === 'index'
      ? acc.indexes.push(coverage)
      : acc.modules.push(coverage);

    return acc;
  }, { indexes: [], modules: [] });

  return [
    ...separated.modules.sort((a, b) => a.rate - b.rate),
    ...separated.indexes.sort((a, b) => a.rate - b.rate),
  ].slice(0, options?.limit ?? Infinity);
};

export const renderProcessedCoverage = (timestamp: number, processed: IProcessedCoverage[]) =>
  console.table(
    processed.map((item) =>
      Object.assign(item, {
        spent: item.status === 'PENDING' ? Number(((Date.now() - timestamp) / 1000).toFixed(3)) : item.spent,
      })
    ),
    cast<(keyof IProcessedCoverage)[]>(['file', 'rate', 'target', 'status', 'spent'])
  );

export const actualizeProcessedCoverageRate = async (cwd: string, processed: IProcessedCoverage[], options?: {
  force?: boolean;
}) => {
  for (const item of (options?.force ? processed.filter((item) => item.status === 'PENDING') : processed)) {
    const [refreshed] = await extractFilesCoverage(path.join(cwd, item.cobertura), {
      target: Infinity,
      silent: true,
    });

    item.rate = refreshed?.rate ?? item.rate;
  }
};

export const extractIgnorePaths = async (cwd: string): Promise<string[]> => {
  const raw = await fs.readFile(path.join(cwd, '.unitignore'), 'utf8').catch(() => null);

  return (
    raw
      ?.split('\n')
      .map((segment) => segment.trim())
      .filter(Boolean) ?? []
  );
};

export const cast = <T>(value: T): T => value;

export const wait = (ms: number) => {
  const context = {
    isCanceled: false,
    timeout: <NodeJS.Timeout | undefined>undefined,
  };

  const promise = new Promise<void>((resolve) =>
    context.isCanceled ? resolve() : (context.timeout = setTimeout(resolve, ms))
  );

  return Object.assign(promise, {
    value: ms,
    abort: () => {
      context.isCanceled = true;
      clearTimeout(context.timeout);
    },
  });
};
