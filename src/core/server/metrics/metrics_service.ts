/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { firstValueFrom, ReplaySubject, Subject, Subscription, takeUntil, tap } from 'rxjs';
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
  private readonly stop$ = new Subject<void>();

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

    // const metricsObservable: Observable<OpsMetrics>
    const metricsObservable = this.metrics$.asObservable();

    analytics.registerEventType<OpsMetrics>({
      eventType: 'core-ops_metrics',
      schema: opsMetricsSchema,
    });
    // should we not be reporting the metrics during the start lifecycle?
    this.reportOpsMetrics(analytics);

    this.service = {
      collectionInterval: config.interval.asMilliseconds(),
      getOpsMetrics$: () => metricsObservable,
    };

    return this.service;
  }

  private reportOpsMetrics(analytics: AnalyticsServiceSetup) {
    this.service
      ?.getOpsMetrics$()
      // @ts-expect-error-error
      // Argument of type 'OpsMetrics' is not assignable to parameter of type 'Record<string, unknown>'.
      // Index signature for type 'string' is missing in type 'OpsMetrics'.ts(2345)
      .subscribe((metrics: OpsMetrics) => analytics.reportEvent('core-ops_metrics', metrics));
  }

  public async start(): Promise<InternalMetricsServiceStart> {
    if (!this.service) {
      throw new Error('#setup() needs to be run first');
    }

    return this.service;
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
    this.stop$.next();
    this.stop$.complete();
  }
}
export interface OpsMetricsPayload {
  collected_at: 'date';
  process: SchemaObject<OpsProcessMetrics>;
}

const opsMetricsSchema: RootSchema<OpsMetrics> = {
  collected_at: {
    type: 'date',
    _meta: { description: 'Time metrics were recorded at.' },
  },
  process: {
    properties: {
      pid: {
        type: 'long',
        _meta: { description: 'pid of the kibana process' },
      },
      memory: {
        properties: {
          heap: {
            properties: {
              total_in_bytes: {
                type: 'byte',
                _meta: { description: '/** total heap available */' },
              },
              used_in_bytes: {
                type: 'byte',
                _meta: { description: '/** used heap */' },
              },
              size_limit: {
                type: 'byte',
                _meta: { description: '/** v8 heap size limit */' },
              },
            },
          },
          resident_set_size_in_bytes: {
            type: 'byte',
            _meta: { description: 'node rss' },
          },
        },
        _meta: {
          description: 'heap memory usage',
          optional: false,
        },
      },
      event_loop_delay: {
        type: 'long',
        _meta: { description: 'mean event loop delay since last collection' },
      },
      event_loop_delay_histogram: {
        properties: {
          fromTimestamp: {
            type: 'date',
            _meta: { description: '' },
          },
          lastUpdatedAt: {
            type: 'date',
            _meta: { description: '' },
          },
          min: {
            type: 'long',
            _meta: { description: '' },
          },
          max: {
            type: 'long',
            _meta: { description: '' },
          },
          mean: {
            type: 'long',
            _meta: { description: '' },
          },
          exceeds: {
            type: 'long',
            _meta: { description: '' },
          },
          stddev: {
            type: 'long',
            _meta: { description: '' },
          },
          percentiles: {
            properties: {
              '50': {
                type: 'long',
                _meta: { description: '50th percentile' },
              },
              '75': {
                type: 'long',
                _meta: { description: '75th percentile' },
              },
              '95': {
                type: 'long',
                _meta: { description: '95th percentile' },
              },
              '99': {
                type: 'long',
                _meta: { description: '99th percentile' },
              },
            },
          },
        },
        _meta: {
          description: 'node event loop delay histogram since last collection',
          optional: false,
        },
      },
      uptime_in_millis: {
        type: 'long',
        _meta: { description: 'uptime of the kibana process' },
      },
    },
    _meta: {
      description: 'Process related metrics.',
      optional: false,
    },
  },
  processes: {
    type: 'array',
    items: {
      properties: {
        pid: {
          type: 'long',
          _meta: { description: 'pid of the kibana process' },
        },
        memory: {
          properties: {
            heap: {
              properties: {
                total_in_bytes: {
                  type: 'byte',
                  _meta: { description: '/** total heap available */' },
                },
                used_in_bytes: {
                  type: 'byte',
                  _meta: { description: '/** used heap */' },
                },
                size_limit: {
                  type: 'byte',
                  _meta: { description: '/** v8 heap size limit */' },
                },
              },
            },
            resident_set_size_in_bytes: {
              type: 'byte',
              _meta: { description: 'node rss' },
            },
          },
          _meta: {
            description: 'heap memory usage',
            optional: false,
          },
        },
        event_loop_delay: {
          type: 'pass_through',
          _meta: { description: 'mean event loop delay since last collection' },
        },
        event_loop_delay_histogram: {
          type: 'pass_through',
          _meta: { description: 'node event loop delay histogram since last collection' },
        },
        uptime_in_millis: {
          type: 'pass_through',
          _meta: { description: 'uptime of the kibana process' },
        },
      },
      _meta: {
        description: 'Process related metrics.',
        optional: false,
      },
    },
  },
  os: {
    properties: {
      platform: {
        type: 'text',
        _meta: { description: 'The os platform' },
      },
      platformRelease: {
        type: 'text',
        _meta: { description: 'The os platform release, prefixed by the platform name ' },
      },
      distro: {
        type: 'text',
        _meta: {
          description: 'The os distribution. Only present for linux platform',
          optional: true,
        },
      },
      distroRelease: {
        type: 'keyword',
        _meta: {
          description:
            'The os distrib release, prefixed by the os distrib. Only present for linux platforms',
          optional: true,
        },
      },
      load: {
        properties: {
          '1m': {
            type: 'long',
            _meta: { description: 'load for last minute' },
          },
          '5m': {
            type: 'long',
            _meta: { description: 'load for last five minutes' },
          },
          '15m': {
            type: 'long',
            _meta: { description: 'load for last fifteen minutes' },
          },
        },
        _meta: {
          description: 'cpu load metrics',
          optional: false,
        },
      },
      memory: {
        properties: {
          total_in_bytes: {
            type: 'byte',
            _meta: { description: 'total memory available' },
          },
          free_in_bytes: {
            type: 'byte',
            _meta: { description: 'current free memory' },
          },
          used_in_bytes: {
            type: 'byte',
            _meta: { description: 'current used memory' },
          },
        },
      },
      uptime_in_millis: {
        type: 'date',
        _meta: { description: 'the OS uptime' },
      },
      cpuacct: {
        properties: {
          control_group: {
            type: 'text',
            _meta: { description: "name of this process's cgroup" },
          },
          usage_nanos: {
            type: 'date',
            _meta: { description: "cpu time used by this process's cgroup" },
          },
        },
        _meta: {
          description: 'cpu accounting metrics, undefined when not running in a cgroup',
          optional: true,
        },
      },
      cpu: {
        properties: {
          control_group: {
            type: 'text',
            _meta: { description: "name of this process's cgroup" },
          },
          cfs_period_micros: {
            type: 'long',
            _meta: { description: 'the length of the cfs period' },
          },
          cfs_quota_micros: {
            type: 'long',
            _meta: { description: 'total available run-time within a cfs period' },
          },
          stat: {
            properties: {
              number_of_elapsed_periods: {
                type: 'long',
                _meta: { description: 'number of cfs periods that elapsed' },
              },
              number_of_times_throttled: {
                type: 'long',
                _meta: { description: 'number of times the cgroup has been throttled' },
              },
              time_throttled_nanos: {
                type: 'long',
                _meta: {
                  description: 'total amount of time the cgroup has been throttled for',
                },
              },
            },
            _meta: {
              description: 'current stats on the cfs periods',
              optional: false,
            },
          },
        },
        _meta: {
          description: 'cpu accounting metrics, undefined when not running in a cgroup',
          optional: true,
        },
      },
    },
  },
  response_times: {
    properties: {
      avg_in_millis: {
        type: 'long',
        _meta: { description: 'average response time' },
      },
      max_in_millis: {
        type: 'long',
        _meta: { description: 'maximum response time' },
      },
    },
  },
  requests: {
    properties: {
      disconnects: {
        type: 'long',
        _meta: { description: 'number of disconnected requests since startup' },
      },
      total: {
        type: 'long',
        _meta: { description: 'total number of requests handled since startup' },
      },
      statusCodes: {
        // the responses can vary so we use a pass_through here
        type: 'pass_through',
        _meta: {
          description: 'number of request handled per response status code',
          optional: false,
        },
      },
    },
  },
  concurrent_connections: {
    type: 'long',
    _meta: { description: 'number of concurrent connections to the server' },
  },
};
