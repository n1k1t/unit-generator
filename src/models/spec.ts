import { namedTypes } from 'ast-types';

import * as typescript from 'recast/parsers/typescript';
import * as babel from 'recast/parsers/babel-ts';

import * as recast from 'recast';

import { File } from './file';

export class Spec extends File {
  public imports: string[] = [];

  public parse(): this {
    this.imports = this.extractImportNodes()
      .filter((node) => node.type === 'ImportDeclaration' || node.type === 'VariableDeclaration')
      .map((node) => {
        const { code } = recast.print(node);

        if (node.type === 'ImportDeclaration') {
          return code;
        }
        if (code.includes('require(')) {
          return code;
        }

        return '';
      })
      .filter((code) => code.length);

    return this;
  }

  public async write(content?: string): Promise<void> {
    await super.write(content);
    this.parse();
  }

  public async refresh(): Promise<void> {
    await super.refresh();
    this.parse();
  }

  private extractImportNodes(): (namedTypes.ImportDeclaration | namedTypes.VariableDeclaration)[] {
    try {
      const ast = recast.parse(this.content, { parser: ['js', 'ts'].includes(this.lang) ? typescript : babel });
      return <(namedTypes.ImportDeclaration | namedTypes.VariableDeclaration)[]>ast.program.body;
    } catch(error) {
      return [];
    }
  }

  static async build(location: string): Promise<Spec> {
    const file = await File.build(location);
    const cobertura = new Spec(file);

    return cobertura.parse();
  }
}
