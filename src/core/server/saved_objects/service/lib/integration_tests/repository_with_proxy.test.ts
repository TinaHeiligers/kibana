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
    hidden: false,
    mappings: {
      dynamic: false,
      properties: {
        title: { type: 'text' },
      },
    },
    name: 'my_type',
    namespaceType: 'single',
  });
  setup.savedObjects.registerType({
    hidden: false,
    mappings: {
      dynamic: false,
      properties: {
        title: { type: 'text' },
      },
    },
    name: 'my_other_type',
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
      method: '*',
      path: '/{any*}',
      options: {
        payload: {
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
    await root.shutdown();
    await hapiServer.stop();
    await esServer.stop();
  });
  it('returns unavailable errors', async () => {
    // Get a saved object repository
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
      const myOtherType = await repository.create('my_other_type', {
        _id: '456',
        namespace: 'default',
        references: [],
        attributes: {
          title: 'my_other_type1',
        },
      });
      if (myType && myOtherType) {
        expect(myOtherType.type).toBe('my_other_type');
        const docMyothertype = await repository.get('my_other_type', `${myOtherType.id}`); // document exists and proxy passes the response through unmodified
        expect(docMyothertype.type).toBe('my_other_type');

        await repository.get('my_type', '123'); // document doesn't exist and the proxy modifies the response header
      }
    } catch (err) {
      expect(err.output.statusCode).toBe(503);
      expect(err.output.payload.message).toBe(
        'x-elastic-product not present or not recognized: Saved object [my_type/123] not found'
      );
    }
  });
  // my_other_type test
  it.todo(
    'does not alter a Not Found response if the document does not exist and the proxy returns the correct product header'
  );
  // my_type test
  it.todo(
    'returns an EsUnavailable error if the document does not exist and the proxy modifies the product header'
  );
});
