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
import { Logger } from '../logging';
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
  private metricsCollector?: OpsMetricsCollector;
  private collectInterval?: NodeJS.Timeout;
  private metrics$ = new ReplaySubject<OpsMetrics>(1);
  private service?: InternalMetricsServiceSetup;

  constructor(private readonly coreContext: CoreContext) {
    this.logger = coreContext.logger.get('metrics');
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

  private extractOpsLogsData({ process, os }: Partial<OpsMetrics>): string {
    const memoryLogEntryInMB = numeral(process?.memory?.heap?.used_in_bytes ?? 0).format('0.0b');
    // ProcessMetricsCollector converts from seconds to milliseconds. Format here is HH:mm:ss for backward compatibility
    const uptimeLogEntry = numeral(process?.uptime_in_millis ?? 0 / 1000).format('00:00:00');
    const loadLogEntry = [...Object.values(os?.load ?? [])]
      .map((val: number) => {
        return numeral(val).format('0.00');
      })
      .join(' ');
    const delayLogEntry = numeral(process?.event_loop_delay ?? 0).format('0.000');

    return `memory: ${memoryLogEntryInMB} uptime: ${uptimeLogEntry} load: [${loadLogEntry}] delay: ${delayLogEntry}`;
  }

  private async refreshMetrics() {
    this.logger.debug('Refreshing metrics');
    const metrics = await this.metricsCollector!.collect();
    const opsLogsMetrics = this.extractOpsLogsData(metrics);
    this.logger.info(opsLogsMetrics);

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
