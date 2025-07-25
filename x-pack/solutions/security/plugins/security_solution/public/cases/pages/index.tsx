/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { CaseViewRefreshPropInterface } from '@kbn/cases-plugin/common';
import { CaseMetricsFeature } from '@kbn/cases-plugin/common';
import { useExpandableFlyoutApi } from '@kbn/expandable-flyout';
import type { CaseViewAlertsTableProps } from '@kbn/cases-plugin/public/components/case_view/types';
import { TableId } from '@kbn/securitysolution-data-table';
import { IOCPanelKey } from '../../flyout/ai_for_soc/constants/panel_keys';
import { DetectionEngineAlertsTable } from '../../detections/components/alerts_table';
import { CaseDetailsRefreshContext } from '../../common/components/endpoint';
import { DocumentDetailsRightPanelKey } from '../../flyout/document_details/shared/constants/panel_keys';
import { RulePanelKey } from '../../flyout/rule_details/right';
import { TimelineId } from '../../../common/types/timeline';
import { useKibana, useNavigation } from '../../common/lib/kibana';
import {
  APP_ID,
  CASES_PATH,
  SECURITY_FEATURE_ID,
  SecurityPageName,
} from '../../../common/constants';
import { timelineActions } from '../../timelines/store';
import { SecuritySolutionPageWrapper } from '../../common/components/page_wrapper';
import { getEndpointDetailsPath } from '../../management/common/routing';
import { SpyRoute } from '../../common/utils/route/spy_routes';
import { useInsertTimeline } from '../components/use_insert_timeline';
import { useUserPrivileges } from '../../common/components/user_privileges';
import * as timelineMarkdownPlugin from '../../common/components/markdown_editor/plugins/timeline';
import { useFetchAlertData } from './use_fetch_alert_data';
import { useUpsellingMessage } from '../../common/hooks/use_upselling';
import { useFetchNotes } from '../../notes/hooks/use_fetch_notes';
import { DocumentEventTypes } from '../../common/lib/telemetry';
import { AiForSOCAlertsTable } from '../components/ai_for_soc/wrapper';

const CaseContainerComponent: React.FC = () => {
  const {
    application: { capabilities },
    cases,
    telemetry,
  } = useKibana().services;
  const { getAppUrl, navigateTo } = useNavigation();
  const userCasesPermissions = cases.helpers.canUseCases([APP_ID]);
  const dispatch = useDispatch();
  const { openFlyout } = useExpandableFlyoutApi();
  const {
    timelinePrivileges: { read: canSeeTimeline },
  } = useUserPrivileges();

  const interactionsUpsellingMessage = useUpsellingMessage('investigation_guide_interactions');

  // TODO We shouldn't have to check capabilities here, this should be done at a much higher level.
  //  https://github.com/elastic/kibana/issues/218741
  const AIForSOC = capabilities[SECURITY_FEATURE_ID].configurations;

  const showAlertDetails = useCallback(
    (alertId: string, index: string) => {
      //  For the AI for SOC we need to show the AI alert flyout.
      if (AIForSOC) {
        openFlyout({
          right: {
            id: IOCPanelKey,
            params: {
              id: alertId,
              indexName: index,
            },
          },
        });
      } else {
        openFlyout({
          right: {
            id: DocumentDetailsRightPanelKey,
            params: {
              id: alertId,
              indexName: index,
              scopeId: TimelineId.casePage,
            },
          },
        });
        telemetry.reportEvent(DocumentEventTypes.DetailsFlyoutOpened, {
          location: TimelineId.casePage,
          panel: 'right',
        });
      }
    },
    [AIForSOC, openFlyout, telemetry]
  );

  const renderAlertsTable = useCallback(
    (props: CaseViewAlertsTableProps) => {
      //  For the AI for SOC we need to show the Alert summary page alerts table.
      if (AIForSOC) {
        return <AiForSOCAlertsTable id={props.id} onLoaded={props.onLoaded} query={props.query} />;
      } else {
        return <DetectionEngineAlertsTable tableType={TableId.alertsOnCasePage} {...props} />;
      }
    },
    [AIForSOC]
  );

  const onRuleDetailsClick = useCallback(
    (ruleId: string | null | undefined) => {
      if (ruleId) {
        openFlyout({ right: { id: RulePanelKey, params: { ruleId } } });
      }
    },
    [openFlyout]
  );

  const { onLoad: onAlertsTableLoaded } = useFetchNotes();

  const endpointDetailsHref = (endpointId: string) =>
    getAppUrl({
      path: getEndpointDetailsPath({
        name: 'endpointActivityLog',
        selected_endpoint: endpointId,
      }),
    });

  const refreshRef = useRef<CaseViewRefreshPropInterface>(null);

  useEffect(() => {
    dispatch(
      timelineActions.createTimeline({
        id: TimelineId.casePage,
        columns: [],
        dataViewId: null,
        indexNames: [],
        show: false,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SecuritySolutionPageWrapper noPadding>
      <CaseDetailsRefreshContext.Provider value={refreshRef}>
        {cases.ui.getCases({
          basePath: CASES_PATH,
          owner: [APP_ID],
          features: {
            metrics: [
              CaseMetricsFeature.ALERTS_COUNT,
              CaseMetricsFeature.ALERTS_USERS,
              CaseMetricsFeature.ALERTS_HOSTS,
              CaseMetricsFeature.CONNECTORS,
              CaseMetricsFeature.LIFESPAN,
            ],
            alerts: { isExperimental: false },
          },
          refreshRef,
          actionsNavigation: {
            href: endpointDetailsHref,
            onClick: (endpointId: string, e) => {
              if (e) {
                e.preventDefault();
              }
              return navigateTo({
                path: getEndpointDetailsPath({
                  name: 'endpointActivityLog',
                  selected_endpoint: endpointId,
                }),
              });
            },
          },
          ruleDetailsNavigation: {
            onClick: onRuleDetailsClick,
          },
          showAlertDetails,
          timelineIntegration: {
            editor_plugins: {
              parsingPlugin: timelineMarkdownPlugin.parser,
              processingPluginRenderer: timelineMarkdownPlugin.renderer,
              uiPlugin: timelineMarkdownPlugin.plugin({
                interactionsUpsellingMessage,
                canSeeTimeline,
              }),
            },
            hooks: {
              useInsertTimeline,
            },
          },
          useFetchAlertData,
          onAlertsTableLoaded,
          permissions: userCasesPermissions,
          renderAlertsTable,
        })}
      </CaseDetailsRefreshContext.Provider>
      <SpyRoute pageName={SecurityPageName.case} />
    </SecuritySolutionPageWrapper>
  );
};

export const Cases = React.memo(CaseContainerComponent);
