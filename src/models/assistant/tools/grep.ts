import { execSync } from 'child_process';
import { tool } from 'ai';
import { z } from 'zod';

import { AssistantStrategy } from '../strategies/model';

export default (strategy: AssistantStrategy) => tool({
  description: 'Search for a code by pattern in files',

  inputSchema: z.object({
    pattern: z.string().describe('The regex pattern to search for'),
    path: z.string().optional().describe('The directory or file to search in'),

    before: z.number().optional().describe('Number of lines to show before the match'),
    after: z.number().optional().describe('Number of lines to show after the match'),
  }),

  execute: async ({ pattern, path = '.', before, after }) => {
    try {
      const args = ['-rnE'];

      if (before !== undefined) {
        args.push(`-B ${before}`);
      }
      if (after !== undefined) {
        args.push(`-A ${after}`);
      }

      if (strategy.source.ignore.length > 0) {
        const patterns = strategy.source.ignore
          .filter((pattern) => pattern.endsWith('/**'))
          .map((pattern) => pattern.replace('/**', ''));

        args.push(`--exclude-dir=${patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0] ?? ''}`);
      }

      const escaped = pattern.replace(/\(/, '\\(').replace(/\)/, '\\)');
      const output = execSync(`grep ${args.join(' ')} "${escaped}" ${path}`, { encoding: 'utf-8' });

      const results: Record<string, string> = {};

      output.split('\n').forEach((line) => {
        if (!line) {
          return null;
        }

        const matched = line.match(/^(.+?)(:\d+:|-\d+-) (.*)$/);
        if (!matched) {
          return null;
        }

        const [, path, separator, content] = matched;
        const concated = `${separator.replace(/-|:/g, '')}: ${content}`

        results[path] = results[path]
          ? results[path] + '\n' + concated
          : concated;
      });

      return {
        output: Object
          .entries(results)
          .map(([path, content]) => ({ path, content })),
      };
    } catch (error: unknown) {
      const formatted = error instanceof Error ? error : new Error(String(error));

      return {
        error: formatted.message,
      };
    }
  },
});
