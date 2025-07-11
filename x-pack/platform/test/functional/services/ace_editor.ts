/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { FtrProviderContext } from '../ftr_provider_context';

export function AceEditorProvider({ getService }: FtrProviderContext) {
  const testSubjects = getService('testSubjects');
  const find = getService('find');
  const retry = getService('retry');

  // see https://w3c.github.io/webdriver/webdriver-spec.html#keyboard-actions
  const CTRL_KEY = '\uE009';
  const CMD_KEY = '\uE03D';
  const BKSP_KEY = '\uE003';

  return new (class AceEditorService {
    async setValue(testSubjectSelector: string, value: string | string[]) {
      await retry.try(async () => {
        const container = await testSubjects.find(testSubjectSelector);
        await container.click();
        const input = await find.activeElement();

        const modifier = process.platform === 'darwin' ? CMD_KEY : CTRL_KEY;
        await input.type([modifier, 'a']); // select all
        await input.type([BKSP_KEY]); // delete current content
        await input.type(value);
      });
    }

    async getValue(testSubjectSelector: string) {
      return await retry.try(async () => {
        const editor = await testSubjects.find(testSubjectSelector);
        const lines = await editor.findAllByClassName('ace_line');
        const linesText = await Promise.all(lines.map((line) => line.getVisibleText()));
        return linesText.join('\n');
      });
    }

    async hasParseErrors(testSubjectSelector: string) {
      return await retry.try(async () => {
        const editor = await testSubjects.find(testSubjectSelector);
        const errors = await editor.findAllByClassName('ace_error');
        return errors.length !== 0;
      });
    }
  })();
}
