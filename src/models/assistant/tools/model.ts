import { FlexibleSchema, tool, Tool, ToolExecuteFunction } from 'ai';
import { AssistantSource } from '../source';

interface IAssistantToolCompilerContext {
  input: unknown;
  output: unknown;
}

export class AssistantToolCompilationError extends Error {
  constructor(public property: string) {
    super(`Cannot compile without [${property}] property`);
  }
}

export class AssistantToolCompiler<TContext extends IAssistantToolCompilerContext> {
  private executor?: (source: AssistantSource) => ToolExecuteFunction<TContext['input'], TContext['output']>;

  private schema: {
    input?: FlexibleSchema<TContext['input']>;
    output?: FlexibleSchema<TContext['output']>;
  } = {};

  constructor(public description: string) {}

  public input<T, U extends AssistantToolCompiler<{ input: T, output: TContext['output'] }>>(
    schema: FlexibleSchema<T>
  ): U {
    this.schema.input = schema;
    return <this & U>this;
  }

  public output<T, U extends AssistantToolCompiler<{ input: TContext['input'], output: T }>>(
    schema: FlexibleSchema<T>
  ): U {
    this.schema.output = schema;
    return <this & U>this;
  }

  public execute(executor: NonNullable<AssistantToolCompiler<TContext>['executor']>): this {
    this.executor = executor;
    return this;
  }

  public compile(source: AssistantSource): Tool<TContext['input'], TContext['output']> {
    if (!this.executor) {
      throw new AssistantToolCompilationError('executor');
    }

    return tool(<Tool>{
      description: this.description,
      execute: this.executor(source),

      inputSchema: this.schema.input,
      outputSchema: this.schema.output,
    });
  }

  static build<TOutput = unknown>(description: string): AssistantToolCompiler<{
    input: unknown;
    output: TOutput;
  }> {
    return new AssistantToolCompiler(description);
  }
}
