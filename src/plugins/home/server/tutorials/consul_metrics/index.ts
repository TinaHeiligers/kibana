/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { i18n } from '@kbn/i18n';
import { TutorialsCategory } from '../../services/tutorials';
import {
  onPremInstructions,
  cloudInstructions,
  onPremCloudInstructions,
} from '../instructions/metricbeat_instructions';
import {
  TutorialContext,
  TutorialSchema,
} from '../../services/tutorials/lib/tutorials_registry_types';

export function consulMetricsSpecProvider(context: TutorialContext): TutorialSchema {
  const moduleName = 'consul';
  return {
    id: 'consulMetrics',
    name: i18n.translate('home.tutorials.consulMetrics.nameTitle', {
      defaultMessage: 'Consul Metrics',
    }),
    moduleName,
    category: TutorialsCategory.METRICS,
    shortDescription: i18n.translate('home.tutorials.consulMetrics.shortDescription', {
      defaultMessage: 'Collect metrics from Consul servers with Metricbeat.',
    }),
    longDescription: i18n.translate('home.tutorials.consulMetrics.longDescription', {
      defaultMessage:
        'The `consul` Metricbeat module fetches metrics from Consul. \
[Learn more]({learnMoreLink}).',
      values: {
        learnMoreLink: '{config.docs.beats.metricbeat}/metricbeat-module-consul.html',
      },
    }),
    euiIconType: context.staticAssets.getPluginAssetHref('/logos/consul.svg'),
    artifacts: {
      dashboards: [
        {
          id: '496910f0-b952-11e9-a579-f5c0a5d81340',
          linkLabel: i18n.translate('home.tutorials.consulMetrics.artifacts.dashboards.linkLabel', {
            defaultMessage: 'Consul metrics dashboard',
          }),
          isOverview: true,
        },
      ],
      exportedFields: {
        documentationUrl: '{config.docs.beats.metricbeat}/exported-fields-consul.html',
      },
    },
    completionTimeMinutes: 10,
    previewImagePath: context.staticAssets.getPluginAssetHref('/consul_metrics/screenshot.webp'),
    onPrem: onPremInstructions(moduleName, context),
    elasticCloud: cloudInstructions(moduleName, context),
    onPremElasticCloud: onPremCloudInstructions(moduleName, context),
    integrationBrowserCategories: ['observability', 'network'],
  };
}
