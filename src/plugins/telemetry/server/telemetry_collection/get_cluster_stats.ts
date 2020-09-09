/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ApiResponse, RequestParams } from '@elastic/elasticsearch';
import { ClusterDetailsGetter } from 'src/plugins/telemetry_collection_manager/server';
import { LegacyAPICaller, ElasticsearchClient } from 'kibana/server';
import { TIMEOUT } from './constants';
/**
 * Get the cluster stats from the connected cluster.
 *
 * This is the equivalent to GET /_cluster/stats?timeout=30s.
 */
export async function getClusterStats(
  callCluster: LegacyAPICaller,
  esClient?: ElasticsearchClient
) {
  const useLegacy = !!esClient;
  if (useLegacy) {
    const legacyClusterStats = await callCluster('cluster.stats', {
      timeout: TIMEOUT,
    });
    return legacyClusterStats;
  }
  const clusterStatsParams: RequestParams.ClusterStats = {
    timeout: TIMEOUT,
  };
  const response: ApiResponse = await esClient!.cluster.stats(clusterStatsParams);
  return response.body;
}

/**
 * Get the cluster uuids from the connected cluster.
 */
export const getClusterUuids: ClusterDetailsGetter = async ({ callCluster, esClient }) => {
  const result = await getClusterStats(callCluster, esClient);
  return [{ clusterUuid: result.cluster_uuid }];
};
