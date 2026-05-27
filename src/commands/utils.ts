import cursorPosition from 'get-cursor-position';
import minimatch from 'minimatch';
import path from 'path';
import fs from 'fs/promises';
import fg from 'fast-glob';
import _ from 'lodash';

import { Readline } from 'readline/promises';

import { Assistant, Cobertura, CoberturaItem, Project } from '../models';

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
  const target = options?.target ?? 1;
  const cwd = options?.cwd ?? process.cwd();

  const paths = (options?.paths?.map((nested) => path.join(cwd, nested)) ?? []).map((nested) => {
    const parsed = path.parse(nested);

    if (!parsed.ext.length && !parsed.name.endsWith('*')) {
      return path.join(nested, '*');
    }
    if (parsed.ext.length && parsed.name.endsWith('.spec')) {
      return path.join(parsed.dir, `${parsed.name.replace('.spec', '')}${parsed.ext}`);
    }

    return nested;
  });

  const cobertura = await Cobertura.build(location);
  const project = await Project.build({ cwd });

  const ignore = project.sources.ignore.concat(options?.ignore ?? []);
  const map = new Map<string, CoberturaItem>(cobertura.items.map((item) => [item.path, item]));

  const found = paths.length
    ? await fg(paths, { cwd, ignore, onlyFiles: true })
    : cobertura.items.map((item) => item.path);

  const filtered = found
    .map((nested): CoberturaItem => {
      const item = map.get(nested) ?? CoberturaItem.build(nested);
      return item.assign({ path: path.relative(cwd, item.path) });
    })
    .filter((item) => {
      const parsed = path.parse(item.path);

      if (item.rate >= target) {
        return false;
      }
      if (parsed.ext !== '.ts' && parsed.ext !== '.js') {
        return false;
      }
      if (parsed.name.endsWith('.spec')) {
        return false;
      }
      if (options?.ignore?.length && options.ignore.some((pattern) => minimatch(item.path, pattern))) {
        return false;
      }
      if (ignore.some((pattern) => minimatch(item.path, pattern))) {
        return false;
      }

      return true;
    });

  return _.sortBy(filtered, ['path']).slice(0, options?.limit ?? Infinity);
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

    console.log(`model: ${assistants[0]?.context.provider.model}`);
    console.log('');

    console.table(
      assistants.map((assistant) => ({
        file: assistant.source.code.path,
        rate: assistant.source.cobertura.rate,
        target: assistant.source.target,

        iteration: assistant.steps.length,
        strategy: assistant.state.strategy,

        action: assistant.is(['COMPLETED'])
          ? '✓'
          : assistant.state.action
            ? `${assistant.state.action.status === 'OK' ? '✓' : '✗'} ${assistant.state.action.message}`
            : '⏱',

        spent: Number((assistant.calculateTimeSpent() / 1000).toFixed(3)),
      }))
    );
  };
};
