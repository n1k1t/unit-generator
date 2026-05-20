import json2md, { DataObject } from 'json2md';

import { Content } from './model';
import { cast } from '../../../utils';

export class ArticleContent extends Content<'article', {
  title: string;
  content: DataObject[] | Content[];

  /** Markdown tag for the title (`h3` default) */
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'b';
}> {
  public render(): string {
    const tag = this.payload.tag ?? 'h3';
    const content = this.payload.content.map((nested): DataObject =>
      nested instanceof Content ? { plain: nested.render() } : nested
    );

    return json2md(
      cast<DataObject[]>([{ [tag]: this.payload.title }, ...content])
    ).trim();
  }

  static build(payload: ArticleContent['TSchema']): ArticleContent {
    return new ArticleContent('article', payload);
  }
}
