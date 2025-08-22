import path from 'path';
import fs from 'fs/promises';

export class File {
  public path: string = this.provided.path;
  public dir: string = path.dirname(this.path);

  public content: string = this.provided.content;
  public lang: string = this.provided.lang;

  constructor(private provided: Pick<File, 'lang' | 'path' | 'content'>) {}

  public append(content: string): this {
    if (!content.length) {
      return this;
    }

    this.content = `${this.content}\n${content}`;
    return this;
  }

  public prepend(content: string): this {
    if (!content.length) {
      return this;
    }

    this.content = `${content}\n${this.content}`;
    return this;
  }

  /** Writes content to file */
  public async write(content?: string): Promise<void> {
    if (content !== undefined) {
      this.content = content;
    }

    await fs.writeFile(this.path, this.content, 'utf8');
  }

  /** Refreshes and stores source content from file */
  public async refresh(): Promise<void> {
    this.content = await fs.readFile(this.path, 'utf8');
  }

  public async remove(): Promise<void> {
    await fs.rm(this.path);
  }

  static async build(location: string): Promise<File> {
    if (!(await fs.stat(location).catch(() => null))) {
      await fs.writeFile(location, '', 'utf8');
    }

    return new File({
      path: location,
      lang: path.extname(location).substring(1),

      content: await fs.readFile(location, 'utf8'),
    });
  }
}
