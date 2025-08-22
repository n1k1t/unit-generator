import { v4 as genUid } from 'uuid';
import { spawn } from 'child_process';

import path from 'path';
import fs from 'fs/promises';

import { IAssistantSourceSnapshot, TAssistantSourceTestResult } from './types';
import { Cobertura } from '../cobertura';
import { cast } from '../../utils';
import { File } from '../file';
import { Spec } from '../spec';

import env from '../../env';

export class AssistantSource {
  public id: string = this.provided.id ?? genUid();
  public status = cast<'PASSED' | 'FAILED' | 'PENDING'>('PENDING');

  public cobertura: Cobertura = this.provided.cobertura;
  public temp: string = this.provided.temp;

  public code: File = this.provided.code;
  public spec: Spec = this.provided.spec;

  public timestamp = Date.now();
  public iteration = 0;

  public target = this.provided?.target ?? env.target;
  private saved: IAssistantSourceSnapshot | null = null;

  constructor(private provided: Pick<AssistantSource, 'id' | 'code' | 'spec' | 'cobertura' | 'temp'> & {
    target?: number;
  }) {}

  public checkHasReachedCoverage(): boolean {
    return this.cobertura.rate >= this.target;
  }

  public compileSnapshot(): IAssistantSourceSnapshot {
    return {
      cobertura: { uncovered: this.cobertura.uncovered, rate: this.cobertura.rate },
      spec: { content: this.spec.content },
    };
  }

  /** Saves current current state snapshot */
  public save(): this {
    return Object.assign(this, { saved: this.compileSnapshot() });
  }

  /** Restores latest/provided state snapshot */
  public async restore(provided?: IAssistantSourceSnapshot): Promise<this> {
    const snapshot = provided ?? this.saved;
    if (!snapshot) {
      return this;
    }

    this.cobertura.assign(snapshot.cobertura);
    await this.spec.write(snapshot.spec.content);

    return this;
  }

  public async test(): Promise<TAssistantSourceTestResult> {
    const stdout: string[] = [];
    const spawned = spawn(
      env.command,
      [
        `-- ${this.spec.path}`,
        '--coverage --forceExit',
        `--coverageDirectory=${this.temp}`,
        `--collectCoverageFrom=${this.code.path}`,
      ],
      { shell: true }
    );

    spawned.stderr.on('data', (chunk: Buffer) => stdout.push(chunk.toString()));

    const status = await Promise.race([
      new Promise<number>((resolve, reject) => spawned.once('error', (error) => reject(error))),
      new Promise<number>((resolve) => spawned.once('exit', (code) => resolve(code ?? 1))),
    ]);

    await this.cobertura.refresh();
    return status !== 0 ? { status: 'FAILED', message: stdout.join('') } : { status: 'PASSED' };
  }

  static async build(location: string, options?: {
    cwd?: string;
    rate?: number;
    target?: number;
  }): Promise<AssistantSource> {
    const id = genUid();
    const cwd = options?.cwd ?? process.cwd();

    const parsed = path.parse(location);
    const temp = path.join(path.relative(cwd, path.join(__dirname, '../../')), 'generated', id);

    if (!(await fs.stat(temp).catch(() => null))) {
      await fs.mkdir(temp);
    }

    const code = await File.build(location);
    const spec = await Spec.build(path.join(parsed.dir, `${parsed.name}.spec${parsed.ext}`));

    const cobertura = await Cobertura.build(path.join(temp, 'cobertura-coverage.xml'));
    const source = new AssistantSource({ id, temp, code, spec, cobertura, target: options?.target });

    if (options?.rate !== undefined) {
      cobertura.assign({ rate: options.rate });
    }

    return source;
  }
}
