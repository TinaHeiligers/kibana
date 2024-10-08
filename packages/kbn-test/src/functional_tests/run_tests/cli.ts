/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { run } from '@kbn/dev-cli-runner';

import { initLogsDir } from '../lib/logs_dir';
import { runTests } from './run_tests';
import { parseFlags, FLAG_OPTIONS } from './flags';

export function runTestsCli() {
  run(
    async ({ flagsReader, log }) => {
      const options = parseFlags(flagsReader);

      if (options.logsDir) {
        initLogsDir(log, options.logsDir);
      }

      await runTests(log, options);
    },
    {
      description: `Run Functional Tests`,
      usage: `
      Usage:
        node scripts/functional_tests --help
        node scripts/functional_tests [--config <file1> [--config <file2> ...]]
        node scripts/functional_tests [options] [-- --<other args>]
      `,
      flags: FLAG_OPTIONS,
    }
  );
}
