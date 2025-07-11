/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Fragment, useState, useContext } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { Moment } from 'moment';

import {
  EuiCodeBlock,
  EuiFlexGroup,
  EuiToolTip,
  EuiIcon,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiInMemoryTable,
  EuiLink,
  EuiSelect,
  EuiSpacer,
  EuiTitle,
  useGeneratedHtmlId,
} from '@elastic/eui';

import { PAGINATION } from '../../../../../common/constants';
import { ActionStateBadge, WatchStateBadge, SectionError, Error } from '../../../components';
import { useLoadWatchHistory, useLoadWatchHistoryDetail } from '../../../lib/api';
import { WatchDetailsContext } from '../watch_details_context';

const watchHistoryTimeSpanOptions = [
  {
    value: 'now-1h',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.1h', {
      defaultMessage: 'Last one hour',
    }),
  },
  {
    value: 'now-24h',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.24h', {
      defaultMessage: 'Last 24 hours',
    }),
  },
  {
    value: 'now-7d',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.7d', {
      defaultMessage: 'Last 7 days',
    }),
  },
  {
    value: 'now-30d',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.30d', {
      defaultMessage: 'Last 30 days',
    }),
  },
  {
    value: 'now-6M',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.6M', {
      defaultMessage: 'Last 6 months',
    }),
  },
  {
    value: 'now-1y',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.1y', {
      defaultMessage: 'Last 1 year',
    }),
  },
];

export const ExecutionHistoryPanel = () => {
  const { watchDetail: loadedWatch } = useContext(WatchDetailsContext);

  const [isActivated, setIsActivated] = useState<boolean | undefined>(undefined);
  const [detailWatchId, setDetailWatchId] = useState<string | undefined>(undefined);

  const [watchHistoryTimeSpan, setWatchHistoryTimeSpan] = useState<string>(
    watchHistoryTimeSpanOptions[0].value
  );

  if (isActivated === undefined) {
    // Set initial value for isActivated based on the watch we just loaded.
    const isActive = (loadedWatch.watchStatus && loadedWatch.watchStatus.isActive) || false;
    setIsActivated(isActive);
  }

  const {
    error: historyError,
    data: history,
    isLoading,
  } = useLoadWatchHistory(loadedWatch.id, watchHistoryTimeSpan);

  const { error: watchHistoryDetailsError, data: watchHistoryDetails } =
    useLoadWatchHistoryDetail(detailWatchId);

  const executionDetail = watchHistoryDetails
    ? JSON.stringify(watchHistoryDetails.details, null, 2)
    : '';

  const watchHistoryDetailFlyoutId = useGeneratedHtmlId({ prefix: 'watchFlyout' });
  const watchHistoryErrorDetailsFlyoutTitleId = useGeneratedHtmlId({ prefix: 'watchErrorFlyout' });

  if (historyError) {
    return (
      <Fragment>
        <EuiSpacer size="s" />
        <SectionError
          title={
            <FormattedMessage
              id="xpack.watcher.sections.watchHistory.watchExecutionErrorTitle"
              defaultMessage="Error loading execution history"
            />
          }
          error={historyError as unknown as Error}
        />
      </Fragment>
    );
  }
  const columns = [
    {
      field: 'startTime',
      name: i18n.translate('xpack.watcher.sections.watchHistory.watchTable.startTimeHeader', {
        defaultMessage: 'Trigger time',
      }),
      sortable: true,
      truncateText: false,
      // TODO: Once we convert the client-side models to TS, this should be a WatchHistoryItemModel.
      render: (startTime: Moment, item: any) => {
        const formattedDate = startTime.format();
        return (
          <EuiLink
            data-test-subj={`watchStartTimeColumn-${formattedDate}`}
            onClick={() => setDetailWatchId(item.id)}
          >
            {formattedDate}
          </EuiLink>
        );
      },
    },
    {
      field: 'watchStatus.state',
      name: (
        <EuiToolTip
          content={i18n.translate(
            'xpack.watcher.sections.watchHistory.watchTable.stateHeader.tooltipText',
            {
              defaultMessage: 'Active or error state.',
            }
          )}
        >
          <span>
            {i18n.translate('xpack.watcher.sections.watchHistory.watchTable.stateHeader', {
              defaultMessage: 'State',
            })}{' '}
            <EuiIcon size="s" color="subdued" type="question" className="eui-alignTop" />
          </span>
        </EuiToolTip>
      ),
      sortable: true,
      truncateText: true,
      render: (state: string) => <WatchStateBadge state={state} />,
    },
    {
      field: 'startTime',
      name: (
        <EuiToolTip
          content={i18n.translate(
            'xpack.watcher.sections.watchHistory.watchTable.metConditionHeader.tooltipText',
            {
              defaultMessage: 'Whether the condition was met and action taken.',
            }
          )}
        >
          <span>
            {i18n.translate('xpack.watcher.sections.watchHistory.watchTable.metConditionHeader', {
              defaultMessage: 'Condition met',
            })}{' '}
            <EuiIcon size="s" color="subdued" type="question" className="eui-alignTop" />
          </span>
        </EuiToolTip>
      ),
      sortable: true,
      truncateText: true,
      // TODO: Once we convert the client-side models to TS, this should be a WatchHistoryItemModel.
      render: (startTime: Moment, item: any) => {
        const {
          watchStatus: { lastExecution },
        } = item;

        if (startTime.isSame(lastExecution)) {
          return <EuiIcon color="green" type="check" />;
        }
      },
    },
    {
      field: 'watchStatus.comment',
      name: (
        <EuiToolTip
          content={i18n.translate(
            'xpack.watcher.sections.watchHistory.watchTable.commentHeader.tooltipText',
            {
              defaultMessage:
                'Whether the action was throttled, acknowledged, or failed to execute.',
            }
          )}
        >
          <span>
            {i18n.translate('xpack.watcher.sections.watchHistory.watchTable.commentHeader', {
              defaultMessage: 'Comment',
            })}{' '}
            <EuiIcon size="s" color="subdued" type="question" className="eui-alignTop" />
          </span>
        </EuiToolTip>
      ),
      sortable: true,
      truncateText: true,
    },
  ];

  const onTimespanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const timespan = e.target.value;
    setWatchHistoryTimeSpan(timespan);
  };

  let flyout;

  if (detailWatchId !== undefined) {
    if (watchHistoryDetailsError) {
      flyout = (
        <EuiFlyout
          data-test-subj="watchHistoryErrorDetailFlyout"
          onClose={() => setDetailWatchId(undefined)}
          aria-labelledby={watchHistoryErrorDetailsFlyoutTitleId}
          maxWidth={600}
        >
          <EuiFlyoutHeader>
            <EuiTitle size="s">
              <h3 data-test-subj="title" id={watchHistoryErrorDetailsFlyoutTitleId}>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.errorTitle"
                  defaultMessage="Execution details"
                />
              </h3>
            </EuiTitle>
          </EuiFlyoutHeader>

          <EuiFlyoutBody>
            <SectionError
              title={
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetailsErrorTitle"
                  defaultMessage="Error loading execution details"
                />
              }
              error={watchHistoryDetailsError as unknown as Error}
              data-test-subj="errorMessage"
            />
          </EuiFlyoutBody>
        </EuiFlyout>
      );
    }
    if (watchHistoryDetails !== undefined) {
      const detailColumns = [
        {
          field: 'id',
          name: i18n.translate('xpack.watcher.sections.watchHistory.watchActionStatusTable.id', {
            defaultMessage: 'Name',
          }),
          sortable: true,
          truncateText: false,
        },
        {
          field: 'state',
          name: (
            <EuiToolTip
              content={i18n.translate(
                'xpack.watcher.sections.watchHistory.watchActionStatusTable.state.tooltipText',
                {
                  defaultMessage: 'OK, acknowledged, throttled, or error.',
                }
              )}
            >
              <span>
                {i18n.translate(
                  'xpack.watcher.sections.watchHistory.watchActionStatusTable.state',
                  {
                    defaultMessage: 'State',
                  }
                )}{' '}
                <EuiIcon size="s" color="subdued" type="question" className="eui-alignTop" />
              </span>
            </EuiToolTip>
          ),
          sortable: true,
          truncateText: true,
          render: (state: string) => <ActionStateBadge state={state} />,
        },
      ];

      flyout = (
        <EuiFlyout
          data-test-subj="watchHistoryDetailFlyout"
          onClose={() => setDetailWatchId(undefined)}
          aria-labelledby={watchHistoryDetailFlyoutId}
          maxWidth={600}
        >
          <EuiFlyoutHeader>
            <EuiTitle size="s">
              <h3 data-test-subj="title" id={watchHistoryDetailFlyoutId}>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.title"
                  defaultMessage="Executed on {date}"
                  values={{ date: watchHistoryDetails.startTime?.format() }}
                />
              </h3>
            </EuiTitle>
          </EuiFlyoutHeader>

          <EuiFlyoutBody>
            <EuiTitle size="xs">
              <h4>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.actionsTitle"
                  defaultMessage="Actions"
                />
              </h4>
            </EuiTitle>
            <EuiInMemoryTable
              items={(watchHistoryDetails.watchStatus as any).actionStatuses}
              itemId="id"
              columns={detailColumns}
              message={
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchTable.noWatchesMessage"
                  defaultMessage="No current status to show"
                />
              }
              data-test-subj="watchActionsTable"
            />
            <EuiSpacer />
            <EuiTitle size="xs">
              <h4>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.jsonTitle"
                  defaultMessage="JSON"
                />
              </h4>
            </EuiTitle>
            <EuiSpacer size="s" />
            <EuiCodeBlock language="json">{executionDetail}</EuiCodeBlock>
          </EuiFlyoutBody>
        </EuiFlyout>
      );
    }
  }

  return (
    <div data-test-subj="watchHistorySection">
      <EuiFlexGroup gutterSize="s" justifyContent="flexStart" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiSelect
            options={watchHistoryTimeSpanOptions}
            value={watchHistoryTimeSpan}
            onChange={onTimespanChange}
            aria-label={i18n.translate(
              'xpack.watcher.sections.watchHistory.changeTimespanSelectAriaLabel',
              {
                defaultMessage: 'Change timespan of watch history',
              }
            )}
          />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="s" />

      <EuiInMemoryTable
        items={history || []}
        columns={columns}
        pagination={PAGINATION}
        sorting={true}
        loading={isLoading}
        data-test-subj="watchHistoryTable"
        message={
          <FormattedMessage
            id="xpack.watcher.sections.watchHistory.watchTable.noCurrentStatus"
            defaultMessage="No execution history to show"
          />
        }
      />
      {flyout}
    </div>
  );
};
