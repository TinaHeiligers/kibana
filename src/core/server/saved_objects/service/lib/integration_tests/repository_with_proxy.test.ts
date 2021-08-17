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
        // options: https://hapi.dev/module/h2o2/api/?v=9.1.0#hproxyoptions
        return h.proxy({ host: esUrl.hostname, port: esUrl.port, protocol: 'http' });
      },
    });
    await server.start();

    // // TODO: Use this for the proxy tests
    // const hostsSettings = [
    //   `http://${esUrl.username}:${esUrl.password}@${esUrl.hostname}:${proxyPort}`,
    // ];

    // const testServerSettings = {
    //   elasticsearch: {
    //     // hosts: [`http://elastic:changeme@localhost:9220/`], // test what it should be, hard-coded
    //     // hosts: [`http://${esUrl.host}:${proxyPort}`], // original from Josh's suggestion-> here host includes the port so we're duplicating the port part and we get an error.
    //     // hosts: [`http://${esUrl.hostname}:${proxyPort}`], // modified to only specify the port once.
    //     hosts: hostsSettings, // my hack
    //   },
    // };

    // console.log('testServerSettings', testServerSettings);
    // // Setup kibana configured to use proxy as ES backend

    // // What it should be from Josh's comment:
    // const root = kbnTestServer.createRoot({
    //   ...testServerSettings,
    // });
    // await root.preboot();
    // const setup = await root.setup();
    // // register a saved object type to check
    // setup.savedObjects.registerType({
    //   name: 'MyType',
    //   hidden: false,
    //   namespaceType: 'single',
    //   mappings: {
    //     dynamic: false,
    //     properties: {
    //       textField: {
    //         type: 'text',
    //       },
    //       boolField: {
    //         type: 'boolean',
    //       },
    //     },
    //   },
    // });

    // const { savedObjects } = await root.start();

    // // Get a saved object repository
    // const repository = savedObjects.createInternalRepository();
    // try {
    //   const response = await repository.get('MyType', '123');
    //   // console.log('response:', response);
    // } catch (err) {
    //   expect(err.output.statusCode).toBe(404);
    //   expect(err.output.payload.error).toBe('Not Found');

    //   // expect(err).toBeInstanceOf(SavedObjectsErrorHelpers.createGenericNotFoundError);
    // }
    // // const response = await repository.get('MyType', '123');
    // // console.log('do we get a response?', response);
    // // expect(!!response).toBeTruthy();
    // // // expect(response).toEqual(...);

    // // unset custom response (should fallback to ES now again)
    // // customResponse = undefined;

    // await root.shutdown();
    // await server.stop();
    // await stopES();
  });
});
