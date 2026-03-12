import fs from 'fs/promises';

import { tool } from 'ai';
import { z } from 'zod';

export default () => tool({
  description: 'Read the contents of a file',

  inputSchema: z.object({
    path: z.string().describe('The path to the file to read'),

    start: z.number().optional().describe('The line number to start reading from (1-indexed)'),
    end: z.number().optional().describe('The line number to end reading at (inclusive)'),
  }),

  execute: async ({ path, start, end }) => {
    try {
      const content = await fs.readFile(path, 'utf-8');

      if (start === undefined && end === undefined) {
        return {
          content,
        };
      }

      const lines = content.split('\n');
      const sliced = lines.slice(
        start ? start - 1 : 0,
        end ? end : lines.length,
      );

      return {
        content: sliced.join('\n'),
      };
    } catch (error: any) {
      const formatted = error instanceof Error ? error : new Error(String(error));

      return {
        error: formatted.message,
      };
    }
  },
});
