/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ProductName } from './product';

export const LATEST_MANIFEST_FORMAT_VERSION = '2.0.0';

export interface ArtifactManifest {
  formatVersion: string;
  productName: ProductName;
  productVersion: string;
}
