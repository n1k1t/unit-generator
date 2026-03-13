import { execSync } from 'child_process';
import { z } from 'zod';

import { checkPatternIsRestricted } from './utils';
import { AssistantToolCompiler } from './model';

export default AssistantToolCompiler
  .build('Search for a code by pattern in files')
  .input(
    z.object({
      pattern: z.string().describe('The regex pattern to search for'),
      path: z.string().optional().describe('The directory or file to search in'),

      before: z.number().optional().describe('Number of lines to show before the match'),
      after: z.number().optional().describe('Number of lines to show after the match'),
    })
  )
  .output(
    z.union([
      z.object({
        error: z.string().describe('Error message'),
      }),

      z.object({
        output: z.array(
          z.object({
            path: z.string().describe('File path'),
            content: z.string().describe('File content of the search'),
          })
        ).describe('Search results'),
      }),
    ])
  )
  .execute((source) => ({ pattern, path = '.', before, after }) => {
    if (!checkPatternIsRestricted(pattern) || !checkPatternIsRestricted(path)) {
      return {
        error: 'Pattern or path is going to out of scope the project',
      };
    }

    try {
      const args = ['-rnE'];

      if (before !== undefined) {
        args.push(`-B ${before}`);
      }
      if (after !== undefined) {
        args.push(`-A ${after}`);
      }

      if (source.ignore.length > 0) {
        const patterns = source.ignore
          .filter((pattern) => pattern.endsWith('/**'))
          .map((pattern) => pattern.replace('/**', ''));

        args.push(`--exclude-dir=${patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0] ?? ''}`);
      }

      const escaped = pattern.replace(/\(/, '\\(').replace(/\)/, '\\)');
      const output = execSync(`grep ${args.join(' ')} "${escaped}" ${path}`, { encoding: 'utf-8' });

      const results = output.split('\n').reduce<Record<string, string>>((acc, line) => {
        if (!line) {
          return acc;
        }

        const matched = line.match(/^(.+?)(:\d+:|-\d+-) (.*)$/);
        if (!matched) {
          return acc;
        }

        const [, path, separator, content] = matched;
        const concated = `${separator.replace(/-|:/g, '')}: ${content}`;

        acc[path] = acc[path]
          ? acc[path] + '\n' + concated
          : concated;

        return acc;
      }, {});

      return {
        output: Object
          .entries(results)
          .filter(([path]) => checkPatternIsRestricted(path))
          .map(([path, content]) => ({ path, content })),
      };
    } catch (error: unknown) {
      const formatted = error instanceof Error ? error : new Error(String(error));

      return {
        error: formatted.message,
      };
    }
  });
