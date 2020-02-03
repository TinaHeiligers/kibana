/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useCallback, useContext, useEffect, useState, Fragment } from 'react';
import {
  EuiIcon,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiTitle,
  EuiLink,
  EuiFlyoutFooter,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonEmpty,
  EuiText,
  EuiBadge,
  EuiTabbedContent,
} from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n/react';
// eslint-disable-next-line
import { PulseChannel } from 'src/core/public/pulse/channel';
// eslint-disable-next-line
import { NotificationInstruction } from 'src/core/server/pulse/collectors/notifications';
import moment from 'moment';
// eslint-disable-next-line
import { ErrorInstruction } from 'src/core/server/pulse/collectors/errors';
import { EuiSpacer } from '@elastic/eui';
import { EuiHeaderAlert } from '../../../../legacy/core_plugins/newsfeed/public/np_ready/components/header_alert/header_alert';
import { NewsfeedContext, shouldUpdateHash, getLastItemHash } from './newsfeed_header_nav_button';
import { NewsfeedItem } from '../../types';
import { NewsEmptyPrompt } from './empty_news';
import { NewsLoadingPrompt } from './loading_news';
import { PulseNewsLoadingPrompt } from './loading_pulse_news';
import { PulseNewsEmptyPrompt } from './empty_pulse_news';

interface Props {
  notificationsChannel: PulseChannel<NotificationInstruction>;
  errorsChannel: PulseChannel<ErrorInstruction>;
  // errorsInstructionsToShow: ErrorInstruction[];
}

export const NewsfeedFlyout = ({
  notificationsChannel,
  errorsChannel,
}: // errorsInstructionsToShow,
Props) => {
  const { newsFetchResult, setFlyoutVisible } = useContext(NewsfeedContext);
  const [errorsInstructionsToShow, setErrorsInstructionsToShow] = useState<ErrorInstruction[]>([]);
  const [currentTab, setCurrentTab] = useState<any>({});
  const closeFlyout = useCallback(() => setFlyoutVisible(false), [setFlyoutVisible]);
  if (newsFetchResult && newsFetchResult.feedItems.length) {
    const lastNotificationHash = getLastItemHash(newsFetchResult.feedItems);
    const hasNew = newsFetchResult.feedItems.some(item => item.status === 'new');
    const shouldUpdateResults = hasNew || shouldUpdateHash(lastNotificationHash);
    if (shouldUpdateResults) {
      notificationsChannel.sendPulse(
        newsFetchResult.feedItems.map(feedItem => {
          return {
            ...feedItem,
            publishOn: feedItem.publishOn.format('x'),
            expireOn: feedItem.expireOn.format('x'),
            status: 'seen',
            seenOn: moment().format('x'),
          };
        })
      );
    }
  }
  // Errors Channel
  const errorsInstructions$ = errorsChannel.instructions$();
  // handle already filtered out instructions and
  useEffect(() => {
    function handleErrorsInstructionsChange(instructions: ErrorInstruction[]) {
      if (instructions.length) {
        setErrorsInstructionsToShow(instructions);
      }
    }
    const subscription = errorsInstructions$.subscribe(instructions => {
      if (instructions && instructions.length) {
        const newInstructions = instructions.filter(
          instruction =>
            // instruction.sendTo === 'newsfeed' && !fixedVersionsSeen.has(instruction.hash) --> removes these items from the list. We can still use the hash list to change the status of the messages shown in teh channel.
            instruction.fixedVersion && instruction.status === 'new' && !instruction.seenOn
        );
        handleErrorsInstructionsChange(newInstructions);
      }
    });
    return () => subscription.unsubscribe();
  }, [errorsInstructions$]);

  if (errorsInstructionsToShow && errorsInstructionsToShow.length > 0) {
    const hasNewErrorInstructionsToShow = errorsInstructionsToShow.filter(
      instruction => instruction.status === 'new' && !instruction.seenOn!
    );
    if (hasNewErrorInstructionsToShow.length > 0) {
      // eslint-disable-next-line no-console
      console.log('commented out changing status to seen for:', hasNewErrorInstructionsToShow);
      // errorsChannel.sendPulse(
      //   hasNewErrorInstructionsToShow.map(item => {
      //     return {
      //       ...item,
      //       status: 'seen',
      //       seenOn: moment().format('x'),
      //     };
      //   })
      // );
    }
  }
  const tabs = [
    {
      id: 'newsfeed',
      name: 'Elastic',
      content: !newsFetchResult ? (
        <NewsLoadingPrompt />
      ) : newsFetchResult.feedItems.length > 0 ? (
        newsFetchResult.feedItems.map((item: NewsfeedItem) => {
          return (
            <Fragment key={item.hash}>
              <EuiSpacer />
              <EuiHeaderAlert
                title={item.title}
                text={item.description}
                data-test-subj="newsHeadAlert"
                action={
                  <EuiLink target="_blank" href={item.linkUrl}>
                    {item.linkText}
                    <EuiIcon type="popout" size="s" />
                  </EuiLink>
                }
                date={moment(item.publishOn).format('DD MMMM YYYY')}
                badge={<EuiBadge color="hollow">{item.badge}</EuiBadge>}
              />
            </Fragment>
          );
        })
      ) : (
        <NewsEmptyPrompt />
      ),
    },
    {
      id: 'pulse',
      name: 'Pulse',
      content: errorsInstructionsToShow ? (
        errorsInstructionsToShow.length > 0 ? (
          errorsInstructionsToShow.map((item: ErrorInstruction, index: number) => {
            return (
              <Fragment key={index}>
                <EuiSpacer />
                <EuiHeaderAlert
                  title={item.hash}
                  text={`The error ${item.hash} has been fixed in version ${item.fixedVersion}.`}
                  action={
                    <EuiLink target="_blank" href="#">
                      {item.fixedVersion}
                    </EuiLink>
                  }
                  date={moment(item.timestamp).format('DD MMMM YYYY HH:MM:SS')}
                  badge={<EuiBadge color="hollow">{item.fixedVersion}</EuiBadge>}
                />
              </Fragment>
            );
          })
        ) : (
          <PulseNewsEmptyPrompt />
        )
      ) : (
        <PulseNewsLoadingPrompt />
      ),
    },
  ];

  return (
    <EuiFlyout
      onClose={closeFlyout}
      size="s"
      aria-labelledby="flyoutSmallTitle"
      className="kbnNews__flyout"
      data-test-subj="NewsfeedFlyout"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2 id="flyoutSmallTitle">
            <FormattedMessage
              id="newsfeed.flyoutList.whatsNewFromTitle"
              defaultMessage="What's new from"
            />
          </h2>
        </EuiTitle>
      </EuiFlyoutHeader>
      <EuiFlyoutBody className={'kbnNews__flyoutAlerts'}>
        <EuiTabbedContent
          expand={true}
          tabs={tabs}
          selectedTab={currentTab.id ? currentTab : tabs[0]}
          initialSelectedTab={tabs[0]}
          onTabClick={tab => {
            setCurrentTab(tab); // here I want to trigger some actions for Pulse when the focus changes to newsfeed
          }}
        />
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty iconType="cross" onClick={closeFlyout} flush="left">
              <FormattedMessage id="newsfeed.flyoutList.closeButtonLabel" defaultMessage="Close" />
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            {newsFetchResult ? (
              <EuiText color="subdued" size="s">
                <p>
                  <FormattedMessage
                    id="newsfeed.flyoutList.versionTextLabel"
                    defaultMessage="{version}"
                    values={{ version: `Version ${newsFetchResult.kibanaVersion}` }}
                  />
                </p>
              </EuiText>
            ) : null}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};
