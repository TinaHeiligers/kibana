/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { schema } from '@kbn/config-schema';
import { merge } from 'lodash';
import { getClusterStats } from '../../../../lib/cluster/get_cluster_stats';
import { getClusterStatus } from '../../../../lib/cluster/get_cluster_status';
import { getNodes, getNodesUsage } from '../../../../lib/elasticsearch/nodes';
import { getNodesShardCount } from '../../../../lib/elasticsearch/shards/get_nodes_shard_count';
import { handleError } from '../../../../lib/errors/handle_error';
import { prefixIndexPattern } from '../../../../lib/ccs_utils';
import { INDEX_PATTERN_ELASTICSEARCH } from '../../../../../common/constants';
import { getPaginatedNodes } from '../../../../lib/elasticsearch/nodes/get_nodes/get_paginated_nodes';
import { LISTING_METRICS_NAMES } from '../../../../lib/elasticsearch/nodes/get_nodes/nodes_listing_metrics';
import { getIndicesUnassignedShardStats } from '../../../../lib/elasticsearch/shards/get_indices_unassigned_shard_stats';

export function esNodesRoute(server) {
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/elasticsearch/nodes',
    config: {
      validate: {
        params: schema.object({
          clusterUuid: schema.string(),
        }),
        payload: schema.object({
          ccs: schema.maybe(schema.string()),
          timeRange: schema.object({
            min: schema.string(),
            max: schema.string(),
          }),
          pagination: schema.object({
            index: schema.number(),
            size: schema.number(),
          }),
          sort: schema.object({
            field: schema.string({ defaultValue: '' }),
            direction: schema.string({ defaultValue: '' }),
          }),
          queryText: schema.string({ defaultValue: '' }),
        }),
      },
    },
    async handler(req) {
      const config = server.config();
      const { ccs, pagination, sort, queryText } = req.payload;
      const clusterUuid = req.params.clusterUuid;
      const esIndexPattern = prefixIndexPattern(config, INDEX_PATTERN_ELASTICSEARCH, ccs);

      try {
        const clusterStats = await getClusterStats(req, esIndexPattern, clusterUuid);
        const nodesShardCount = await getNodesShardCount(req, esIndexPattern, clusterStats);
        const indicesUnassignedShardStats = await getIndicesUnassignedShardStats(
          req,
          esIndexPattern,
          clusterStats
        );
        const clusterStatus = getClusterStatus(clusterStats, indicesUnassignedShardStats);

        const metricSet = LISTING_METRICS_NAMES;
        const { pageOfNodes, totalNodeCount } = await getPaginatedNodes(
          req,
          esIndexPattern,
          { clusterUuid },
          metricSet,
          pagination,
          sort,
          queryText,
          {
            clusterStats,
            nodesShardCount,
          }
        );

        const nodesStats = await getNodes(
          req,
          esIndexPattern,
          pageOfNodes,
          clusterStats,
          nodesShardCount
        );
        const nodesUsage = await getNodesUsage(req, esIndexPattern, pageOfNodes);
        const nodes = merge(nodesStats, { usage: nodesUsage });
        console.log('merged nodes:', nodes);
        return { clusterStatus, nodes, totalNodeCount, nodesUsage };
      } catch (err) {
        throw handleError(err, req);
      }
    },
  });
}

/* the result for clusterStatus is:
clusterStatus { status: 'yellow',
  indicesCount: 15,
  documentCount: 17106,
  dataSize: 14989379,
  nodesCount: 1,
  upTime: 739171,
  version: [ '8.0.0' ],
  memUsed: 389908872,
  memMax: 1073741824,
  unassignedShards: 1,
  totalShards: 16 }

*/

/* result for each node from getNodes is:
{ name: 'christianes-mbp.lan',
    transport_address: '127.0.0.1:9300',
    type: 'master',
    isOnline: true,
    nodeTypeLabel: 'Master Node',
    nodeTypeClass: 'starFilled',
    shardCount: 15,
    node_cgroup_quota: undefined,
    node_cgroup_throttled: undefined,
    node_cpu_utilization: { metric: [Object], summary: [Object] },
    node_load_average: { metric: [Object], summary: [Object] },
    node_jvm_mem_percent: { metric: [Object], summary: [Object] },
    node_free_space: { metric: [Object], summary: [Object] },
    resolver: '3qq_J5LnT8yUlerzkKJ6Tw' } --> this is the node_id
*/
