/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { type Observable, timer, takeUntil } from 'rxjs';
import type { Logger, ISavedObjectsRepository } from '@kbn/core/server';
import { ROLL_INDICES_INTERVAL, ROLL_INDICES_START } from './constants';
import { rollUsageCountersIndices } from './rollups';
import { IUsageCounter } from '../usage_counter';

export function registerUsageCountersRollups({
  logger,
  getRegisteredUsageCounters,
  internalRepository,
  pluginStop$,
}: {
  logger: Logger;
  getRegisteredUsageCounters: () => IUsageCounter[];
  internalRepository: ISavedObjectsRepository;
  pluginStop$: Observable<void>;
}) {
  timer(ROLL_INDICES_START, ROLL_INDICES_INTERVAL)
    .pipe(takeUntil(pluginStop$))
    .subscribe(() =>
      rollUsageCountersIndices({
        logger,
        getRegisteredUsageCounters,
        internalRepository,
      })
    );
}
