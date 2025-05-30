/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Filter } from '@kbn/es-query';
import type { LocatorServicesDeps } from '.';
import type { DiscoverAppLocatorParams } from '../../common';

/**
 * @internal
 */
export const filtersFromLocatorFactory = (services: LocatorServicesDeps) => {
  /**
   * @public
   */
  const filtersFromLocator = async (params: DiscoverAppLocatorParams): Promise<Filter[]> => {
    const filters: Filter[] = [];

    if (params.timeRange && params.dataViewSpec?.timeFieldName) {
      const timeRange = params.timeRange;
      const timeFieldName = params.dataViewSpec.timeFieldName;

      if (timeRange) {
        filters.push({
          meta: {},
          query: {
            range: {
              [timeFieldName]: {
                format: 'strict_date_optional_time',
                gte: timeRange.from,
                lte: timeRange.to,
              },
            },
          },
        });
      }
    }

    if (params.filters) {
      filters.push(...params.filters);
    }

    return filters;

    // TODO: support extracting filters from saved search
  };

  return filtersFromLocator;
};

export type FiltersFromLocatorFn = ReturnType<typeof filtersFromLocatorFactory>;
