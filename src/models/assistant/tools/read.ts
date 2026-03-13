import fs from 'fs/promises';
import { z } from 'zod';

import { checkPatternIsRestricted } from './utils';
import { AssistantToolCompiler } from './model';

export default AssistantToolCompiler
  .build('Read the contents of a file')
  .input(
    z.object({
      path: z.string().describe('The path to the file to read'),

      start: z.number().optional().describe('The line number to start reading from (1-indexed)'),
      end: z.number().optional().describe('The line number to end reading at (inclusive)'),
    })
  )
  .output(
    z.union([
      z.object({
        error: z.string().describe('Error message'),
      }),

      z.object({
        content: z.string().describe('File content'),
      }),
    ])
  )
  .execute(() => async ({ path, start, end }) => {
    if (!checkPatternIsRestricted(path)) {
      return {
        error: 'Path is going to out of scope the project',
      };
    }

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
  });
