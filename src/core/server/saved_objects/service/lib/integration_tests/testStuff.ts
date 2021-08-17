/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

const Hapi = require('@hapi/hapi');
const h2o2 = require('@hapi/h2o2');

const server = Hapi.server({
  port: 9230,
});
server.register(h2o2).then(() => {
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
      return h.proxy({ host: 'localhost', port: 9200, protocol: 'http', passThrough: true });
    },
  });
  server.start().then(() => {
    console.log('Server started');
  });
});
