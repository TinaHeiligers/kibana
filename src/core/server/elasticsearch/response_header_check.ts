/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

/**
 * Response headers check to determine if the response is from Elasticsearch
 * @param headers Response headers
 * @returns boolean
 */
export const PRODUCT_HEADER = 'x-elastic-product';
// Elasticsearch adds this header to responses it sends to Kibana

export const isSupportedEsServer = (headers: Record<string, unknown> | null) => {
  return !!headers && headers[PRODUCT_HEADER] === 'Elasticsearch';
};
