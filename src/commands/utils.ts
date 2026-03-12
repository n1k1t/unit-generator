import cursorPosition from 'get-cursor-position';
import minimatch from 'minimatch';
import path from 'path';
import fs from 'fs/promises';
import _ from 'lodash';

import { Readline } from 'readline/promises';

import { Assistant, Cobertura, CoberturaItem } from '../models';

export const extractCoberturaItems = async (
  location: string,
  options?: {
    cwd?: string;

    silent?: boolean;
    all?: boolean;

    target?: number;
    limit?: number;

    ignore?: string[];
    paths?: string[];
  }
): Promise<CoberturaItem[]> => {
  const cwd = options?.cwd ?? process.cwd();
  const paths = options?.paths?.map((nested) => path.join(cwd, nested)) ?? [];

  const target = options?.target ?? 1;
  const cobertura = await Cobertura.build(location);

  if (options?.all) {
    paths.forEach((nested) =>
      cobertura.items.some((item) => item.path === nested)
        ? null
        : cobertura.items.push(CoberturaItem.build(nested))
    );
  }

  const filtered = cobertura.items.filter((item) => {
    if (item.rate >= target) {
      return false;
    }
    if (path.parse(item.path).name.endsWith('.spec')) {
      return false;
    }
    if (paths.length && !paths.some((nested) => item.path === nested)) {
      return false;
    }
    if (options?.ignore?.length && options.ignore.some((pattern) => minimatch(item.path, pattern))) {
      return false;
    }

    return true;
  });

  filtered.forEach((item) => item.assign({ path: path.relative(cwd, item.path) }));

  const separated = filtered.reduce<{
    modules: CoberturaItem[];
    indexes: CoberturaItem[];
  }>((acc, item) => {
    path.parse(item.path).name === 'index'
      ? acc.indexes.push(item)
      : acc.modules.push(item);

    return acc;
  }, { indexes: [], modules: [] });

  return [
    ...separated.modules.sort((a, b) => a.rate - b.rate),
    ...separated.indexes.sort((a, b) => a.rate - b.rate),
  ].slice(0, options?.limit ?? Infinity);
};

export const extractIgnoredPaths = async (cwd: string): Promise<string[]> => {
  const raw = await fs.readFile(path.join(cwd, '.unitignore'), 'utf8').catch(() => null);
  return raw?.split('\n').map((segment) => segment.trim()).filter(Boolean) ?? [];
};

export const buildRenderer = () => {
  const terminal = new Readline(process.stdout);
  const cursor = cursorPosition.sync();

  return (assistants: Assistant[]) => {
    terminal.cursorTo(0, cursor.row - 1).clearScreenDown().commit();

    console.log(`model: ${assistants[0]?.context.provider.name}`);
    console.log('');

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
