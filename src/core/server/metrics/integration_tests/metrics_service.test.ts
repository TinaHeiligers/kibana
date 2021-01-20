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
      const expectedArray = ['memory:', 'uptime:', 'load:', 'delay:'];

      expect(testData).toBeTruthy(); // new it block
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const [message] = mockConsoleLog.mock.calls[0][0].split('|');

      const messageParts = message.split(' ');
      const testParts = [messageParts[0], messageParts[2], messageParts[4], messageParts[6]];
      // the contents of the message are variable based on the process environment,
      // so we are only performing assertions against parts of the string
      expect(testParts).toEqual(expect.arrayContaining(expectedArray));
    });

    it('logs structured data in the log meta', async () => {
      coreSetup.metrics.getOpsMetrics$().subscribe((opsMetrics) => {
        testData = opsMetrics;
      });
      const [, meta] = mockConsoleLog.mock.calls[0][0].split('|');
      expect(JSON.parse(meta).kind).toBe('metric'); // new it block
      expect(Object.keys(JSON.parse(meta).host.os.load)).toEqual(['1m', '5m', '15m']); // new it block
    });

    it('logs ECS fields in the log meta', async () => {
      coreSetup.metrics.getOpsMetrics$().subscribe((opsMetrics) => {
        testData = opsMetrics;
      });
      const [, meta] = mockConsoleLog.mock.calls[0][0].split('|');
      expect(JSON.parse(meta).kind).toBe('metric'); // new it block
      expect(JSON.parse(meta).ecs.version).toBe('1.7.0');
      expect(JSON.parse(meta).category).toEqual(expect.arrayContaining(['process', 'host']));
    });
  });
});
