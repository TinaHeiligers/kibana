/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { estypes } from '@elastic/elasticsearch';
import { isString } from 'lodash';

/**
 *
 * @param query
 * @returns
 *
 * @public
 */
export function luceneStringToDsl(
  query: string | estypes.QueryDslQueryContainer
): estypes.QueryDslQueryContainer {
  if (isString(query)) {
    if (query.trim() === '') {
      return { match_all: {} };
    }

    return { query_string: { query } };
  }

  return query;
}
