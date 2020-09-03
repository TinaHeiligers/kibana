/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { CallCluster } from 'src/legacy/core_plugins/elasticsearch';
import { ElasticsearchClient } from 'src/core/server';
import { ApiResponse, RequestParams } from '@elastic/elasticsearch';
import { TIMEOUT } from './constants';

/**
 * Get the cluster stats from the connected cluster.
 *
 * This is the equivalent of GET /_xpack/usage?master_timeout=${TIMEOUT}
 *
 * Like any X-Pack related API, X-Pack must installed for this to work.
 */
export async function getXPackUsage(callCluster: CallCluster, esClient: ElasticsearchClient) {
  const useLegacy = true;

  const legacyResponse = callCluster('transport.request', {
    method: 'GET',
    path: '/_xpack/usage',
    query: {
      master_timeout: TIMEOUT,
    },
  });
  const xpackUsageParams: RequestParams.XpackUsage = { master_timeout: TIMEOUT };
  const response: ApiResponse = await esClient.xpack.usage(xpackUsageParams);
  return useLegacy ? legacyResponse : response.body;
}
