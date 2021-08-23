/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import Hapi from '@hapi/hapi';
import h2o2 from '@hapi/h2o2';
import { URL } from 'url';
import { InternalCoreSetup, InternalCoreStart } from '../../../../internal_types';
import { Root } from '../../../../root';
import * as kbnTestServer from '../../../../../test_helpers/kbn_server';
import { ISavedObjectsRepository } from '../repository';
import { SavedObject } from '../../../types';

let esServer: kbnTestServer.TestElasticsearchUtils;

const defaultProxyOptions = (hostname: string, port: number | string) => ({
  host: hostname,
  port,
  protocol: 'http' as 'http',
  passThrough: true,
});
const relayHandler = (h: Hapi.ResponseToolkit, hostname: string, port: number | string) => {
  return h.proxy({ ...defaultProxyOptions(hostname, port) });
};

const registerSOTypes = (setup: InternalCoreSetup) => {
  setup.savedObjects.registerType({
    name: 'my_type',
    hidden: false,
    mappings: {
      dynamic: false,
      properties: {
        title: { type: 'text' },
      },
    },
    namespaceType: 'single',
  });
  setup.savedObjects.registerType({
    name: 'my_other_type',
    hidden: false,
    mappings: {
      dynamic: false,
      properties: {
        title: { type: 'text' },
      },
    },
    namespaceType: 'single',
  });
};
let proxyInterrupt: string | null | undefined = null;

describe('404s from proxies', () => {
  let root: Root;
  let start: InternalCoreStart;
  let hapiServer: Hapi.Server;

  beforeAll(async () => {
    proxyInterrupt = null;
    const { startES } = kbnTestServer.createTestServers({
      adjustTimeout: (t: number) => jest.setTimeout(t),
    });
    esServer = await startES();
    // const { hosts, stop: stopES } = await startES();
    const esUrl = new URL(esServer.hosts[0]);
    // For the proxy, use a port number that is 100 higher than the one that the actual ES instance is using
    const proxyPort = parseInt(esUrl.port, 10) + 100;
    // Setup custom hapi hapiServer with h2o2 plugin for proxying
    hapiServer = Hapi.server({
      port: proxyPort,
    });
    await hapiServer.register(h2o2);

    // register routes, specific ones to modify the response and a catch-all to relay the request/response

    // GET /.kibana_8.0.0/_doc/{type*} route (repository.get calls)
    hapiServer.route({
      method: 'GET',
      path: '/.kibana_8.0.0/_doc/{type*}',
      options: {
        handler: (req, h) => {
          // mimics a 404 'unexpected' response from the proxy for specific docs
          if (req.params.type === 'my_type:myTypeId1' || req.params.type === 'my_type:myType_123') {
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true }) // changes the product header
                  .code(404); // specifically return not found
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });

    // DELETE /.kibana_8.0.0/_doc/{type*} route (repository.delete calls)
    hapiServer.route({
      method: 'DELETE',
      path: '/.kibana_8.0.0/_doc/{_id*}',
      options: {
        payload: {
          output: 'data',
          parse: false,
        },
        handler: (req, h) => {
          // mimic a not found from proxy
          if (req.params._id === 'my_type:myTypeId1') {
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true }) // changes the product header
                  .code(404); // specifically return not found
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });

    // POST _bulk route
    hapiServer.route({
      method: 'POST',
      path: '/_bulk',
      options: {
        payload: {
          output: 'data',
          parse: false,
        },
        handler: (req, h) => {
          if (proxyInterrupt === 'bulkCreate') {
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true }) // changes the product header
                  .code(404); // returning 404 throws the 404 from the repository call
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });

    // POST _mget route (repository.bulkGet calls)
    hapiServer.route({
      method: 'POST',
      path: '/_mget',
      options: {
        payload: {
          output: 'data',
          parse: false,
        },
        handler: (req, h) => {
          if (proxyInterrupt === 'bulkGetMyType' || proxyInterrupt === 'checkConficts') {
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true }) // changes the product header
                  .code(404); // returning 404 throws the 404 from the repository call
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });
    // GET _search route
    hapiServer.route({
      method: 'GET',
      path: '/.kibana_8.0.0/_search',
      options: {
        handler: (req, h) => {
          const payload = req.payload;
          if (!payload) {
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true })
                  .code(404);
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });
    // POST _search route (`find` calls)
    hapiServer.route({
      method: 'POST',
      path: '/.kibana_8.0.0/_search',
      options: {
        payload: {
          output: 'data',
          parse: false,
        },
        handler: (req, h) => {
          if (proxyInterrupt === 'find') {
            // TODO: improve on this
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true })
                  .code(404);
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });
    // POST _update
    hapiServer.route({
      method: 'POST',
      path: '/.kibana_8.0.0/_update/{_id*}', // I only want to match on part of a param
      options: {
        payload: {
          output: 'data',
          parse: false,
        },
        handler: (req, h) => {
          // mimics a 404 'unexpected' response from the proxy
          if (req.params._id === 'my_type:myTypeToUpdate') {
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true }) // changes the product header
                  .code(404); // returning 404 throws the 404 from the repository call
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });
    // POST _pit
    hapiServer.route({
      method: 'POST',
      path: '/.kibana_8.0.0/_pit',
      options: {
        payload: {
          output: 'data',
          parse: false,
        },
        handler: (req, h) => {
          // mimics a 404 'unexpected' response from the proxy
          if (proxyInterrupt === 'openPit') {
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true }) // changes the product header
                  .code(404); // returning 404 throws the 404 from the repository call
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });
    // catch-all passthrough route
    hapiServer.route({
      method: '*',
      path: '/{any*}',
      options: {
        payload: {
          output: 'data',
          parse: false,
        },
        handler: (req, h) => {
          return relayHandler(h, esUrl.hostname, esUrl.port);
        },
      },
    });

    await hapiServer.start(); // start ES with proxy

    // Setup kibana configured to use proxy as ES backend
    root = kbnTestServer.createRootWithCorePlugins({
      elasticsearch: { hosts: [`http://${esUrl.hostname}:${proxyPort}`] },
      migrations: {
        skip: false,
      },
    });
    await root.preboot();
    const setup = await root.setup();
    registerSOTypes(setup);

    start = await root.start();
  });

  afterAll(async () => {
    if (root) {
      await root.shutdown();
    }
    if (hapiServer) {
      await hapiServer.stop({ timeout: 1000 });
    }
    if (esServer) {
      await esServer.stop();
    }
  });
  // my_other_type test (proxy relays request/response as is)
  describe('requests when a proxy relays request/responses with the correct product header', () => {
    let repository: ISavedObjectsRepository;
    let myOtherType: SavedObject;
    const myOtherTypeDocs: SavedObject[] = [];

    beforeAll(async () => {
      repository = start.savedObjects.createInternalRepository();

      myOtherType = await repository.create(
        'my_other_type',
        { title: 'my_other_type1' },
        { overwrite: false, references: [] }
      );
      for (let i = 1; i < 11; i++) {
        myOtherTypeDocs.push({
          type: 'my_other_type',
          id: `myOtherTypeId${i}`,
          attributes: { title: `MyOtherTypeTitle${i}` },
          references: [],
        });
      }
      await repository.bulkCreate(myOtherTypeDocs, {
        overwrite: true,
        namespace: 'default',
      });
    });
    beforeEach(() => {
      proxyInterrupt = null;
    });

    it('does not alter a Not Found response if the document does not exist and the proxy returns the correct product header', async () => {
      let customErr: any;
      try {
        await repository.get('my_other_type', '123');
      } catch (err) {
        customErr = err;
      }
      expect(customErr?.output?.statusCode).toBe(404);
      expect(customErr.output.payload.message).toBe('Saved object [my_other_type/123] not found');
    });

    it('returns a document if it exists and if the proxy passes through the product header', async () => {
      const myOtherTypeDoc = await repository.get('my_other_type', `${myOtherType.id}`); // document exists and proxy passes the response through unmodified
      expect(myOtherTypeDoc.type).toBe('my_other_type');
    });

    it('handles `update` requests that are successful', async () => {
      const docToUpdate = await repository.create(
        'my_other_type',
        { title: 'original title' },
        { overwrite: false, references: [] }
      );

      const updatedDoc = await repository.update('my_other_type', `${docToUpdate.id}`, {
        title: 'updated title',
      });
      expect(updatedDoc.type).toBe('my_other_type');
      expect(updatedDoc.attributes.title).toBe('updated title');
    });

    it('handles `bulkCreate` requests when the proxy relays request/responses correctly', async () => {
      const bulkObjects = [
        {
          type: 'my_other_type',
          id: 'my_other_type1',
          attributes: {
            title: 'bulkType1',
          },
          references: [],
        },
        {
          type: 'my_other_type',
          id: 'my_other_type2',
          attributes: {
            title: 'bulkType2',
          },
          references: [],
        },
      ];
      if (proxyInterrupt === null) {
        const bulkResponse = await repository.bulkCreate(bulkObjects, {
          namespace: 'default',
          overwrite: true,
        });
        expect(bulkResponse.saved_objects.length).toEqual(2);
      }
      expect(true); // force test exit.
    });

    it('returns matches from `find` when the proxy passes through the response and product header', async () => {
      const type = 'my_other_type';
      const result = await repository.find({ type });
      expect(result.saved_objects.length).toBeGreaterThan(0);
    });

    it('handles `delete` requests that are successful', async () => {
      let deleteErr: any;
      const docToDelete = await repository.create(
        'my_other_type',
        { title: 'delete me please' },
        { id: 'docToDelete1', overwrite: true, references: [] }
      );
      const deleteResult = await repository.delete('my_other_type', 'docToDelete1', {
        namespace: 'default',
      });
      expect(deleteResult).toStrictEqual({});
      try {
        await repository.get('my_other_type', 'docToDelete1');
      } catch (err) {
        deleteErr = err;
      }
      expect(deleteErr?.output?.statusCode).toBe(404);
      expect(deleteErr?.output?.payload?.message).toBe(
        `Saved object [my_other_type/${docToDelete.id}] not found`
      );
    });

    it('handles `bulkGet` requests that are successful when the proxy passes through the product header', async () => {
      const docsToGet = myOtherTypeDocs;
      const docsFound = await repository.bulkGet(
        docsToGet.map((doc) => ({ id: doc.id, type: 'my_other_type' }))
      );
      expect(docsFound.saved_objects.length).toBeGreaterThan(0);
    });

    it('handles `resolve` requests that are successful with an exact match', async () => {
      const resolvedExactMatch = await repository.resolve('my_other_type', `${myOtherType.id}`);
      expect(resolvedExactMatch.outcome).toBe('exactMatch');
    });

    it('handles `openPointInTime` requests when the proxy passes through the product header', async () => {
      const openPitResult = await repository.openPointInTimeForType('my_other_type');
      expect(Object.keys(openPitResult)).toContain('id');
    });

    it('handles `checkConflicts` requests that are successful when the proxy passes through the product header', async () => {
      const checkConflictsResult = await repository.checkConflicts(
        [
          { id: myOtherTypeDocs[0].id, type: myOtherTypeDocs[0].type },
          { id: 'myOtherType456', type: 'my_other_type' },
        ],
        { namespace: 'default' }
      );
      expect(checkConflictsResult.errors.length).toEqual(1);
      expect(checkConflictsResult.errors[0].error.error).toStrictEqual('Conflict');
    });
  });

  describe('requests when a proxy returns Not Found with an incorrect product header', () => {
    let repository: ISavedObjectsRepository;
    const myTypeDocs: SavedObject[] = [];

    const genericNotFoundEsUnavailableError = (err: any, type?: string, id?: string) => {
      expect(err?.output?.statusCode).toBe(503);
      if (type && id) {
        expect(err?.output?.payload?.message).toBe(
          `x-elastic-product not present or not recognized: Saved object [${type}/${id}] not found`
        );
      } else {
        expect(err?.output?.payload?.message).toBe(
          `x-elastic-product not present or not recognized: Not Found`
        );
      }
    };

    beforeAll(async () => {
      repository = start.savedObjects.createInternalRepository();
      proxyInterrupt = null; // allow creation of docs to test against
      for (let i = 1; i < 11; i++) {
        myTypeDocs.push({
          type: 'my_type',
          id: `myTypeId${i}`,
          attributes: { title: `MyTypeTitle${i}` },
          references: [],
        });
      }
      await repository.bulkCreate(
        [
          ...myTypeDocs,
          {
            type: 'my_type',
            id: 'myTypeToUpdate',
            attributes: { title: 'myTypeToUpdateTitle' },
            references: [],
          },
        ],
        {
          overwrite: true,
          namespace: 'default',
        }
      );
    });
    beforeEach(() => {
      proxyInterrupt = null;
    });

    it('returns an EsUnavailable error if the document exists but the proxy cannot find the es node (mimics allocator changes)', async () => {
      let myError;
      try {
        await repository.get('my_type', 'myTypeId1');
      } catch (err) {
        myError = err;
      }
      expect(genericNotFoundEsUnavailableError(myError, 'my_type', 'myTypeId1'));
    });

    it('returns an EsUnavailable error on `update` requests that are interrupted', async () => {
      let updateError;
      try {
        await repository.update('my_type', 'myTypeToUpdate', {
          title: 'updated title',
        });
        expect(false).toBe(true); // Should not get here (we expect the call to throw)
      } catch (err) {
        updateError = err;
      }
      expect(genericNotFoundEsUnavailableError(updateError));
    });

    it('returns an EsUnavailable error on `bulkCreate` requests with a 404 proxy response and wrong product header', async () => {
      proxyInterrupt = 'bulkCreate'; // specify the handler proxy that returns 404
      let bulkCreateError: any;
      const bulkObjects = [
        {
          type: 'my_type',
          id: '1',
          attributes: {
            title: 'bulkType1',
          },
          references: [],
        },
        {
          type: 'my_type',
          id: '2',
          attributes: {
            title: 'bulkType2',
          },
          references: [],
        },
      ];
      try {
        await repository.bulkCreate(bulkObjects, { namespace: 'default', overwrite: true });
      } catch (err) {
        bulkCreateError = err;
      }
      expect(genericNotFoundEsUnavailableError(bulkCreateError));
    });

    it('returns an EsUnavailable error on `find` requests with a 404 proxy response and wrong product header', async () => {
      proxyInterrupt = 'find';
      let findErr: any;
      try {
        await repository.find({ type: 'my_type' });
      } catch (err) {
        findErr = err;
      }
      expect(genericNotFoundEsUnavailableError(findErr));
      expect(findErr?.output?.payload?.error).toBe('Service Unavailable');
    });

    it('returns an EsUnavailable error on `delete` requests with a 404 proxy response and wrong product header', async () => {
      let deleteErr: any;
      try {
        await repository.delete('my_type', 'myTypeId1', { namespace: 'default' });
      } catch (err) {
        deleteErr = err;
      }
      expect(genericNotFoundEsUnavailableError(deleteErr, 'my_type', 'myTypeId1'));
    });

    it('returns an EsUnavailable error on `resolve` requests with a 404 proxy response and wrong product header for an exact match', async () => {
      let testResolveErr: any;
      try {
        await repository.resolve('my_type', 'myTypeId1');
      } catch (err) {
        testResolveErr = err;
      }
      expect(genericNotFoundEsUnavailableError(testResolveErr, 'my_type', 'myTypeId1'));
    });

    it('returns an EsUnavailable error on `bulkGet` requests with a 404 proxy response and wrong product header', async () => {
      const docsToGet = myTypeDocs;
      let bulkGetError: any;
      proxyInterrupt = 'bulkGetMyType';
      try {
        await repository.bulkGet(docsToGet.map((doc) => ({ id: doc.id, type: 'my_type' })));
      } catch (err) {
        bulkGetError = err;
      }
      expect(genericNotFoundEsUnavailableError(bulkGetError));
    });

    it('returns an EsUnavailable error on `openPointInTimeForType` requests with a 404 proxy response and wrong product header', async () => {
      proxyInterrupt = 'openPit';
      let openPitErr: any;
      try {
        await repository.openPointInTimeForType('my_other_type');
      } catch (err) {
        openPitErr = err;
      }
      expect(genericNotFoundEsUnavailableError(openPitErr));
    });

    it('returns an EsUnavailable error on `checkConflicts` requests with a 404 proxy response and wrong product header', async () => {
      proxyInterrupt = 'checkConficts';
      let checkConflictsErr: any;
      try {
        await repository.checkConflicts(
          [
            { id: myTypeDocs[0].id, type: myTypeDocs[0].type },
            { id: 'myType456', type: 'my_type' },
          ],
          { namespace: 'default' }
        );
      } catch (err) {
        checkConflictsErr = err;
      }
      expect(genericNotFoundEsUnavailableError(checkConflictsErr));
    });
  });
});

// FIXUP TODO's:
// fix so register calls!
// fix create calls
// paths with '/.kibana_8.0.0..... Won't work for backports!
/**
 * Methods TODO:
 *  checkConflicts
 *  deleteByNamespace
 *  optional:
 *    collectMultiNamespaceReferences
 *  resolve:
 *    resolve exact match executed against SO's in 'default' namespace and that uses `get`. Nothing to do here
 *    retrieve alias uses `update` and we need to test the proxy 404 here

 *
 * Methods tested:
 *  get,
 *  create,
 *  update,
 *  bulkCreate
 *  find
 *  delete
 *  bulkGet
 *  openPointInTime
 */
