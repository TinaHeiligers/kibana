/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { ElasticsearchClient } from './client';

/**
 * Serves the same purpose as the normal {@link IClusterClient | cluster client} but exposes
 * an additional `asCurrentUser` method that doesn't use credentials of the Kibana internal
 * user (as `asInternalUser` does) to request Elasticsearch API, but rather passes HTTP headers
 * extracted from the current user request to the API instead.
 *
 * @public
 **/
export interface IScopedClusterClient {
  /**
   * A {@link ElasticsearchClient | client} to be used to query the elasticsearch cluster
   * on behalf of the internal Kibana user.
   */
  readonly asInternalUser: ElasticsearchClient;

  /**
   * A {@link ElasticsearchClient | client} to be used to query the elasticsearch cluster
   * with the internal Kibana user as primary auth and the current user as secondary auth
   * (using the `es-secondary-authorization` header).
   *
   * Note that only a subset of Elasticsearch APIs support secondary authentication, and that only those endpoints
   * should be called with this client.
   */
  readonly asSecondaryAuthUser: ElasticsearchClient;

  /**
   * A {@link ElasticsearchClient | client} to be used to query the elasticsearch cluster
   * on behalf of the user that initiated the request to the Kibana server.
   */
  readonly asCurrentUser: ElasticsearchClient;
}
