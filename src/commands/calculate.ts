import { exec } from 'child_process';

import { Cobertura } from '../models';
import env from '../env';

export default async () => {
  await new Promise<void>((resolve, reject) =>
    exec(`${env.command} -- --coverage --forceExit --silent --workerThreads`, (error) =>
      error ? reject(error) : resolve()
    )
  );

  const cobertura = await Cobertura.build(env.cobertura);
  console.table([{ rate: cobertura.rate, updated: new Date(cobertura.timestamp).toLocaleString() }]);
}
