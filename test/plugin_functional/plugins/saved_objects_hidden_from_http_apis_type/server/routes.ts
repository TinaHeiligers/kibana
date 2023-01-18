/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { HttpServiceSetup, IRouter, RequestHandlerContext } from '@kbn/core/server';
import { schema } from '@kbn/config-schema';

const registerGetRoute = (router: IRouter<RequestHandlerContext>) => {
  router.get(
    {
      path: '/api/hidden_from_http_api/{type}/{id}',
      validate: {
        params: schema.object({
          type: schema.string(),
          id: schema.string(),
        }),
      },
      options: {
        authRequired: false,
      },
    },
    async (context, req, res) => {
      const { type, id } = req.params;
      const { savedObjects } = await context.core;
      const object = await savedObjects.client.get(type, id);
      return res.ok({ body: object });
    }
  );
};

const registerDeleteRoute = (router: IRouter<RequestHandlerContext>) => {
  router.get(
    {
      path: '/api/hidden_from_http_api/delete/{type}/{id}',
      validate: {
        params: schema.object({
          type: schema.string(),
          id: schema.string(),
        }),
      },
      options: {
        authRequired: false,
      },
    },
    async (context, req, res) => {
      const { type, id } = req.params;
      const { savedObjects } = await context.core;
      await savedObjects.client.delete(type, id);
      return res.ok();
    }
  );
};

const registerBulkGetRoute = (router: IRouter<RequestHandlerContext>) => {
  router.post(
    {
      path: '/api/hidden_from_http_api/_bulk_get',
      validate: {
        body: schema.arrayOf(
          schema.object({
            type: schema.string(),
            id: schema.string(),
            fields: schema.maybe(schema.arrayOf(schema.string())),
            namespaces: schema.maybe(schema.arrayOf(schema.string())),
          })
        ),
      },
      options: {
        authRequired: false,
      },
    },
    async (context, req, res) => {
      const { savedObjects } = await context.core;
      const result = await savedObjects.client.bulkGet(req.body);
      return res.ok({ body: result.saved_objects });
    }
  );
};

const registerBulkDeleteRoute = (router: IRouter<RequestHandlerContext>) => {
  router.get(
    {
      path: '/api/hidden_from_http_api/_bulk_delete',
      validate: {
        body: schema.arrayOf(
          schema.object({
            type: schema.string(),
            id: schema.string(),
          })
        ),
        query: schema.object({
          force: schema.maybe(schema.boolean()),
        }),
      },
      options: {
        authRequired: false,
      },
    },
    async (context, req, res) => {
      const { force } = req.query;
      const { savedObjects } = await context.core;
      const statuses = await savedObjects.client.bulkDelete(req.body, { force });
      return res.ok({ body: statuses });
    }
  );
};

export function registerRoutes(http: HttpServiceSetup) {
  const router = http.createRouter();
  registerGetRoute(router);
  registerBulkGetRoute(router);
  registerDeleteRoute(router);
  registerBulkDeleteRoute(router);
}
