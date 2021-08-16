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
      adjustTimeout: jest.setTimeout,
    });

    const { hosts, stop: stopES } = await startES();
    const esUrl = new URL(hosts[0]);
    // For the proxy, use a port number that is 100 higher than the one that the actual ES instance is using
    const proxyPort = parseInt(esUrl.port, 10) + 100;

    // Set this variable when you want the proxy to return this instead of proxying to ES
    let customResponse: undefined | { body: any; statusCode: number };

    // Setup custom hapi server with h2o2 plugin for proxying
    const server = Hapi.server({
      port: proxyPort,
    });
    await server.register(h2o2);
    server.route({
      method: '*',
      path: '/*',
      handler: (req, h) => {
        if (customResponse) {
          return h.response(customResponse.body).code(customResponse.statusCode);
        }

        return h.proxy({ host: esUrl.host, port: esUrl.port, protocol: 'http' });
      },
    });
    await server.start();

    // Setup kibana configured to use proxy as ES backend
    const root = kbnTestServer.createRoot({
      elasticsearch: { hosts: [`http://${esUrl.host}:${proxyPort}`] },
    });
    await root.preboot();
    const setup = await root.setup();
    setup.savedObjects.registerType({
      hidden: false,
      mappings: {
        dynamic: false,
        properties: {},
      },
      name: 'test_counter_type',
      namespaceType: 'single'
    });

    const { savedObjects } = await root.start();

    // Get a saved object repository
    const repository = savedObjects.createInternalRepository();


    // set a custom response
    customResponse = { body: { reason: 'proxy response!' }, statusCode: 404 };

    // ... do something with repository
    const response = await repository.get('test_counter_type');
    expect(response).toEqual(...);

    // unset custom response (should fallback to ES now again)
    customResponse = undefined;

    await root.shutdown();
    await server.stop();
    await stopES();
  });
});
