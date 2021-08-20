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

describe('404s from proxies', () => {
  let root: Root;
  let start: InternalCoreStart;
  let hapiServer: Hapi.Server;

  beforeAll(async () => {
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
    // register 2 routes, both with the same proxy
    hapiServer.route({
      method: 'GET',
      path: '/.kibana_8.0.0/_doc/{type*}', // I only want to match on part of a param
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
            // mimics a 404 'unexpected' response from the proxy
            return h.proxy({
              ...defaultProxyOptions(esUrl.hostname, esUrl.port),
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onResponse: async (err, res, request, h, settings, ttl) => {
                // console.log('handling response', res);
                const response = h
                  .response(res)
                  .header('x-elastic-product', 'somethingitshouldnotbe', { override: true }) // changes the product header
                  // .code(418); // returning teapot code causes repository to throw 500
                  .code(404); // returning 404 throws the 404 from the repository call
                // .code(200); // returning 200 catches the issue and the repository throws a 503 as expected (when the 404 status code check is removed)
                // console.log('the response from the proxy is:', response);
                return response;
              },
            });
          } else {
            return relayHandler(h, esUrl.hostname, esUrl.port);
          }
        },
      },
    });

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
      await hapiServer.stop();
    }
    if (esServer) {
      await esServer.stop();
    }
  });
  // my_other_type test
  it('does not alter a Not Found response if the document does not exist and the proxy returns the correct product header', async () => {
    const repository = start.savedObjects.createInternalRepository();
    const myOtherType = await repository.create('my_other_type', {
      _id: '123',
      namespace: 'default',
      references: [],
      attributes: {
        title: 'my_other_type1',
      },
    });
    if (myOtherType) {
      try {
        await repository.get('my_other_type', '123');
      } catch (err) {
        expect(err.output.statusCode).toBe(404);
        expect(err.output.payload.message).toBe('Saved object [my_other_type/123] not found');
      }
    }
  });
  it('returns a document if it exists and if the proxy passes through the product header', async () => {
    const repository = start.savedObjects.createInternalRepository();
    const myOtherType = await repository.create('my_other_type', {
      namespace: 'default',
      references: [],
      attributes: {
        title: 'my_other_type1',
      },
    });
    const myOtherTypeDoc = await repository.get('my_other_type', `${myOtherType.id}`); // document exists and proxy passes the response through unmodified
    expect(myOtherTypeDoc.type).toBe('my_other_type');
  });
  // my_type test
  // TODO: create a mocked Stream response using Readable.from(JSON.stringify({...SO doc}))
  // See src/core/server/elasticsearch/client/configure_client.test.ts
  it('returns an EsUnavailable error if the document exists but the proxy cannot find the es node (mimics allocator changes)', async () => {
    const repository = start.savedObjects.createInternalRepository();
    try {
      const myType = await repository.create('my_type', {
        _id: '123',
        namespace: 'default',
        references: [],
        attributes: {
          title: 'my_type1',
        },
      });
      if (myType) {
        const doc = await repository.get('my_type', `${myType.id}`); // document doesn't exist and the proxy modifies the response header -> TODO the doc should exist but the proxy cannot find the es node
      }
    } catch (err) {
      expect(err.output.statusCode).toBe(503);
      expect(err.output.payload.message).toBe(
        'x-elastic-product not present or not recognized: Not Found'
      );
    }
  });

  it('handles update requests that are successful', async () => {
    const repository = start.savedObjects.createInternalRepository();
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

  it('handles update requests that are interrupted', async () => {
    const repository = start.savedObjects.createInternalRepository();
    const docToUpdate = await repository.create('my_type', {
      namespace: 'default',
      references: [],
      attributes: {
        title: 'original title',
      },
    });

    try {
      const doc = await repository.update('my_type', `${docToUpdate.id}`, {
        title: 'updated title',
      });
      // force an error
      expect(false).toBe(true); // Should not get here
    } catch (err) {
      expect(err.output.statusCode).toBe(503);
      expect(err.output.payload.message).toBe(
        'x-elastic-product not present or not recognized: Not Found'
      );
    }
  });
});
