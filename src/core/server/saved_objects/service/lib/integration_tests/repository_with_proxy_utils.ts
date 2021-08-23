/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import Hapi from '@hapi/hapi';
import { IncomingMessage } from 'http';
const defaultProxyOptions = (hostname: string, port: number | string) => ({
  host: hostname,
  port,
  protocol: 'http' as 'http',
  passThrough: true,
});

let proxyInterrupt: string | null | undefined = null;

export const setProxyInterrupt = (testArg: string | null) => (proxyInterrupt = testArg);
export const getProxyInterrupt = () => proxyInterrupt;

const relayHandler = (h: Hapi.ResponseToolkit, hostname: string, port: number | string) => {
  return h.proxy({ ...defaultProxyOptions(hostname, port) });
};

const proxyResponseHandler = (h: Hapi.ResponseToolkit, hostname: string, port: number | string) => {
  return h.proxy({
    ...defaultProxyOptions(hostname, port),
    // eslint-disable-next-line @typescript-eslint/no-shadow
    onResponse: async (err, res, request, h, settings, ttl) => proxyOnResponseHandler(res, h),
  });
};
const proxyOnResponseHandler = async (res: IncomingMessage, h: Hapi.ResponseToolkit) => {
  return h
    .response(res)
    .header('x-elastic-product', 'somethingitshouldnotbe', { override: true })
    .code(404);
};
// GET /.kibana_8.0.0/_doc/{type*} route (repository.get calls)
export const registerGetRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
  hapiServer.route({
    method: 'GET',
    path: '/.kibana_8.0.0/_doc/{type*}',
    options: {
      handler: (req, h) => {
        // mimics a 404 'unexpected' response from the proxy for specific docs
        if (req.params.type === 'my_type:myTypeId1' || req.params.type === 'my_type:myType_123') {
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });
// DELETE /.kibana_8.0.0/_doc/{type*} route (repository.delete calls)
export const registerDeleteRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
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
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });

// POST _bulk route
export const registerPostBulkRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
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
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });
// POST _mget route (repository.bulkGet calls)
export const registerPostMgetRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
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
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });
// GET _search route
export const registerGetSearchRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
  hapiServer.route({
    method: 'GET',
    path: '/.kibana_8.0.0/_search',
    options: {
      handler: (req, h) => {
        const payload = req.payload;
        if (!payload) {
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });
// POST _search route (`find` calls)
export const registerPostSearchRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
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
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });
// POST _update
export const registerPostUpdateRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
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
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });
// POST _pit
export const registerPostPitRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
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
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });
// POST _update_by_query
export const registerPostUpdateByQueryRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
  hapiServer.route({
    method: 'POST',
    path: '/.kibana_8.0.0/_update_by_query',
    options: {
      payload: {
        output: 'data',
        parse: false,
      },
      handler: (req, h) => {
        // mimics a 404 'unexpected' response from the proxy
        if (proxyInterrupt === 'deleteByNamespace') {
          return proxyResponseHandler(h, hostname, port);
        } else {
          return relayHandler(h, hostname, port);
        }
      },
    },
  });

// catch-all passthrough route
export const registerPassthroughRoute = (
  hapiServer: Hapi.Server,
  hostname: string,
  port: string | number
) =>
  hapiServer.route({
    method: '*',
    path: '/{any*}',
    options: {
      payload: {
        output: 'data',
        parse: false,
      },
      handler: (req, h) => {
        return relayHandler(h, hostname, port);
      },
    },
  });
