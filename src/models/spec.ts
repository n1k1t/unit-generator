import * as typescript from 'recast/parsers/typescript';
import * as babel from 'recast/parsers/babel-ts';
import _ from 'lodash';

import { namedTypes } from 'ast-types';
import * as recast from 'recast';

import { cast } from '../utils';
import { File } from './file';

type TAstNode =
  | namedTypes.ExpressionStatement
  | namedTypes.FunctionDeclaration
  | namedTypes.VariableDeclaration
  | namedTypes.ClassDeclaration
  | namedTypes.VariableDeclaration
  | namedTypes.ImportDeclaration;

export class Spec extends File {
  public imports: string[] = [];
  public helpers: string[] = [];

  public parse(): this {
    const { imports, helpers } = this.extractAstNodes().reduce((acc, node) => {
      if (node.type === 'ExpressionStatement') {
        return acc;
      }

      if (node.type === 'ImportDeclaration') {
        acc.imports.push(recast.print(node).code);
        return acc;
      }
      if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
        acc.helpers.push(recast.print(node).code);
        return acc;
      }

      if (node.type === 'VariableDeclaration') {
        const declarator = node.declarations.find((nested) => nested.type === 'VariableDeclarator');

        declarator?.init?.type === 'CallExpression' && _.get(declarator.init.callee, 'name') === 'require'
          ? acc.imports.push(recast.print(node).code)
          : acc.helpers.push(recast.print(node).code);
      }

      return acc;
    }, { imports: cast<string[]>([]), helpers: cast<string[]>([]) });

    return Object.assign(this, { imports, helpers });
  }

  public async write(content?: string): Promise<void> {
    await super.write(content);
    this.parse();
  }

  public async refresh(): Promise<void> {
    await super.refresh();
    this.parse();
  }

  private extractAstNodes(): TAstNode[] {
    try {
      const ast = recast.parse(this.content, { parser: ['js', 'ts'].includes(this.lang) ? typescript : babel });
      return ast.program.body;
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
