/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * and the Server Side Public License, v 1; you may not use this file except in
 * compliance with, at your election, the Elastic License or the Server Side
 * Public License, v 1.
 */

import * as kbnTestServer from '../../../test_helpers/kbn_server';
import { InternalCoreSetup } from '../../internal_types';
import { Root } from '../../root';
import { OpsMetrics } from '../types';

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
          pattern: '%message|%meta',
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

describe('metrics service', () => {
  let root: Root;
  let coreSetup: InternalCoreSetup;
  let mockConsoleLog: jest.SpyInstance;
  let testData: OpsMetrics;

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
      expect(testData).toBeTruthy();
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const [message, meta] = mockConsoleLog.mock.calls[0][0].split('|');
      // the contents of the message are variable based on the process environment,
      // so we are only performing assertions against parts of the string
      expect(message.includes('memory')).toBe(true);
      expect(message.includes('uptime')).toBe(true);
      expect(message.includes('load')).toBe(true);
      expect(message.includes('delay')).toBe(true);
      expect(JSON.parse(meta).kind).toBe('metric');
      expect(Object.keys(JSON.parse(meta).host.os.load)).toEqual(['1m', '5m', '15m']);
    });
  });
});
