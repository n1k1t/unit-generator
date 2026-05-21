import json2md, { DataObject } from 'json2md';
import path from 'path';
import _ from 'lodash';

import { SetPartialKeys } from '../../../../types';
import { Content } from './model';
import { cast } from '../../../utils';

export class AttachmentContent extends Content<'attachment', {
  content: unknown;
  title: string;
  path: string;

  /** File extension with dot (`.json`, `.md` and etc) */
  extension: string;
  isVirtual: boolean;
}> {
  public render(): string {
    const isObject = _.isObject(this.payload.content)
    const content = isObject
      ? JSON.stringify(this.payload.content, null, 2)
      : String(this.payload.content);

    return json2md(
      cast<DataObject[]>([
        {
          h3: this.payload.title,
        },
        {
          code: {
            language: isObject ? 'json' : 'txt',
            content,
          },
        },
      ])
    ).trim();
  }

  static build(
    payload: SetPartialKeys<AttachmentContent['TSchema'], 'extension' | 'path' | 'isVirtual'>
  ): AttachmentContent {
    const extension = payload.extension ?? (
      payload.path
        ? path.extname(payload.path)
        : _.isObject(payload.content) ? '.json' : '.txt'
    );

    return new AttachmentContent('attachment', {
      extension,

      content: payload.content,
      title: payload.title,

      path: payload.path ?? `${_.kebabCase(payload.title).toLowerCase()}${extension}`,
      isVirtual: payload.isVirtual ?? !Boolean(payload.path),
    });
  }
}
