/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { BehaviorSubject, firstValueFrom, ReplaySubject } from 'rxjs';
import type { RootSchema, SchemaObject } from '@kbn/analytics-client';
import { CoreService } from '../../types';
import { CoreContext } from '../core_context';
import { Logger } from '../logging';
import { InternalHttpServiceSetup } from '../http';
import { InternalMetricsServiceSetup, InternalMetricsServiceStart, OpsMetrics } from './types';
import { OpsMetricsCollector } from './ops_metrics_collector';
import { opsConfig, OpsConfigType } from './ops_config';
import { getEcsOpsMetricsLog } from './logging';
import { AnalyticsServiceSetup } from '../analytics';
import { OpsProcessMetrics } from './collectors';

export interface MetricsServiceSetupDeps {
  http: InternalHttpServiceSetup;
  analytics: AnalyticsServiceSetup;
}

export interface OpsMetricsAnalyticsContext {
  ops_metrics_service_status: string;
  ops_metrics_service_summary: string;
}

/** @internal */
export class MetricsService
  implements CoreService<InternalMetricsServiceSetup, InternalMetricsServiceStart>
{
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

  public async setup({
    analytics,
    http,
  }: MetricsServiceSetupDeps): Promise<InternalMetricsServiceSetup> {
    const config = await firstValueFrom(
      this.coreContext.configService.atPath<OpsConfigType>(opsConfig.path)
    );

    this.metricsCollector = new OpsMetricsCollector(http.server, {
      logger: this.logger,
      ...config.cGroupOverrides,
    });

    await this.refreshMetrics();

    this.collectInterval = setInterval(() => {
      this.refreshMetrics();
    }, config.interval.asMilliseconds());

    const metricsObservable = this.metrics$.asObservable();

    this.setupAnalyticsContextAndEvents(analytics);

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

  private setupAnalyticsContextAndEvents(analytics: AnalyticsServiceSetup) {
    // we don't need to enrich with any context here,

    // note: there must be a shortcut way of using the typescript type to map an EBT schema!!!
    // Can I use MakeSchemaFrom (defined in )
    const schema: RootSchema<Pick<OpsMetrics, 'collected_at' | 'process'>> = {
      collected_at: {
        type: 'date',
        _meta: { description: 'Time metrics were recorded at.' },
      },
      process: {
        properties: {
          pid: {
            type: 'number',
            _meta: { description: '' },
          },
          memory: {
            properties: {
              heap: {
                properties: {
                  total_in_bytes: {
                    type: 'number',
                    _meta: { description: '' },
                  },
                  used_in_bytes: {
                    type: 'number',
                    _type: { description: '' },
                  },
                  size_limit: {
                    type: 'number',
                    _type: { description: '' },
                  },
                },
              },
              resident_set_size_in_bytes: {
                type: 'number',
                _meta: { description: '' },
              },
            },
          },
          event_loop_delay: {
            type: 'number',
            _meta: { description: '' },
          },
          event_loop_delay_histogram: {
            properties: {
              fromTimestamp: {
                type: 'string',
                _meta: {
                  description:
                    'The first timestamp the interval timer kicked in for collecting data points.',
                },
              },
              lastUpdatedAt: {
                type: 'string',
                _meta: {
                  description:
                    'Last timestamp the interval timer kicked in for collecting data points.',
                },
              },
              min: {
                type: 'number',
                _meta: { description: 'The minimum recorded event loop delay.' },
              },
              max: {
                type: 'number',
                _meta: { description: 'The maximum recorded event loop delay.' },
              },
              mean: {
                type: 'number',
                _meta: { description: 'The mean of the recorded event loop delays.' },
              },
              exceeds: {
                type: 'number',
                _meta: {
                  description:
                    'The number of times the event loop delay exceeded the maximum 1 hour event loop delay threshold.',
                },
              },
              stddev: {
                type: 'number',
                _meta: { description: 'The standard deviation of the recorded event loop delays.' },
              },
              percentiles: {
                properties: {
                  // note: I need a string key here while the original datum key is a number
                  '50': {
                    type: 'number',
                    _meta: {
                      description: '50th percentile of delays of the collected data points.',
                    },
                  },
                  '75': {
                    type: 'number',
                    _meta: {
                      description: '75th percentile of delays of the collected data points.',
                    },
                  },
                  '95': {
                    type: 'number',
                    _meta: {
                      description: '95th percentile of delays of the collected data points.',
                    },
                  },
                  '99': {
                    type: 'number',
                    _meta: {
                      description: '99th percentile of delays of the collected data points.',
                    },
                  },
                },
              },
            },
          },
          uptime_in_millis: {
            type: 'number',
            _meta: { description: '' },
          },
        },
      },
    };
  }

  private async refreshMetrics() {
    const metrics = await this.metricsCollector!.collect();
    const { message, meta } = getEcsOpsMetricsLog(metrics);
    this.opsMetricsLogger.debug(message!, meta);
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
export interface OpsMetricsPayload {
  collected_at: 'date';
  process: SchemaObject<OpsProcessMetrics>;
}
