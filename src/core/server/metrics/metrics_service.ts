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
import { ReplaySubject } from 'rxjs';
import { first } from 'rxjs/operators';
import { CoreService } from '../../types';
import { CoreContext } from '../core_context';
import { Logger, LogMeta } from '../logging';
import { InternalHttpServiceSetup } from '../http';
import { InternalMetricsServiceSetup, InternalMetricsServiceStart, OpsMetrics } from './types';
import { OpsMetricsCollector } from './ops_metrics_collector';
import { opsConfig, OpsConfigType } from './ops_config';

interface MetricsServiceSetupDeps {
  http: InternalHttpServiceSetup;
}

/** @internal */
export class MetricsService
  implements CoreService<InternalMetricsServiceSetup, InternalMetricsServiceStart> {
  private readonly logger: Logger;
  private readonly opsMetricsLogger: Logger;
  private metricsCollector?: OpsMetricsCollector;
  private collectInterval?: NodeJS.Timeout;
  private metrics$ = new ReplaySubject<OpsMetrics>(1);
  private service?: InternalMetricsServiceSetup;

  constructor(private readonly coreContext: CoreContext) {
    this.logger = coreContext.logger.get('metrics');
    this.opsMetricsLogger = coreContext.logger.get('metrics', 'ops');
  }

  public async setup({ http }: MetricsServiceSetupDeps): Promise<InternalMetricsServiceSetup> {
    const config = await this.coreContext.configService
      .atPath<OpsConfigType>(opsConfig.path)
      .pipe(first())
      .toPromise();

    this.metricsCollector = new OpsMetricsCollector(http.server, {
      logger: this.logger,
      ...config.cGroupOverrides,
    });

    await this.refreshMetrics();

    this.collectInterval = setInterval(() => {
      this.refreshMetrics();
    }, config.interval.asMilliseconds());

    const metricsObservable = this.metrics$.asObservable();

    this.service = {
      collectionInterval: config.interval.asMilliseconds(),
      getOpsMetrics$: () => metricsObservable,
    };

    return this.service;
  }

  public async start(): Promise<InternalMetricsServiceStart> {
    if (!this.service) {
      throw new Error('#setup() needs to be run first');
    }

    return this.service;
  }
  private extractOpsLogsData({ process, os }: Partial<OpsMetrics>): LogMeta {
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

  private async refreshMetrics() {
    this.logger.debug('Refreshing metrics');
    const metrics = await this.metricsCollector!.collect();
    const opsLogsMetricsMeta = this.extractOpsLogsData(metrics);
    // TODO: refactor to report the metrics as a meta property:
    this.opsMetricsLogger.debug('ops metrics', opsLogsMetricsMeta);
    this.metricsCollector!.reset();
    this.metrics$.next(metrics);
  }

  public async stop() {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }
    this.metrics$.complete();
  }
}
