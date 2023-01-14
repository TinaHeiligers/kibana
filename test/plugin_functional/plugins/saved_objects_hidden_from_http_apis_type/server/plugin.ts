/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { Plugin, CoreSetup } from '@kbn/core/server';

export class SavedObjectsHiddenFromHttpApisTypePlugin implements Plugin {
  public setup({ savedObjects }: CoreSetup, deps: {}) {
    // example of a SO type that not hidden but is hidden from the http apis.
    // the kbn index mapping strict issue's not allowing me to add to the index mappings using esArchiver and I get errors when trying to index a doc for this type.
    savedObjects.registerType({
      name: 'test-hidden-from-http-apis-importable-exportable',
      hidden: false,
      hiddenFromHttpApis: true,
      namespaceType: 'single',
      mappings: {
        properties: {
          title: { type: 'text' },
        },
      },
      management: {
        importableAndExportable: true,
        visibleInManagement: true,
      },
    });
  }

  public start() {}
  public stop() {}
}
