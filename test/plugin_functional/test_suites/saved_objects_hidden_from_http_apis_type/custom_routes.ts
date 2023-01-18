/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import expect from '@kbn/expect';
import type { PluginFunctionalProviderContext } from '../../services';

export default function ({ getService }: PluginFunctionalProviderContext) {
  const supertest = getService('supertest');
  const kbnServer = getService('kibanaServer');
  const esArchiver = getService('esArchiver');

  describe('delete types with `hiddenFromHttpApis` ', () => {
    before(async () => {
      // If there are any remaining saved objects registered as `hiddenFromHttpApis:true`, cleaning them up will fail.
      await kbnServer.savedObjects.cleanStandardList();

      await kbnServer.importExport.load(
        'test/functional/fixtures/kbn_archiver/saved_objects_management/hidden_from_http_apis.json'
      );
    });

    after(async () => {
      // We cannot use `kbnServer.importExport.unload` to clean up test fixtures because `unload` uses the global SOM `delete` HTTP API and that blocks requests containing hiddenFromHttpApis:true objects
      await esArchiver.unload(
        'test/functional/fixtures/es_archiver/saved_objects_management/hidden_from_http_apis'
      );
    });

    describe('custom_routes', () => {
      const hiddenFromHttpApisType1 = {
        type: 'test-hidden-from-http-apis-importable-exportable',
        id: 'hidden-from-http-apis-1',
      };
      const hiddenFromHttpApisType2 = {
        id: 'hidden-from-http-apis-2',
        type: 'test-hidden-from-http-apis-importable-exportable',
      };

      it('uses custom route to GET object', async () => {
        await supertest
          .get(
            `/api/hidden_from_http_api/${hiddenFromHttpApisType1.type}/${hiddenFromHttpApisType1.id}`
          )
          .set('kbn-xsrf', 'anything')
          .expect(200)
          .then((resp) => {
            expect(resp.body.type).to.eql(hiddenFromHttpApisType1.type);
            expect(resp.body.id).to.eql(hiddenFromHttpApisType1.id);
          });
      });

      it('uses custom route to DELETE object', async () => {
        await supertest
          .get(
            `/api/hidden_from_http_api/delete/${hiddenFromHttpApisType1.type}/${hiddenFromHttpApisType1.id}`
          )
          .set('kbn-xsrf', 'anything')
          .expect(200)
          .then((resp) => {
            expect(resp.body).to.eql({});
          });
      });

      it('uses custom route to BULK GET object', async () => {
        await supertest
          .get('/api/hidden_from_http_api/_bulk_get')
          .send([hiddenFromHttpApisType2, hiddenFromHttpApisType1])
          .set('kbn-xsrf', 'anything')
          .expect(200)
          .then((resp) => {
            expect(resp.body.saved_objects).to.have.length(1);
          });
      });

      it('allows bulk deleting objects', async () => {
        await supertest
          .get(`/api/hidden_from_http_api/_bulk_delete`)
          .set('kbn-xsrf', 'anything')
          .query({ force: false })
          .send([
            hiddenFromHttpApisType1,
            hiddenFromHttpApisType2,
            {
              id: 'not-hidden-from-http-apis-2',
              type: 'test-not-hidden-from-http-apis-importable-exportable',
            },
            {
              id: 'not-hidden-from-http-apis-1',
              type: 'test-not-hidden-from-http-apis-importable-exportable',
            },
          ])
          .expect(200)
          .then((resp) => {
            expect(resp.body.statuses.length).to.eql(4);
          });
      });
    });
  });
}
