/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
/**
 * POC for integration test for missing or manformed product header in response to es client calls in the SO repository.
 * To use this:
 *  1. Move this file to kibana/src/core/server/saved_objects/service/lib/integration_tests
 *  2. Start es locally: $ yarn es snapshot
 *  3. Run this file: $node src/core/server/saved_objects/service/lib/integration_tests/testStuff.ts
 *  4. Fire up Postman and make a request to:
 *      localhost:9230/.security-7/_search
 *      localhost:9230/_cat/aliases
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Hapi = require('@hapi/hapi');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const h2o2 = require('@hapi/h2o2');
// eslint-disable-next-line @typescript-eslint/no-var-requires

const start = async function () {
  const server = Hapi.server({
    port: 9230,
  });
  try {
    await server.register(h2o2);
    server.route({
      method: 'GET',
      path: '/_cat/aliases',
      config: {
        handler: (req, h) => {
          // if (customResponse) {
          //   return h.response(customResponse.body).code(customResponse.statusCode);
          // }
          // options: https://hapi.dev/module/h2o2/api/?v=9.1.0#hproxyoptions

          // return h.response('hello').code(200);
          return h.proxy({
            host: 'localhost',
            port: 9200,
            protocol: 'http',
            passThrough: true,
            onResponse: async (err, res, request, h, settings, ttl) => {
              if (err) {
                console.error(err);
              }
              const response = h.response(res);
              const newHeaders = {
                ...res.headers,
                ['x-elastic-product']: 'something it should not be',
              };
              response.headers = newHeaders;
              // console.log('the new headers are:', response.headers);
              response.statusCode = 418;
              return response;
            },
          });
        },
      },
    });
    server.route({
      method: '*',
      path: '/{any*}',
      config: {
        payload: {
          parse: false,
        },
        handler: (req, h) => {
          // if (customResponse) {
          //   return h.response(customResponse.body).code(customResponse.statusCode);
          // }
          // options: https://hapi.dev/module/h2o2/api/?v=9.1.0#hproxyoptions

          // return h.response('hello').code(200);
          return h.proxy({
            host: 'localhost',
            port: 9200,
            protocol: 'http',
            passThrough: true,
            onResponse: async (err, res, request, h, settings, ttl) => {
              if (err) {
                console.error(err);
              }
              const response = h.response(res); // pass the response along as is
              const newHeaders = {
                // leave the headers as they are
                ...res.headers,
              };
              response.headers = newHeaders;
              // console.log('the new headers are:', response.headers);
              return response;
            },
          });
        },
      },
    });
    await server.start();
    // eslint-disable-next-line no-console
    console.log(`Server started at: ${server.info.uri}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('Failed to load h2o2 and start server. err:', err);
  }
};
start();
