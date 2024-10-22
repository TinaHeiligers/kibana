/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { RouterDeprecatedRouteDetails, RouterRestrictedRouteDetails } from '@kbn/core-http-server';
import {
  CoreDeprecatedApiUsageStats,
  CoreRestrictedApiUsageStats,
} from '@kbn/core-usage-data-server';
import { i18n } from '@kbn/i18n';
import moment from 'moment';

export const getApiDeprecationTitle = (details: RouterDeprecatedRouteDetails) => {
  const { routePath, routeMethod, routeDeprecationOptions } = details;
  const deprecationType = routeDeprecationOptions.reason.type;
  const routeWithMethod = `${routeMethod.toUpperCase()} ${routePath}`;
  const restrictionTypeText = i18n.translate('core.deprecations.deprecations.apiDeprecationType', {
    defaultMessage:
      '{deprecationType, select, remove {is removed} bump {has a newer version available} migrate {is migrated to a different API} other {is deprecated}}',
    values: { deprecationType },
  });

  return i18n.translate('core.deprecations.deprecations.apiDeprecationInfoTitle', {
    defaultMessage: 'The "{routeWithMethod}" route {restrictionTypeText}',
    values: {
      routeWithMethod,
      restrictionTypeText,
    },
  });
};

export const getApiDeprecationMessage = (
  details: RouterDeprecatedRouteDetails,
  apiUsageStats: CoreDeprecatedApiUsageStats
): string[] => {
  const { routePath, routeMethod } = details;
  const { apiLastCalledAt, apiTotalCalls, markedAsResolvedLastCalledAt, totalMarkedAsResolved } =
    apiUsageStats;

  const diff = apiTotalCalls - totalMarkedAsResolved;
  const wasResolvedBefore = totalMarkedAsResolved > 0;
  const routeWithMethod = `${routeMethod.toUpperCase()} ${routePath}`;

  const messages = [
    i18n.translate('core.deprecations.deprecations.apiDeprecationApiCallsDetailsMessage', {
      defaultMessage:
        'The API "{routeWithMethod}" has been called {apiTotalCalls} times. The last call was on {apiLastCalledAt}.',
      values: {
        routeWithMethod,
        apiTotalCalls,
        apiLastCalledAt: moment(apiLastCalledAt).format('LLLL Z'),
      },
    }),
  ];

  if (wasResolvedBefore) {
    messages.push(
      i18n.translate(
        'core.deprecations.deprecations.apiDeprecationPreviouslyMarkedAsResolvedMessage',
        {
          defaultMessage:
            'This issue has been marked as resolved on {markedAsResolvedLastCalledAt} but the API has been called {timeSinceLastResolved, plural, one {# time} other {# times}} since.',
          values: {
            timeSinceLastResolved: diff,
            markedAsResolvedLastCalledAt: moment(markedAsResolvedLastCalledAt).format('LLLL Z'),
          },
        }
      )
    );
  }

  return messages;
};

export const getApiDeprecationsManualSteps = (details: RouterDeprecatedRouteDetails): string[] => {
  const { routeDeprecationOptions } = details;
  const deprecationType = routeDeprecationOptions.reason.type;

  const manualSteps = [
    i18n.translate('core.deprecations.deprecations.manualSteps.apiIseprecatedStep', {
      defaultMessage: 'Identify the origin of these API calls.',
    }),
  ];

  switch (deprecationType) {
    case 'bump': {
      const { newApiVersion } = routeDeprecationOptions.reason;
      manualSteps.push(
        i18n.translate('core.deprecations.deprecations.manualSteps.bumpDetailsStep', {
          defaultMessage:
            'Update the requests to use the following new version of the API instead: "{newApiVersion}".',
          values: { newApiVersion },
        })
      );
      break;
    }

    case 'remove': {
      manualSteps.push(
        i18n.translate('core.deprecations.deprecations.manualSteps.removeTypeExplainationStep', {
          defaultMessage:
            'This API no longer exists and no replacement is available. Delete any requests you have that use this API.',
        })
      );
      break;
    }
    case 'migrate': {
      const { newApiPath, newApiMethod } = routeDeprecationOptions.reason;
      const newRouteWithMethod = `${newApiMethod.toUpperCase()} ${newApiPath}`;

      manualSteps.push(
        i18n.translate('core.deprecations.deprecations.manualSteps.migrateDetailsStep', {
          defaultMessage:
            'Update the requests to use the following new API instead: "{newRouteWithMethod}".',
          values: { newRouteWithMethod },
        })
      );
      break;
    }
  }

  manualSteps.push(
    i18n.translate('core.deprecations.deprecations.manualSteps.markAsResolvedStep', {
      defaultMessage:
        'Check that you are no longer using the old API in any requests, and mark this issue as resolved. It will no longer appear in the Upgrade Assistant unless another call using this API is detected.',
    })
  );

  return manualSteps;
};

// @TINA TODO: implement similar getters for apiRestrictions
export const getApiRestrictionTitle = (details: RouterRestrictedRouteDetails) => {
  const { routePath, routeMethod } = details;
  const routeWithMethod = `${routeMethod.toUpperCase()} ${routePath}`;
  const restrictionTypeText = getApiRestrictionTypeText(details);

  return i18n.translate('core.deprecations.deprecations.apiRestrictionInfoTitle', {
    defaultMessage: 'The "{routeWithMethod}" route {restrictionTypeText}',
    values: {
      routeWithMethod,
      restrictionTypeText,
    },
  });
};

export const getApiRestrictionTypeText = (details: RouterRestrictedRouteDetails) => {
  const { routeRestrictionOptions } = details;
  const deprecationType = routeRestrictionOptions.reason.type;

  return i18n.translate('core.deprecations.deprecations.apiRestrictionType', {
    defaultMessage: '{deprecationType, select, restricted {is restricted}}',
    values: { deprecationType },
  });
};

export const getApiRestrictionMessage = (
  details: RouterRestrictedRouteDetails,
  apiUsageStats: CoreRestrictedApiUsageStats
) => {
  const { routePath, routeMethod } = details;
  const { apiLastCalledAt, apiTotalCalls, markedAsResolvedLastCalledAt, totalMarkedAsResolved } =
    apiUsageStats;

  const diff = apiTotalCalls - totalMarkedAsResolved;
  const wasResolvedBefore = totalMarkedAsResolved > 0;
  const routeWithMethod = `${routeMethod.toUpperCase()} ${routePath}`;

  const messages = [
    i18n.translate('core.deprecations.deprecations.apiRestrictionApiCallsDetailsMessage', {
      defaultMessage:
        'The API {routeWithMethod} has been called {apiTotalCalls} times. The API was last called on {apiLastCalledAt}.',
      values: {
        routeWithMethod,
        apiTotalCalls,
        apiLastCalledAt: moment(apiLastCalledAt).format('LLLL Z'),
      },
    }),
  ];

  if (wasResolvedBefore) {
    messages.push(
      i18n.translate(
        'core.deprecations.deprecations.apiRestrictionPreviouslyMarkedAsResolvedMessage',
        {
          defaultMessage:
            'This API has been marked as resolved before. It has been called {timeSinceLastResolved} times since it was marked as resolved on {markedAsResolvedLastCalledAt}.',
          values: {
            timeSinceLastResolved: diff,
            markedAsResolvedLastCalledAt: moment(markedAsResolvedLastCalledAt).format('LLLL Z'),
          },
        }
      )
    );
  }

  return messages.join('\n');
};

export const getApiRestrictionsManualSteps = (details: RouterRestrictedRouteDetails): string[] => {
  const { routeRestrictionOptions, routePath } = details;
  const { documentationUrl } = routeRestrictionOptions;
  const restrictionType = routeRestrictionOptions.reason.type;

  const manualSteps = [
    i18n.translate('core.deprecations.deprecations.manualSteps.apiIsRestrictedStep', {
      defaultMessage: 'This API {restrictionTypeText}',
      values: { restrictionTypeText: getApiRestrictionTypeText(details) },
    }),
  ];

  switch (restrictionType) {
    case 'restricted': {
      manualSteps.push(
        i18n.translate(
          'core.deprecations.deprecations.manualSteps.restrictedTypeExplainationStep',
          {
            defaultMessage:
              'A restricted deprecation means the API is restricted and will not be publically accessible.',
          }
        ),
        i18n.translate('core.deprecations.deprecations.manualSteps.restrictedDetailsStep', {
          defaultMessage: 'This API {routePath} is restricted.',
          values: { routePath },
        })
      );
      break;
    }
  }

  if (documentationUrl) {
    manualSteps.push(
      i18n.translate('core.deprecations.deprecations.manualSteps.documentationStep', {
        defaultMessage:
          'Click the learn more documentation link for more details on addressing the restricted API.',
      })
    );
  }

  manualSteps.push(
    i18n.translate('core.deprecations.deprecations.manualSteps.markAsResolvedStep', {
      defaultMessage:
        'Once you are no longer using the restricted API. You can click on the "Mark as Resolved" button to track if the API is still getting called.',
    }),
    i18n.translate('core.deprecations.deprecations.manualSteps.deprecationWillBeHiddenStep', {
      defaultMessage:
        'The deprecation will be hidden from the Upgrade Assistant unless the restricted API has been called again.',
    })
  );

  return manualSteps;
};
