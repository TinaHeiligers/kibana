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
import { EsArchiver } from '@kbn/es-archiver';
import type { PluginFunctionalProviderContext } from '../../services';

function parseNdJson(input: string): Array<SavedObject<any>> {
  return input.split('\n').map((str) => JSON.parse(str));
}

export default function ({ getService }: PluginFunctionalProviderContext) {
  const supertest = getService('supertest');
  const kbnServer = getService('kibanaServer');
  const esArchiver = getService('esArchiver');

  describe('types with `hiddenFromHttpApis` ', () => {
    before(async () => {
      // TINA todo: remove esArchiver files
      // await esArchiver.load(
      //   'test/functional/fixtures/es_archiver/saved_objects_management/hidden_from_http_apis'
      // );
      // await kbnServer.savedObjects.cleanStandardList();
      await kbnServer.importExport.load(
        'test/functional/fixtures/kbn_archiver/saved_objects_management/hidden_from_http_apis.json'
      );
    });

    after(async () => {
      await esArchiver.unload(
        'test/functional/fixtures/es_archiver/saved_objects_management/hidden_from_http_apis'
      );
      // I need some other way to clear the data. `kbnServer.importExport.unload` uses the global delete HTTP API
      // and that blocks requests containing hiddenFromHttpApis objects
      // await kbnServer.importExport.unload(
      //   'test/functional/fixtures/kbn_archiver/saved_objects_management/hidden_from_http_apis.json'
      // );
    });

    describe.only('savedObjects management APIS', () => {
      describe('_bulk_get', () => {
        describe('saved objects with hiddenFromHttpApis type', () => {
          const URL = '/api/kibana/management/saved_objects/_bulk_get';

          const hiddenFromHttpApisType = {
            type: 'test-hidden-from-http-apis-importable-exportable',
            id: 'hidden-from-http-apis-1',
          };
          const notHiddenFromHttpApisType = {
            type: 'test-not-hidden-from-http-apis-importable-exportable',
            id: 'not-hidden-from-http-apis-1',
          };

          function expectSuccess(index: number, { body }: Response) {
            const { type, id, meta, error } = body[index];
            expect(type).to.eql(notHiddenFromHttpApisType.type);
            expect(id).to.eql(notHiddenFromHttpApisType.id);
            expect(meta).to.not.equal(undefined);
            expect(error).to.equal(undefined);
          }

          function expectBadRequest(index: number, { body, badRequest, error }: Response) {
            const { status } = error;
            expect(status).to.eql(400);
            expect(error).to.eql({
              message: `Unsupported saved object type: '${hiddenFromHttpApisType.type}': Bad Request`,
              statusCode: 400,
              error: 'Bad Request',
            });
          }

          it('should return 200 for types that are not hidden from the http apis', async () =>
            await supertest
              .post(URL)
              .send([notHiddenFromHttpApisType])
              .set('kbn-xsrf', 'true')
              .expect(200)
              .then((response: Response) => {
                expect(response.body).to.have.length(1);
                const { type, id, meta, error } = response.body[0];
                expect(type).to.eql(notHiddenFromHttpApisType.type);
                expect(id).to.eql(notHiddenFromHttpApisType.id);
                expect(meta).to.not.equal(undefined);
                expect(error).to.equal(undefined);
              }));

          it('should return 200 for types that are hidden from the http apis', async () =>
            await supertest
              .post(URL)
              .send([hiddenFromHttpApisType])
              .set('kbn-xsrf', 'true')
              .expect(200)
              .then((response: Response) => {
                expect(response.body).to.have.length(1);
                const { type, id, meta, error } = response.body[0];
                expect(type).to.eql(hiddenFromHttpApisType.type);
                expect(id).to.eql(hiddenFromHttpApisType.id);
                expect(meta).to.not.equal(undefined);
                expect(error).to.equal(undefined);
              }));

          it('should return 200 for a mix of types', async () =>
            await supertest
              .post(URL)
              .send([hiddenFromHttpApisType, notHiddenFromHttpApisType])
              .set('kbn-xsrf', 'true')
              .expect(200)
              .expect(200)
              .then((response: Response) => {
                expect(response.body).to.have.length(2);
                const { type, id, meta, error } = response.body[0];
                expect(type).to.eql(hiddenFromHttpApisType.type);
                expect(id).to.eql(hiddenFromHttpApisType.id);
                expect(meta).to.not.equal(undefined);
                expect(error).to.equal(undefined);
              }));
        });
      });
    });

    describe.only('export', () => {
      const hiddenFromHttpApisType = {
        type: 'test-hidden-from-http-apis-importable-exportable',
        id: 'hidden-from-http-apis-1',
      };
      it('allows to export them directly by id', async () => {
        await supertest
          .post('/api/saved_objects/_export')
          .set('kbn-xsrf', 'true')
          .send({
            objects: [
              {
                type: 'test-hidden-from-http-apis-importable-exportable',
                id: 'hidden-from-http-apis-1',
              },
            ],
            excludeExportDetails: true,
          })
          .expect(200)
          .then((resp) => {
            const objects = parseNdJson(resp.text);
            expect(objects.map((obj) => obj.id)).to.eql(['hidden-from-http-apis-1']);
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
            expect(objects.map((obj) => obj.id)).to.eql([
              'hidden-from-http-apis-1',
              'hidden-from-http-apis-2',
            ]);
          });
      });
    });

    describe.skip('import', () => {
      it('allows to import them', async () => {
        await supertest
          .post('/api/saved_objects/_import')
          .set('kbn-xsrf', 'true')
          .attach('file', join(__dirname, './exports/_import_non_visible_in_management.ndjson'))
          .expect(200)
          .then((resp) => {
            expect(resp.body).to.eql({
              success: true,
              successCount: 1,
              successResults: [
                {
                  id: 'ff3773b0-9ate-11e7-ahb3-3dcb94193fab',
                  meta: {
                    title: 'Saved object type that is not visible in management',
                  },
                  type: 'test-not-visible-in-management',
                },
              ],
              warnings: [],
            });
          });
      });
    });
  });
}
