/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as t from 'io-ts';

export const meta = t.object;
export type Meta = t.TypeOf<typeof meta>;
export const metaOrUndefined = t.union([meta, t.undefined]);
export type MetaOrUndefined = t.TypeOf<typeof metaOrUndefined>;

export const nullableMetaOrUndefined = t.union([metaOrUndefined, t.null]);
export type NullableMetaOrUndefined = t.TypeOf<typeof nullableMetaOrUndefined>;
