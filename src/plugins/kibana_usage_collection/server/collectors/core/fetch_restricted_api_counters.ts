/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Logger } from '@kbn/logging';
import type { CoreRestrictedApiUsageStats } from '@kbn/core-usage-data-server';
import { USAGE_COUNTERS_SAVED_OBJECT_TYPE } from '@kbn/usage-collection-plugin/server';

import { createCounterFetcher, type CounterEvent } from '../common/counters';

const RESTRICTED_API_COUNTERS_FILTER = `${USAGE_COUNTERS_SAVED_OBJECT_TYPE}.attributes.counterType: restricted_api_call\\:*`;

const mergeCounter = (counter: CounterEvent, acc?: CoreRestrictedApiUsageStats) => {
  if (acc && acc?.apiId !== counter.counterName) {
    throw new Error(
      `Failed to merge mismatching counterNames: ${acc.apiId} with ${counter.counterName}`
    );
  }
  const isMarkedCounter = counter.counterType.endsWith(':marked_as_resolved');

  const finalCounter = {
    apiId: counter.counterName,
    apiTotalCalls: 0,
    apiLastCalledAt: 'unknown',
    totalMarkedAsResolved: 0,
    markedAsResolvedLastCalledAt: 'unknown',
    ...(acc || {}),
  };

  if (isMarkedCounter) {
    return finalCounter;
  }

  const isResolvedCounter = counter.counterType.endsWith(':resolved');
  const totalKey = isResolvedCounter ? 'totalMarkedAsResolved' : 'apiTotalCalls';
  const lastUpdatedKey = isResolvedCounter ? 'markedAsResolvedLastCalledAt' : 'apiLastCalledAt';

  const newPayload = {
    [totalKey]: (finalCounter[totalKey] || 0) + counter.total,
    [lastUpdatedKey]: counter.lastUpdatedAt,
  };

  return {
    ...finalCounter,
    ...newPayload,
  };
};

function mergeCounters(counters: CounterEvent[]): CoreRestrictedApiUsageStats[] {
  const mergedCounters = counters.reduce((acc, counter) => {
    const { counterName } = counter;
    const existingCounter = acc[counterName];

    acc[counterName] = mergeCounter(counter, existingCounter);

    return acc;
  }, {} as Record<string, CoreRestrictedApiUsageStats>);

  return Object.values(mergedCounters);
}

export const fetchRestrictedApiCounterStats = (logger: Logger) => {
  return createCounterFetcher(logger, RESTRICTED_API_COUNTERS_FILTER, mergeCounters);
};
