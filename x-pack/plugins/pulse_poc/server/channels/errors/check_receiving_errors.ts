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
          must: [
            {
              term: { deployment_id: deploymentId },
            },
            {
              range: {
                timestamp: {
                  gte: 'now-30s',
                  lte: 'now',
                },
              },
            },
          ],
          filter: {
            term: {
              'status.keyword': 'new',
            },
          },
        },
      },
    },
  });

  if (response.hits.hits.length) {
    const sources = response.hits.hits.map((hit: any) => {
      const source = {
        ...hit._source,
      };
      return source;
    });
    return sources;
  } else {
    return undefined;
  }
}
