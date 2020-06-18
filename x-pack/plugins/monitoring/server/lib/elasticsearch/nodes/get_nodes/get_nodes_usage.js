/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/* Run a query to fetch nodes usage data for the selected time range for all the nodes.
 * Returns an array of object for every node, having rest_actions and aggregations
 * @param {Object} req: server request object
 * @param {String} esIndexPattern: index pattern for elasticsearch data in monitoring indices
 * @return {Array} node info combined with metrics for each node from handle_response
 */

export async function getNodesUsage(req, esIndexPattern, pageOfNodes) {
  const nodeUuidsToInclude = pageOfNodes.map((node) => node.uuid);
  const params = {
    index: esIndexPattern,
    method: 'GET',
    path: `/_nodes/${nodeUuidsToInclude}/usage`,
    query: {
      timeout: '30s',
    },
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  const { nodes } = await callWithRequest(req, 'transport.request', params);
  const transformedNodes = Object.entries(nodes).map(([key, value]) => ({
    ...value,
    node_id: key, // mapped to resolver elsewhere in monitoring
  }));
  return { nodes: transformedNodes };
  // still need to handle the response
}
