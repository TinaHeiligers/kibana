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

import { LegacyAPICaller, ElasticsearchClient } from 'kibana/server';

// This can be removed when the ES client improves the types
export interface ESClusterInfo {
  cluster_uuid: string;
  cluster_name: string;
  version: {
    number: string;
    build_flavor: string;
    build_type: string;
    build_hash: string;
    build_date: string;
    build_snapshot?: boolean;
    lucene_version: string;
    minimum_wire_compatibility_version: string;
    minimum_index_compatibility_version: string;
  };
}
export interface ESClusterInfoResponse {
  body: ESClusterInfo;
  statusCode: number;
  headers: object;
  warnings: string[];
  meta: object;
}
export async function clusterInfoGetter(esClient: ElasticsearchClient) {
  const { body } = ((await esClient.info()) as unknown) as ESClusterInfoResponse;
  return body;
}
/**
 * Get the cluster info from the connected cluster.
 *
 * This is the equivalent to GET /
 *
 * @param {function} callCluster The callWithInternalUser handler (exposed for testing)
 * @param {function} esClient The asInternalUser handler (exposed for testing)
 *
 * TODO: needs work on using the new client
 * The new client always returns an object of the shape, regardless of an error during the request execution:
 * {
 *  body: object | boolean
 *  statusCode: number
 *  headers: object
 *  warnings: [string],
 *  meta: object
 * }
 */
export function getClusterInfo(callCluster: LegacyAPICaller, esClient: ElasticsearchClient) {
  const useLegacy = true;
  return useLegacy ? callCluster<ESClusterInfo>('info') : clusterInfoGetter(esClient);
}
