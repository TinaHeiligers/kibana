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
import numeral from '@elastic/numeral';
import { LogMeta } from '@kbn/logging';
import { OpsMetrics } from '..';

export function getEcsOpsMetricsLog({ process, os }: Partial<OpsMetrics>): LogMeta {
  // NOTE: verbose refactor to only return parts that are defined.
  // TODO: provide these metrics in a structured ECS-compatible way
  const processMemoryUsedInBytes = process?.memory?.heap?.used_in_bytes;
  const processMemoryUsedInBytesMsg = processMemoryUsedInBytes
    ? numeral(processMemoryUsedInBytes).format('0.0b')
    : '';

  // ProcessMetricsCollector converts from seconds to milliseconds.
  // ECS process.uptime is in seconds:
  const uptimeVal = process?.uptime_in_millis ? process.uptime_in_millis / 1000 : undefined;
  // Format here is HH:mm:ss for backward compatibility
  const uptimeValMsg = process?.uptime_in_millis
    ? numeral(process?.uptime_in_millis / 1000).format('00:00:00')
    : undefined;

  const eventLoopDelayVal = process?.event_loop_delay;
  const eventLoopDelayValMsg = process?.event_loop_delay
    ? numeral(process?.event_loop_delay).format('0.000')
    : undefined;

  const loadVals = [...Object.values(os?.load ?? [])];
  const loadValsMsg = loadVals.map((val: number) => {
    return numeral(val).format('0.00');
  });

  // the only ECS field in this response is process.uptime, add in event.kind = metric
  const metaData = {
    ...(processMemoryUsedInBytes && { memory: processMemoryUsedInBytesMsg }),
    ...(uptimeVal && { uptime: uptimeValMsg }),
    ...(loadVals.length > 0 && { load: loadValsMsg }),
    ...(eventLoopDelayVal && { delay: eventLoopDelayValMsg }),
  };
  const metaDataMessage: string = JSON.stringify(metaData);

  // return ECS event with custom fields added
  const meta = {
    ecs: { version: '1.7.0' },
    message: `${metaDataMessage}`,
    kind: 'metric',
    category: ['process', 'host'],
    process: {
      uptime: uptimeVal,
    },
    host: {
      os: {},
    },
  };

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
        load: loadVals,
      },
    },
  };
}
