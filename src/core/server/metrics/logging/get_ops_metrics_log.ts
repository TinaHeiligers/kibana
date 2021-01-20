/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * and the Server Side Public License, v 1; you may not use this file except in
 * compliance with, at your election, the Elastic License or the Server Side
 * Public License, v 1.
 */

import numeral from '@elastic/numeral';
import { LogMeta } from '@kbn/logging';
import { EcsOpsMetricsEvent } from './ecs';
import { OpsMetrics } from '..';

/**
 * Converts ops metrics into ECS-compliant `LogMeta` for logging
 *
 * @internal
 */
export function getEcsOpsMetricsLog({ process, os }: Partial<OpsMetrics>): LogMeta {
  const processMemoryUsedInBytes = process?.memory?.heap?.used_in_bytes;
  const processMemoryUsedInBytesMsg = processMemoryUsedInBytes
    ? numeral(processMemoryUsedInBytes).format('0.0b')
    : '';

  // ProcessMetricsCollector converts from seconds to milliseconds.
  // ECS process.uptime is in seconds:
  const uptimeVal = process?.uptime_in_millis
    ? Math.floor(process.uptime_in_millis / 1000)
    : undefined;

  // HH:mm:ss format for backward compatibility
  const uptimeValMsg = uptimeVal ? numeral(uptimeVal).format('00:00:00') : '';

  // Event loop delay is in ms
  const eventLoopDelayVal = process?.event_loop_delay;
  const eventLoopDelayValMsg = eventLoopDelayVal
    ? numeral(process?.event_loop_delay).format('0.000')
    : '';

  const loadEntries = {
    '1m': os?.load['1m'] ?? undefined,
    '5m': os?.load['5m'] ?? undefined,
    '15m': os?.load['15m'] ?? undefined,
  };
  const loadVals = [...Object.values(os?.load ?? [])];
  const loadValsMsg = loadVals.map((val: number) => {
    return numeral(val).format('0.00');
  });

  // Construct log message from data that is defined
  const metaMessage = {
    ...(processMemoryUsedInBytes && { memory: processMemoryUsedInBytesMsg }),
    ...(uptimeVal && { uptime: uptimeValMsg }),
    ...(loadVals.length > 0 && { load: loadValsMsg }),
    ...(eventLoopDelayVal && { delay: eventLoopDelayValMsg }),
  };

  // ECS fields
  const meta: EcsOpsMetricsEvent = {
    ecs: { version: '1.7.0' },
    message: `${JSON.stringify(metaMessage)}`,
    kind: 'metric',
    category: ['process', 'host'],
    process: {
      uptime: uptimeVal,
    },
  };

  // return ECS event with custom fields added
  return {
    ...meta,
    process: {
      ...meta.process,
      memory: {
        heap: {
          usedInBytes: processMemoryUsedInBytes,
        },
      },
      eventLoopDelay: eventLoopDelayVal,
    },
    host: {
      os: {
        load: { ...loadEntries },
      },
    },
  };
}
