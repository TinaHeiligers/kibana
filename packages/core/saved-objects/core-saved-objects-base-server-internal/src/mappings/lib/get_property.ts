/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { toPath } from 'lodash';
import type { SavedObjectsFieldMapping } from '@kbn/core-saved-objects-server';
import type { IndexMapping } from '../types';

function getPropertyMappingFromObjectMapping(
  mapping: IndexMapping | SavedObjectsFieldMapping,
  path: string[]
): SavedObjectsFieldMapping | undefined {
  const props =
    (mapping && (mapping as IndexMapping).properties) ||
    (mapping && (mapping as SavedObjectsFieldMapping).fields);

  if (!props) {
    return undefined;
  }

  if (path.length > 1) {
    return getPropertyMappingFromObjectMapping(props[path[0]], path.slice(1));
  } else {
    return props[path[0]];
  }
}

export function getProperty(
  mappings: IndexMapping | SavedObjectsFieldMapping,
  path: string | string[]
) {
  return getPropertyMappingFromObjectMapping(mappings, toPath(path));
}
