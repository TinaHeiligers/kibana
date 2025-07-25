/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * React component for rendering EuiEmptyPrompt when no results were found.
 */

import type { FC } from 'react';
import React from 'react';
import { EuiEmptyPrompt } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { Entity } from '../entity_control/entity_control';

export const TimeseriesexplorerNoChartData: FC<{
  dataNotChartable?: boolean;
  entities?: Entity[];
}> = ({ dataNotChartable, entities }) => (
  <EuiEmptyPrompt
    iconType="info"
    title={
      <h2>
        {i18n.translate('xpack.ml.timeSeriesExplorer.noResultsFoundLabel', {
          defaultMessage: 'No results found',
        })}
      </h2>
    }
    body={
      dataNotChartable ? (
        <p>
          {i18n.translate('xpack.ml.timeSeriesExplorer.dataNotChartableDescription', {
            defaultMessage: `Model plot is not collected for the selected {entityCount, plural, one {entity} other {entities}}
and the source data cannot be plotted for this detector.`,
            values: {
              entityCount: entities!.length,
            },
          })}
        </p>
      ) : (
        <p>
          {i18n.translate('xpack.ml.timeSeriesExplorer.tryWideningTheTimeSelectionDescription', {
            defaultMessage: 'Try widening the time selection or moving further back in time.',
          })}
        </p>
      )
    }
  />
);
