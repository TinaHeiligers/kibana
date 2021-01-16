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
import { OpsMetrics } from '..';
import * as kbnTestServer from '../../../test_helpers/kbn_server';
import { InternalCoreSetup } from '../../internal_types';
import { LogMeta } from '../../logging';
import { Root } from '../../root';

const otherTestSettings = {
  ops: {
    interval: 500,
  },
  logging: {
    silent: true, // set "true" in kbnTestServer
    appenders: {
      'custom-console': {
        kind: 'console',
        layout: {
          highlight: false,
          kind: 'pattern',
          pattern: '%meta',
        },
      },
    },
    loggers: [
      {
        context: 'metrics.ops',
        appenders: ['custom-console'],
        level: 'debug',
      },
    ],
  },
};

function extractTestMetricsOfInterest({ process, os }: Partial<OpsMetrics>): LogMeta {
  // NOTE: verbose refactor to only return parts that are defined.

  // TODO: provide these metrics in a structured ECS-compatible way
  // let logMessageResponses = '';
  const memoryLogValueinMB = process?.memory?.heap?.used_in_bytes
    ? numeral(process?.memory?.heap?.used_in_bytes).format('0.0b')
    : undefined;
  // ProcessMetricsCollector converts from seconds to milliseconds. Format here is HH:mm:ss for backward compatibility
  const uptimeLogValue = process?.uptime_in_millis
    ? numeral(process?.uptime_in_millis / 1000).format('00:00:00')
    : undefined;

  const delayLogValue = process?.event_loop_delay
    ? numeral(process?.event_loop_delay).format('0.000')
    : undefined;

  const loadLogValue = [...Object.values(os?.load ?? [])].map((val: number) => {
    return numeral(val).format('0.00');
  });
  const opsMetricsLogMeta = {
    ...(memoryLogValueinMB && { memory: memoryLogValueinMB }),
    ...(uptimeLogValue && { uptime: uptimeLogValue }),
    ...(loadLogValue.length > 0 && { load: loadLogValue }),
    ...(delayLogValue && { delay: delayLogValue }),
  };
  return opsMetricsLogMeta;
}

describe('metrics service', () => {
  let root: Root;
  let coreSetup: InternalCoreSetup;
  let mockConsoleLog: jest.SpyInstance;
  let testData: Partial<OpsMetrics>;

  describe('setup', () => {
    beforeAll(async () => {
      mockConsoleLog = jest.spyOn(global.console, 'log');
      mockConsoleLog.mockClear();
      root = kbnTestServer.createRoot({ ...otherTestSettings });
      coreSetup = await root.setup();
    });

    afterAll(async () => {
      await root.shutdown();
      mockConsoleLog.mockRestore();
    });

    it('returns ops interval and getOpsMetrics$ observable', async () => {
      expect(coreSetup.metrics).toHaveProperty(
        'collectionInterval',
        otherTestSettings.ops.interval
      );
      expect(coreSetup.metrics).toHaveProperty('getOpsMetrics$');
    });

    it('logs memory, uptime, load and delay ops metrics', async () => {
      coreSetup.metrics.getOpsMetrics$().subscribe((opsMetrics) => {
        testData = opsMetrics;
      });
      const expected = extractTestMetricsOfInterest(testData);
      const actual = JSON.parse(mockConsoleLog.mock.calls[0]);
      expect(actual).toMatchObject(expected);
    });
  });
});
