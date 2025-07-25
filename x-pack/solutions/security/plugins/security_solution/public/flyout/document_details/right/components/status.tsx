/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC } from 'react';
import React, { useMemo } from 'react';
import { find } from 'lodash/fp';
import { FormattedMessage } from '@kbn/i18n-react';
import { AlertHeaderBlock } from '../../../shared/components/alert_header_block';
import { getEmptyTagValue } from '../../../../common/components/empty_value';
import { SIGNAL_STATUS_FIELD_NAME } from '../../../../timelines/components/timeline/body/renderers/constants';
import { StatusPopoverButton } from './status_popover_button';
import { useDocumentDetailsContext } from '../../shared/context';
import type { EnrichedFieldInfo, EnrichedFieldInfoWithValues } from '../utils/enriched_field_info';
import { getEnrichedFieldInfo } from '../utils/enriched_field_info';
import { CellActions } from '../../shared/components/cell_actions';
import { STATUS_TITLE_TEST_ID } from './test_ids';

/**
 * Checks if the field info has data to convert EnrichedFieldInfo into EnrichedFieldInfoWithValues
 */
function hasData(fieldInfo?: EnrichedFieldInfo): fieldInfo is EnrichedFieldInfoWithValues {
  return !!fieldInfo && Array.isArray(fieldInfo.values);
}

/**
 * Document details status displayed in flyout right section header
 */
export const DocumentStatus: FC = () => {
  const { eventId, browserFields, dataFormattedForFieldBrowser, scopeId, isRulePreview } =
    useDocumentDetailsContext();

  const statusData = useMemo(() => {
    const item = find(
      { field: SIGNAL_STATUS_FIELD_NAME, category: 'kibana' },
      dataFormattedForFieldBrowser
    );
    return (
      item &&
      getEnrichedFieldInfo({
        eventId,
        contextId: scopeId,
        scopeId,
        browserFields,
        item,
      })
    );
  }, [browserFields, dataFormattedForFieldBrowser, eventId, scopeId]);

  return (
    <AlertHeaderBlock
      hasBorder
      title={
        <FormattedMessage
          id="xpack.securitySolution.flyout.right.header.statusTitle"
          defaultMessage="Status"
        />
      }
      data-test-subj={STATUS_TITLE_TEST_ID}
    >
      {!statusData || !hasData(statusData) || isRulePreview ? (
        getEmptyTagValue()
      ) : (
        <CellActions field={SIGNAL_STATUS_FIELD_NAME} value={statusData.values[0]}>
          <StatusPopoverButton
            eventId={eventId}
            contextId={scopeId}
            enrichedFieldInfo={statusData}
            scopeId={scopeId}
          />
        </CellActions>
      )}
    </AlertHeaderBlock>
  );
};

DocumentStatus.displayName = 'DocumentStatus';
