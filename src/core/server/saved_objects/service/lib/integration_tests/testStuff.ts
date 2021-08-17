/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Hapi = require('@hapi/hapi');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const h2o2 = require('@hapi/h2o2');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wreck = require('@hapi/wreck');

const start = async function () {
  const server = Hapi.server({
    port: 9230,
  });
  try {
    await server.register(h2o2);
    server.route({
      method: '*',
      path: '/{any*}',
      config: { payload: { parse: false } },
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
            console.log('receiving some response from the upstream', Object.keys(res));
            console.log('response statusCode from the upstream', res.statusCode);
            console.log('response statusMessage from the upstream', res.statusMessage);
            const payload = await wreck.read(res, { json: false });
            // console.log('some payload manipulation if you want to.', payload);
            const response = h.response(payload);
            console.log('the new response is', Object.keys(response));
            const newHeaders = {
              ...res.headers,
            };
            response.headers = newHeaders;
            console.log('the new headers are:', response.headers);
            return response;
          },
        });
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
