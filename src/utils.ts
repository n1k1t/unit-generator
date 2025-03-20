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
    rate: Number(Number(coverage.coverage['@_line-rate']).toFixed(3)),
  };
};

export const extractFilesCoverage = async (
  cobertura: string,
  options?: {
    silent?: boolean;
    ignore?: string[];
    paths?: string[];
    limit?: number;
    rate?: number;
  }
): Promise<IExtractedCoverage[]> => {
  const rate = options?.rate ?? 0.8;
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

  return _.flatten([coverage.coverage.packages.package])
    .reduce<IExtractedCoverage[]>(
      (acc, item) =>
        acc.concat(
          (Array.isArray(item.classes.class) ? item.classes.class : [item.classes.class])
            .filter((nested) => Number(nested['@_line-rate']) < rate)
            .map((nested) => ({
              id: genUid(),
              file: nested['@_filename'],
              rate: Number(Number(nested['@_line-rate']).toFixed(3)),
            }))
        ),
      []
    )
    .filter(({ file }) => {
      if (options?.paths?.length && !options.paths.some((nested) => file.includes(nested))) {
        return false;
      }
      if (options?.ignore?.length && options.ignore.some((pattern) => minimatch(file, pattern))) {
        return false;
      }

      return true;
    })
    .sort((a, b) => (a.file.includes('index') ? 1 : a.rate - b.rate))
    .slice(0, options?.limit ?? Infinity);
};

export const renderProcessedCoverage = (timestamp: number, processed: IProcessedCoverage[]) => {
  console.table(
    processed.map((item) =>
      Object.assign(item, {
        spent: item.status === 'PENDING' ? Number(((Date.now() - timestamp) / 1000).toFixed(3)) : item.spent,
      })
    ),
    cast<(keyof IProcessedCoverage)[]>(['file', 'rate', 'target', 'status', 'spent'])
  );
};

export const actualizeProcessedCoverageRate = async (cwd: string, processed: IProcessedCoverage[]) => {
  for (const item of processed) {
    const [refreshed] = await extractFilesCoverage(path.join(cwd, item.cobertura), {
      rate: Infinity,
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
