/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { SavedObjectsErrorHelpers } from '@kbn/core-saved-objects-server';
import { ALL_NAMESPACES_STRING } from '@kbn/core-saved-objects-utils-server';

export const isValidRequest = ({
  allowedTypes,
  type,
  id,
  objectNamespace,
}: {
  allowedTypes: string[];
  type: string;
  id?: string;
  objectNamespace?: string;
}) => {
  if (!id) {
    return {
      validRequest: false,
      error: SavedObjectsErrorHelpers.createBadRequestError('id cannot be empty'),
    };
  } else if (!allowedTypes.includes(type)) {
    return {
        validRequest: false,
        error: SavedObjectsErrorHelpers.createGenericNotFoundError(type, id),
      }
  } else if (objectNamespace === ALL_NAMESPACES_STRING) {
    return {
      ValidRequest: false,
      error: SavedObjectsErrorHelpers.createBadRequestError('"namespace" cannot be "*"');
    }
  } else {
    return {validRequest: true}
  }
};
