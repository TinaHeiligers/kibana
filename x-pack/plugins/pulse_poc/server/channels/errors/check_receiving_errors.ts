/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import uuidv5 from 'uuid/v5';

import { IScopedClusterClient } from 'src/core/server';
import { CheckContext } from '../../types';

const ERRORS_NAMESPACE = '29787b00-3d6e-11ea-a7f9-d9f7b8cd6435';
export async function check(es: IScopedClusterClient, { deploymentId, indexName }: CheckContext) {
  // TODO: modify the search query for full text search
  const response = await es.callAsInternalUser('search', {
    index: indexName,
    size: 10,
    allow_no_indices: true,
    ignore_unavailable: true,
    body: {
      sort: [{ timestamp: { order: 'desc' } }],
      query: {
        bool: {
          must: {
            term: { deployment_id: deploymentId },
          },
          filter: {
            exists: { field: 'fixed_version' },
          },
          must_not: {
            term: { status: 'new' },
          },
        },
      },
    },
  });

  if (response.hits.hits) {
    const sources = response.hits.hits.map((hit: any) => {
      const { deployment_id, ...rest } = hit._source;
    });
    return sources;
  }
  // Mock return of pre-saved documents on the first fetch.
  // these will be resent from the client with "status": "seen" after dismissing them
  // Mocking should only be needed for the first fetch
  return [
    {
      owner: 'core',
      id: 'pulse_error',
      value: {
        timestamp: '1579735716021',
        error_id: uuidv5('Hello world!', ERRORS_NAMESPACE),
        fixed_version: '7.6.0',
        message: 'Error in notifications',
        currentKibanaVersion: '7.5.2',
        status: 'new',
      },
    },
    {
      owner: 'core',
      id: 'pulse_error',
      value: {
        timestamp: '1578735911009',
        error_id: uuidv5('Another Error!', ERRORS_NAMESPACE),
        fixed_version: '7.5.2',
        message: 'Error in home plugin',
        currentKibanaVersion: '7.5.1',
        status: 'new',
      },
    },
  ];
}
