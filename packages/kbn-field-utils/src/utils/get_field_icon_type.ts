/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { type DataViewField } from '@kbn/data-views-plugin/common';
import { isKnownFieldType } from './field_types';
import { getFieldType } from './get_field_type';
import type { FieldBase, GetCustomFieldType } from '../types';

/**
 * Returns an icon type for a field
 * @param field
 * @param getCustomFieldType
 * @public
 */
export function getFieldIconType<T extends FieldBase = DataViewField>(
  field: T,
  getCustomFieldType?: GetCustomFieldType<T>
): string {
  const type = getCustomFieldType ? getCustomFieldType(field) : getFieldType<T>(field);
  const esType = field.esTypes?.[0] || null;
  if (esType && ['_id', '_index', '_ignored'].includes(esType) && type === 'string') {
    return 'keyword';
  }
  if (type === 'unknown' && esType && isKnownFieldType(esType)) {
    return esType;
  }
  return type === 'string' && esType ? esType : type;
}
