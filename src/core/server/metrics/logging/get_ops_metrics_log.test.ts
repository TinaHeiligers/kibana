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

import { getEcsOpsMetricsLog } from './get_ops_metrics_log';

describe('getEcsOpsMetricsLog', () => {
  it('provides correctly formatted message', () => {
    const firstMetrics = {
      process: {
        memory: { heap: { used_in_bytes: 100 } },
        uptime_in_millis: 1500,
        event_loop_delay: 50,
      },
      os: {
        load: {
          '1m': 10,
          '5m': 20,
          '15m': 30,
        },
      },
    };
    const result = getEcsOpsMetricsLog(firstMetrics);
    expect(result.message).toMatchInlineSnapshot(
      `"{\\"memory\\":\\"100.0B\\",\\"uptime\\":\\"0:00:01\\",\\"load\\":[\\"10.00\\",\\"20.00\\",\\"30.00\\"],\\"delay\\":\\"50.000\\"}"`
    );
  });
});
