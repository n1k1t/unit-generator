import { exec } from 'child_process';
import path from 'path';

import { extractOverallCoverage } from '../utils';
import env from '../env';

export default async () => {
  await new Promise<void>((resolve, reject) =>
    exec(`${env.command} -- --coverage --forceExit --silent --workerThreads`, (error) =>
      error ? reject(error) : resolve()
    )
  );

  const extracted = await extractOverallCoverage(path.join(process.cwd(), env.cobertura));
  console.table([{ rate: extracted.rate, updated: extracted.timestamp.toLocaleString() }]);
}
