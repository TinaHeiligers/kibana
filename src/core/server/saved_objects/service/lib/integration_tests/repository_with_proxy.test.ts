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
import * as kbnTestServer from '../../../../../test_helpers/kbn_server';

describe('404s from proxies', () => {
  it('returns unavailable errors', async () => {
    // Create an ES instance
    const { startES } = kbnTestServer.createTestServers({
      adjustTimeout: (t: number) => jest.setTimeout(t),
    });

    const { hosts, stop: stopES } = await startES();
    const esUrl = new URL(hosts[0]);

    // For the proxy, use a port number that is 100 higher than the one that the actual ES instance is using
    const proxyPort = parseInt(esUrl.port, 10) + 100;

    // Setup custom hapi server with h2o2 plugin for proxying
    const server = Hapi.server({
      port: proxyPort,
    });
    await server.register(h2o2);
    // register 2 routes, both with the same proxy
    server.route({
      method: 'GET',
      path: '/.kibana_8.0.0/_doc/{type*}', // I only want to match on part of a param
      options: {
        handler: (req, h) => {
          // options: https://hapi.dev/module/req.params.typeh2o2/api/?v=9.1.0#hproxyoptions
          if (req.params.type.startsWith('my_type:')) {
            // mocks an 'unexpected' response from the proxy
            return h.proxy({
              host: esUrl.hostname,
              port: esUrl.port,
              protocol: 'http',
              passThrough: true,
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
            return h.proxy({
              host: esUrl.hostname,
              port: esUrl.port,
              protocol: 'http',
              passThrough: true,
            });
          }
        },
      },
    });

    server.route({
      method: '*',
      path: '/{any*}',
      options: {
        payload: {
          parse: false,
        },
        handler: (req, h) => {
          return h.proxy({
            host: esUrl.hostname,
            port: esUrl.port,
            protocol: 'http',
            passThrough: true,
          });
        },
      },
    });

    await server.start(); // start ES with proxy

    // Setup kibana configured to use proxy as ES backend
    const root = kbnTestServer.createRootWithCorePlugins({
      elasticsearch: { hosts: [`http://${esUrl.hostname}:${proxyPort}`] },
      migrations: {
        skip: false,
      },
    });
    await root.preboot();

    const setup = await root.setup();

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

    const { savedObjects } = await root.start();

    // Get a saved object repository
    const repository = savedObjects.createInternalRepository();

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
        const docMyothertype = await repository.get('my_other_type', `${myOtherType.id}`); // document does not exist and the product header is modified
        expect(docMyothertype.type).toBe('my_other_type');

        const docMyType = await repository.get('my_type', '123');
      }
    } catch (err) {
      expect(err.output.statusCode).toBe(503);
      expect(err.output.payload.message).toBe(
        'x-elastic-product not present or not recognized: Saved object [my_type/123] not found'
      );
    }
    await root.shutdown();
    await server.stop();
    await stopES();
  });
});
