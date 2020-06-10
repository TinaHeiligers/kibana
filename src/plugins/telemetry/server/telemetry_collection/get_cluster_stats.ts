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

import { ClusterDetailsGetter } from 'src/plugins/telemetry_collection_manager/server';
import { APICaller } from 'kibana/server';
import { TIMEOUT } from './constants';
import { getNodesUsage } from './get_nodes_usage';
/**
 * Get the cluster stats from the connected cluster.
 *
 * This is the equivalent to GET /_cluster/stats?timeout=30s.
 */
export async function getClusterStats(callCluster: APICaller) {
  return await callCluster('cluster.stats', {
    timeout: TIMEOUT,
  });
}

/**
 * Get the cluster uuids from the connected cluster.
 */
export const getClusterUuids: ClusterDetailsGetter = async ({ callCluster }) => {
  const result = await getClusterStats(callCluster);
  const nodesUsageResults = await getNodesUsage(callCluster);
  // add the nodesUsageResults to the result.nodes object
  // console.log('nodesUsageResults?', nodesUsageResults);
  const nodesUsageResultOfInterest = nodesUsageResults.find(
    (item) => item.cluster_name === result.cluster_name
  );
  if (nodesUsageResultOfInterest !== undefined) {
    // I would need to reduce the nodesUsageResultOfInterest
    const combinedResults = {
      clusterUuid: result.cluster_uuid,
      nodesUsage: { ...nodesUsageResultOfInterest.nodes },
    };
    return [combinedResults];
  }
  return [{ clusterUuid: result.cluster_uuid }];
};
