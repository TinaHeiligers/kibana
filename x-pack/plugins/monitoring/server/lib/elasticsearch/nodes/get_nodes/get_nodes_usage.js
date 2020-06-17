/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import moment from 'moment';
import { checkParam } from '../../../error_missing_required';
import { createQuery } from '../../../create_query';
import { calculateAuto } from '../../../calculate_auto';
import { ElasticsearchMetric } from '../../../metrics';
import { handleResponse } from './handle_response';

/* Run a query to fetch nodes usage data for the selected time range for all the nodes.
 * Returns an array of object for every node, having rest_actions and aggregations
 * @param {Object} req: server request object
 * @param {String} esIndexPattern: index pattern for elasticsearch data in monitoring indices
 * @return {Array} node info combined with metrics for each node from handle_response
 */

export async function getNodesUsage(req, esIndexPattern) {
  checkParam(esIndexPattern, 'esIndexPattern in getNodes');

  // const start = moment.utc(req.payload.timeRange.min).valueOd();
  // const orgStart = start;
  // const end = moment.utc(req.payload.timeRange.max).valueOf();
  // const max = end;
  // const duration = moment.duration(max - orgStart, 'ms');

  // const config = req.server.config();
  // const clusterUuid = req.params.clusterUuid;
  // const metricFields = ElasticsearchMetric.getMetricFields();
  // const min = start;

  // const bucketSize = Math.max(
  //   config.get('monitoring.ui.min_interval_seconds'),
  //   calculateAuto(100, duration).asSeconds()
  // );

  // const uuidsToInclude = pageOfNodes.map((node) => node.uuid);
  // const filters = [
  //   {
  //     terms: {
  //       'source_node.uuid': uuidsToInclude,
  //     },
  //   },
  // ];

  const params = {
    index: esIndexPattern,
    method: 'GET',
    path: '/_nodes/usage',
    query: {
      timeout: '30s',
    },
  };
  //   size: config.get('monitoring.ui.max_bucket_size'),
  //   ignoreUnavailable: true,
  //   body: {
  //     query: createQuery({
  //       start,
  //       end,
  //       clusterUuid,
  //       filters,
  //       metric: metricFields,
  //     }),
  //     sort: [{ timestamp: { order: 'desc' } }],
  //   },
  // };
  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  const { nodes } = await callWithRequest(req, 'transport.request', params);
  const transformedNodes = Object.entries(nodes).map(([key, value]) => ({
    ...value,
    node_id: key, // mapped to resolver elsewhere in monitoring
  }));
  return { nodes: transformedNodes };
}
