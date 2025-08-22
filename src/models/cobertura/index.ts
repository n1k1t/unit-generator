import { XMLParser } from 'fast-xml-parser';
import _ from 'lodash';

import { ICoberturaCoverage } from './types';
import { File } from '../file';

const parser = new XMLParser({ ignoreAttributes: false });

export class CoberturaItem {
  constructor(
    public path: string,
    public rate: number = 0,
    public uncovered: number[] = []
  ) {}

  public assign(payload: Partial<Pick<CoberturaItem, 'path' | 'rate' | 'uncovered'>>): this {
    return Object.assign(this, payload);
  }

  static build(path: string, provided?: Partial<Pick<CoberturaItem, 'rate' | 'uncovered'>>): CoberturaItem {
    return new CoberturaItem(path, provided?.rate, provided?.uncovered);
  }
}

export class Cobertura extends File {
  public rate: number = 0;
  public uncovered: number[] = [];

  public timestamp: number = 0;
  public items: CoberturaItem[] = [];

  public assign(payload: Partial<Pick<Cobertura, 'rate' | 'uncovered'>>): this {
    return Object.assign(this, payload);
  }

  public parse(): this {
    const parsed: ICoberturaCoverage = parser.parse(this.content);
    const cwd = _.flatten([parsed.coverage?.sources?.source ?? []])[0] ?? '.';

    this.items = _.flatten([parsed.coverage?.packages?.package ?? []]).reduce<CoberturaItem[]>((acc, declaration) =>
      acc.concat(
        _.flatten([declaration?.classes?.class ?? []]).map((item) => {
          const rate = (Number(item['@_branch-rate']) + Number(item['@_line-rate'])) / 2;
          const uncovered = new Set<number>([
            ..._.flatten([item.lines?.line ?? []])
              .filter((line) => Number(line['@_hits']) === 0)
              .map((line) => Number(line['@_number'])),

            ..._.flatten([item.methods?.method ?? []]).reduce<number[]>(
              (lines, method) =>
                lines.concat(
                  _.flatten([method.lines?.line ?? []])
                    .filter((line) => Number(line['@_hits']) === 0)
                    .map((line) => Number(line['@_number']))
                ),
              []
            ),
          ]);

          return CoberturaItem.build(`${cwd}/${item['@_filename']}`, {
            rate: Number.isNaN(rate) ? 0 : Number(rate.toFixed(2)),
            uncovered: [...uncovered].sort((a, b) => a - b),
          });
        })
      ),
      []
    );

    this.uncovered = this.items.reduce<number[]>((acc, item) => acc.concat(item.uncovered), []);
    this.timestamp = Number(parsed.coverage?.['@_timestamp'] ?? 0);

    this.rate = this.items.length
      ? Number((this.items.reduce((acc, item) => acc + item.rate, 0) / this.items.length).toFixed(2))
      : 0;

    return this;
  }

  public async refresh(): Promise<void> {
    await super.refresh();
    this.parse();
  }

  static async build(location: string): Promise<Cobertura> {
    const file = await File.build(location);
    const cobertura = new Cobertura(file);

    return cobertura.parse();
  }
}
