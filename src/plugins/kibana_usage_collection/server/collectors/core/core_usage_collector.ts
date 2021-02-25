/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { UsageCollectionSetup } from 'src/plugins/usage_collection/server';
import { CoreUsageData, CoreUsageDataStart } from '../../../../../core/server';
import { coreUsageCollectorSchema } from './core_usage_collector_schema';

export function getCoreUsageCollector(
  usageCollection: UsageCollectionSetup,
  getCoreUsageDataService: () => CoreUsageDataStart
) {
  return usageCollection.makeUsageCollector<CoreUsageData>({
    type: 'core',
    isReady: () => typeof getCoreUsageDataService() !== 'undefined',
    schema: { ...coreUsageCollectorSchema },
    fetch() {
      return getCoreUsageDataService().getCoreUsageData();
    },
  });
}

export function registerCoreUsageCollector(
  usageCollection: UsageCollectionSetup,
  getCoreUsageDataService: () => CoreUsageDataStart
) {
  usageCollection.registerCollector(
    getCoreUsageCollector(usageCollection, getCoreUsageDataService)
  );
}
