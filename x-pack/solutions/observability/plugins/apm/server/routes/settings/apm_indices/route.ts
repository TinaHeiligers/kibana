/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import type { SavedObject } from '@kbn/core/server';
import type { APMIndices } from '@kbn/apm-sources-access-plugin/server';
import { saveApmIndices } from '@kbn/apm-sources-access-plugin/server/saved_objects/apm_indices';
import { createApmServerRoute } from '../../apm_routes/create_apm_server_route';
import type { ApmIndexSettingsResponse } from './get_apm_indices';
import { getApmIndexSettings } from './get_apm_indices';

// TODO: Deprecate and remove these API routes. https://github.com/elastic/kibana/issues/214570
// get list of apm indices and values
const apmIndexSettingsRoute = createApmServerRoute({
  endpoint: 'GET /internal/apm/settings/apm-index-settings',
  security: { authz: { requiredPrivileges: ['apm'] } },
  handler: async (
    resources
  ): Promise<{
    apmIndexSettings: ApmIndexSettingsResponse;
  }> => {
    const apmIndexSettings = await getApmIndexSettings(resources);
    return { apmIndexSettings };
  },
});

// TODO: Deprecate and remove these API routes. https://github.com/elastic/kibana/issues/214570
// get apm indices configuration object
const apmIndicesRoute = createApmServerRoute({
  endpoint: 'GET /internal/apm/settings/apm-indices',
  security: { authz: { requiredPrivileges: ['apm'] } },
  handler: async (resources): Promise<APMIndices> => {
    return await resources.getApmIndices();
  },
});

type SaveApmIndicesBodySchema = {
  [Property in keyof APMIndices]: t.StringC;
};

// TODO: Deprecate and remove these API routes. https://github.com/elastic/kibana/issues/214570
// save ui indices
const saveApmIndicesRoute = createApmServerRoute({
  endpoint: 'POST /internal/apm/settings/apm-indices/save',
  security: {
    authz: {
      requiredPrivileges: ['apm', 'apm_settings_write'],
    },
  },
  params: t.type({
    body: t.partial({
      error: t.string,
      onboarding: t.string,
      span: t.string,
      transaction: t.string,
      metric: t.string,
      // Keeping this one here for backward compatibility
      sourcemap: t.string,
    } as SaveApmIndicesBodySchema),
  }),
  handler: async (resources): Promise<SavedObject<{}>> => {
    const { params, context } = resources;
    const { body } = params;
    const savedObjectsClient = (await context.core).savedObjects.client;
    const indices = { ...body };
    if (indices.sourcemap) {
      // Delete this as we stopped supporting it from 8.7.
      delete indices.sourcemap;
    }

    return await saveApmIndices(savedObjectsClient, indices);
  },
});

export const apmIndicesRouteRepository = {
  ...apmIndexSettingsRoute,
  ...apmIndicesRoute,
  ...saveApmIndicesRoute,
};
