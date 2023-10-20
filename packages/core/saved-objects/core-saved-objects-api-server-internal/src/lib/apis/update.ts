/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { SavedObjectsErrorHelpers } from '@kbn/core-saved-objects-server';
import type {
  SavedObjectsBulkUpdateObject,
  SavedObjectsUpdateOptions,
  SavedObjectsUpdateResponse,
} from '@kbn/core-saved-objects-api-server';
import { DEFAULT_RETRY_COUNT } from '../constants';
import type { ApiExecutionContext } from './types';
// import { executeUpdate } from './internals';
import { performBulkUpdate } from './bulk_update';

export interface PerformUpdateParams<T = unknown> {
  type: string;
  id: string;
  attributes: T;
  options: SavedObjectsUpdateOptions<T>;
}
// #TODO: refactor to use BWC performBulkUpdate
export const performUpdate = async <T>(
  updateParams: PerformUpdateParams<T>,
  apiExecutionContext: ApiExecutionContext
): Promise<SavedObjectsUpdateResponse<T>> => {
  const { options } = updateParams;
  const { helpers } = apiExecutionContext;
  const { common: commonHelper } = helpers;

  const namespace = commonHelper.getCurrentNamespace(options.namespace);

  // Initial check on request validity moved to bulkUpdate, where it's checked against every object provided.

  const maxAttempts = options.version ? 1 : 1 + DEFAULT_RETRY_COUNT;
  const object: SavedObjectsBulkUpdateObject<T> = {
    type: updateParams.type,
    id: updateParams.id,
    attributes: updateParams.attributes,
    version: updateParams.options.version,
    references: updateParams.options.references,
    namespace,
    upsert: updateParams.options.upsert,
    migrationVersionCompatibility: updateParams.options.migrationVersionCompatibility,
  };

  // handle retryOnConflict manually by reattempting the operation in case of conflict errors
  let response: SavedObjectsUpdateResponse<T>;
  for (let currentAttempt = 1; currentAttempt <= maxAttempts; currentAttempt++) {
    try {
      // response = await executeUpdate(updateParams, apiExecutionContext, { namespace });
      response = (
        await performBulkUpdate(
          { objects: [object], options: { namespace, refresh: updateParams.options.refresh } },
          apiExecutionContext
        )
      ).saved_objects[0];
      // all bulk operations from ES respond with 200. We'll need to interpret the final outcome to manually throw if operation failed from conflict error
      break;
    } catch (e) {
      if (
        SavedObjectsErrorHelpers.isConflictError(e) &&
        e.retryableConflict &&
        currentAttempt < maxAttempts
      ) {
        continue;
      }
      throw e;
    }
  }
  return response!;
};
