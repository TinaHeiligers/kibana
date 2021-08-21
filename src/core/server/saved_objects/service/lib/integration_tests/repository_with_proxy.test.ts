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

    hapiServer.route({
      method: 'GET',
      path: '/.kibana_8.0.0/_doc/{type*}',
      options: {
        handler: (req, h) => {
          // options: https://hapi.dev/module/req.params.typeh2o2/api/?v=9.1.0#hproxyoptions
          if (req.params.type.startsWith('my_type:')) {
            // mimics a 404 'unexpected' response from the proxy
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
                // console.log('handling response', res);
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
          // options: https://hapi.dev/module/req.params.typeh2o2/api/?v=9.1.0#hproxyoptions
          if (req.params._id.startsWith('my_type:')) {
            // I could create a set of params to match against to use as the throwing handler trigger
            // mimics a 404 'unexpected' response from the proxy
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                // console.log('handling response', res);
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
          // console.log('---------------------->>catch_all path:', req.path);
          // console.log('---------------------->>catch_all method:', req.method);
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

    beforeAll(async () => {
      repository = start.savedObjects.createInternalRepository();
      myOtherType = await repository.create('my_other_type', {
        _id: '123',
        namespace: 'default',
        references: [],
        attributes: {
          title: 'my_other_type1',
        },
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

    it('handles update requests that are successful', async () => {
      const docToUpdate = await repository.create('my_other_type', {
        namespace: 'default',
        references: [],
        attributes: {
          title: 'original title',
        },
      });
      const updatedDoc = await repository.update('my_other_type', `${docToUpdate.id}`, {
        title: 'updated title',
      });
      expect(updatedDoc.type).toBe('my_other_type');
      expect(updatedDoc.attributes.title).toBe('updated title');
    });

    it('handles bulkCreate requests when the proxy relays request/responses correctly', async () => {
      proxyInterrupt = null;
      const bulkObjects = [
        {
          type: 'my_other_type',
          id: '1',
          attributes: {
            title: 'bulkType1',
          },
          references: [],
        },
        {
          type: 'my_other_type',
          id: '2',
          attributes: {
            title: 'bulkType2',
          },
          references: [],
        },
      ];
      if (proxyInterrupt === null) {
        const bulkResponse = await repository.bulkCreate(bulkObjects, { namespace: 'default' });
        expect(bulkResponse.saved_objects.length).toEqual(2);
      }
      expect(true); // force test exit.
    });

    it('returns matches from `find` when the proxy passes through the response and product header', async () => {
      proxyInterrupt = null;
      const type = 'my_other_type';
      const result = await repository.find({ type });
      expect(result.saved_objects.length).toBeGreaterThan(0);
    });
  });

  describe('requests when a proxy returns Not Found with an incorrect product header', () => {
    let repository: ISavedObjectsRepository;
    let myType: SavedObject;

    beforeAll(async () => {
      repository = start.savedObjects.createInternalRepository();
    });
    beforeEach(() => {
      proxyInterrupt = null;
    });
    afterEach(() => {
      proxyInterrupt = null;
    });

    it('returns an EsUnavailable error if the document exists but the proxy cannot find the es node (mimics allocator changes)', async () => {
      let myError;
      myType = await repository.create('my_type', {
        _id: '123',
        namespace: 'default',
        references: [],
        attributes: {
          title: 'my_type1',
        },
      });
      try {
        await repository.get('my_type', `${myType.id}`);
      } catch (err) {
        myError = err;
      }
      expect(myError.output.statusCode).toBe(503);
      expect(myError.output.payload.message).toBe(
        `x-elastic-product not present or not recognized: Saved object [my_type/${myType.id}] not found`
      );
    });

    it('returns an EsUnavailable error on `update` requests that are interrupted', async () => {
      let myError;
      const docToUpdate = await repository.create('my_type', {
        namespace: 'default',
        references: [],
        attributes: {
          title: 'original title',
        },
      });
      try {
        await repository.update('my_type', `${docToUpdate.id}`, {
          title: 'updated title',
        });
        expect(false).toBe(true); // Should not get here (we expect the call to throw)
      } catch (err) {
        myError = err;
      }
      expect(myError?.output?.statusCode).toBe(503);
      expect(myError.output.payload.message).toBe(
        'x-elastic-product not present or not recognized: Not Found'
      );
    });

    it('returns an EsUnavailable error on `bulkCreate` requests when the proxy response with 404 and the incorrect product header', async () => {
      proxyInterrupt = 'bulkCreate';
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
        await repository.bulkCreate(bulkObjects, { namespace: 'default' });
      } catch (err) {
        bulkCreateError = err;
      }
      expect(bulkCreateError?.output?.statusCode).toEqual(503);
    });

    it('returns an EsUnavailable error on `find` requests when the proxy response with 404 and the incorrect product header', async () => {
      const type = 'my_other_type';
      let findErr: any;
      try {
        proxyInterrupt = 'find';
        await repository.find({ type });
      } catch (err) {
        findErr = err;
      }
      expect(findErr?.output?.statusCode).toEqual(503);
      expect(findErr?.output?.payload?.message).toBe(
        'x-elastic-product not present or not recognized: Not Found'
      );
      expect(findErr?.output?.payload?.error).toBe('Service Unavailable');
    });
  });
});

// TODO: paths with '/.kibana_8.0.0..... Won't work for backports!
/**
 * Methods TODO:
 *  find
 *  delete
 *  resolve
 *  bulkGet
 *  openPointInTime
 *  checkConflicts
 *  deleteByNamespace
 *  optional:
 *    collectMultiNamespaceReferences
 *
 * Methods tested:
 *  get,
 *  create,
 *  update,
 *  bulkCreate
 */
