import * as typescript from 'recast/parsers/typescript';
import * as babel from 'recast/parsers/babel-ts';
import _ from 'lodash';

import { namedTypes } from 'ast-types';
import * as recast from 'recast';

import { cast } from '../utils';
import { File } from './file';

import env from '../env';

interface ISpecTest {
  title: string;
  content: string;
}

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

  public tests: ISpecTest[] = [];

  public parse(): this {
    const nodes = this.extractAstNodes();

    const { imports, helpers } = nodes.reduce((acc, node) => {
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
    }, {
      imports: cast<string[]>([]),
      helpers: cast<string[]>([]),
    });

    this.tests = this.extractTests(nodes);

    this.imports = imports;
    this.helpers = helpers;

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

  public replace(source: string, target: string): this {
    this.content = this.content.split(source).join(target);
    return this;
  }

  private extractAstNodes(): TAstNode[] {
    try {
      const ast = recast.parse(this.content, { parser: ['js', 'ts'].includes(this.lang) ? typescript : babel });
      return ast.program.body;
    } catch(error) {
      return [];
    }
  }

  private extractTests(nodes: TAstNode[], prefix: string = ''): ISpecTest[] {
    return nodes
      .filter((node) => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression')
      .reduce<ISpecTest[]>((acc, node) => {
        const { expression } = <namedTypes.ExpressionStatement>node;
        const name = _.get(expression, 'callee.name');

        if (name === 'it' || name === 'test') {
          const title = _.get(expression, 'arguments')[0];
          const value = _.get(title, 'value', '');

          acc.push({
            title: prefix ? `${prefix}.${value}` : value,
            content: recast.print(node).code.replace(`${env.marker}\n`, ''),
          });
        }

        if (name === 'describe') {
          const [title, content] = _.get(expression, 'arguments');

          const value = _.get(title, 'value', '');
          const body = _.get(content, 'body.body');

          if (Array.isArray(body)) {
            acc.push(...this.extractTests(body, prefix ? `${prefix}.${value}` : value));
          }
        }

      return acc;
      }, []);
  }

  static async build(location: string): Promise<Spec> {
    const file = await File.build(location);
    const cobertura = new Spec(file);

    return cobertura.parse();
  }
}
