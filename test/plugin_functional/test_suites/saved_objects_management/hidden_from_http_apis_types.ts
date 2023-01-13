/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { join } from 'path';
import expect from '@kbn/expect';
import type { Response } from 'supertest';
import { SavedObject } from '@kbn/core/types';
import type { SavedObjectManagementTypeInfo } from '@kbn/saved-objects-management-plugin/common/types';
import type { PluginFunctionalProviderContext } from '../../services';

function parseNdJson(input: string): Array<SavedObject<any>> {
  return input.split('\n').map((str) => JSON.parse(str));
}

export default function ({ getService }: PluginFunctionalProviderContext) {
  const supertest = getService('supertest');
  const esArchiver = getService('esArchiver');

  describe('types with `hiddenFromHttpApis` ', () => {
    before(async () => {
      await esArchiver.load(
        'test/functional/fixtures/es_archiver/saved_objects_management/hidden_from_http_apis'
      );
    });

    after(async () => {
      await esArchiver.unload(
        'test/functional/fixtures/es_archiver/saved_objects_management/hidden_from_http_apis'
      );
    });

    describe('export', () => {
      it('allows to export them directly by id', async () => {
        await supertest
          .post('/api/saved_objects/_export')
          .set('kbn-xsrf', 'true')
          .send({
            objects: [
              {
                type: 'test-hidden-from-http-apis-importable-exportable',
                id: 'obj-1',
              },
            ],
            excludeExportDetails: true,
          })
          .expect(200)
          .then((resp) => {
            const objects = parseNdJson(resp.text);
            expect(objects.map((obj) => obj.id)).to.eql(['obj-1']);
          });
      });

      it('allows to export them directly by type', async () => {
        await supertest
          .post('/api/saved_objects/_export')
          .set('kbn-xsrf', 'true')
          .send({
            type: ['test-hidden-from-http-apis-importable-exportable'],
            excludeExportDetails: true,
          })
          .expect(200)
          .then((resp) => {
            const objects = parseNdJson(resp.text);
            expect(objects.map((obj) => obj.id)).to.eql(['obj-1']);
          });
      });
    });

    describe('import', () => {
      it('allows to import them', async () => {
        await supertest
          .post('/api/saved_objects/_import')
          .set('kbn-xsrf', 'true')
          .attach('file', join(__dirname, './exports/_import_hidden_from_http_apis.ndjson'))
          .expect(200)
          .then((resp) => {
            expect(resp.body).to.eql({
              success: true,
              successCount: 1,
              successResults: [
                {
                  id: 'ba3013c0-9eta-11e7-ahb3-3dcb95219fab',
                  meta: {
                    title:
                      'Saved object type that is hidden from the http apis visible in management',
                  },
                  type: 'test-hidden-from-http-apis-importable-exportable',
                },
              ],
              warnings: [],
            });
          });
      });
    });

    describe('savedObjects management APIS', () => {
      describe('GET /api/kibana/management/saved_objects/_allowed_types', () => {
        let types: SavedObjectManagementTypeInfo[];

        before(async () => {
          await supertest
            .get('/api/kibana/management/saved_objects/_allowed_types')
            .set('kbn-xsrf', 'true')
            .expect(200)
            .then((response: Response) => {
              types = response.body.types as SavedObjectManagementTypeInfo[];
            });
        });

        it('should only return types that are `visibleInManagement: true`', () => {
          const typeNames = types.map((type) => type.name);

          expect(typeNames.includes('test-hidden-from-http-apis-importable-exportable')).to.eql(
            true
          );
        });
      });
    });
  });
}
