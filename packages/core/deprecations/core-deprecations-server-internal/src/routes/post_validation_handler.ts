/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { InternalCoreUsageDataSetup } from '@kbn/core-usage-data-server-internal';
import type { CoreKibanaRequest } from '@kbn/core-http-router-server-internal';
import type { InternalHttpServiceSetup } from '@kbn/core-http-server-internal';
import { isObject } from 'lodash';
import { RouteDeprecationInfo, RouteRestrictionInfo } from '@kbn/core-http-server/src/router/route';
import { buildApiDeprecationId, buildApiRestrictionId } from '../deprecations';

interface Dependencies {
  coreUsageData: InternalCoreUsageDataSetup;
  http: InternalHttpServiceSetup;
}
// @Tina TODO: work in buildApiRestrictionId in here
/**
 * listens to http post validation events to increment deprecated api calls and increment restricted api calls.
 * This will keep track of any deprecated or restricted APIs called.
 */
export const registerApiDeprecationsPostValidationHandler = ({
  coreUsageData,
  http,
}: Dependencies) => {
  http.registerOnPostValidation(createRouteDeprecationsHandler({ coreUsageData }));
  http.registerOnPostValidation(createRouteRestrictionsHandler({ coreUsageData }));
};

export function createRouteDeprecationsHandler({
  coreUsageData,
}: {
  coreUsageData: InternalCoreUsageDataSetup;
}) {
  return (req: CoreKibanaRequest, { deprecated }: { deprecated?: RouteDeprecationInfo }) => {
    if (deprecated && isObject(deprecated) && req.route.routePath) {
      const counterName = buildApiDeprecationId({
        routeMethod: req.route.method,
        routePath: req.route.routePath,
        routeVersion: req.apiVersion,
      });

      const client = coreUsageData.getClient();
      // no await we just fire it off.
      void client.incrementDeprecatedApi(counterName, { resolved: false });
    }
  };
}

// @Tina TODO double check this is correct
export function createRouteRestrictionsHandler({
  coreUsageData,
}: {
  coreUsageData: InternalCoreUsageDataSetup;
}) {
  return (req: CoreKibanaRequest, { restricted }: { restricted?: RouteRestrictionInfo }) => {
    // increase counter on external requests to internal APIs
    if (!req.isInternalApiRequest && restricted && isObject(restricted) && req.route.routePath) {
      const counterName = buildApiRestrictionId({
        routeMethod: req.route.method,
        routePath: req.route.routePath,
        routeVersion: req.apiVersion,
      });

      const client = coreUsageData.getClient();
      // no await we just fire it off.
      void client.incrementRestrictedApi(counterName, { resolved: false });
    }
  };
}
