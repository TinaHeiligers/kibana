/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { SavedObjectsErrorHelpers } from '@kbn/core-saved-objects-server';
import type {
  SavedObjectsUpdateOptions,
  SavedObjectsUpdateResponse,
} from '@kbn/core-saved-objects-api-server';
import { DEFAULT_RETRY_COUNT } from '../../constants';
import { isValidRequest } from '../utils';
import type { ApiExecutionContext } from '../types';
import { executeUpdate } from '../update';

export interface PerformUpdateParams<T = unknown> {
  type: string;
  id: string;
  attributes: T;
  options: SavedObjectsUpdateOptions<T>;
}

export const executeUpdateRetryOnConflict = async <T>(
  updateParams: PerformUpdateParams<T>,
  apiContext: ApiExecutionContext
): Promise<SavedObjectsUpdateResponse<T>> => {
  const { type, id, options } = updateParams;
  const { allowedTypes, helpers } = apiContext;
  const namespace = helpers.common.getCurrentNamespace(options.namespace);

  // check request is valid
  const { validRequest, error } = isValidRequest({ allowedTypes, type, id });
  if (!validRequest && error) {
    throw error;
  }

  const maxAttempts = options.version ? 1 : 1 + DEFAULT_RETRY_COUNT;

  // handle retryOnConflict manually by reattempting the operation in case of conflict errors
  let response: SavedObjectsUpdateResponse<T>;
  for (let currentAttempt = 1; currentAttempt <= maxAttempts; currentAttempt++) {
    try {
      response = await executeUpdate(updateParams, apiContext, { namespace });
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
