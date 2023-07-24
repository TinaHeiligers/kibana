/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { encodeVersion } from './encode_version';

/**
 * Helper for encoding a version from a "hit" (hits.hits[#] from _search) or
 * "doc" (body from GET, update, etc) object
 *
 * @example
 * GET my-index/_doc/specific_doc_id
 *
  {
    "_index": "my-index",
    "_id": "specific_doc_id",
    "_version": 1,
    "_seq_no": 5039035,
    "_primary_term": 1,
    "found": true,
    "_source": {
      "foo": "bar"
      },
   }
 *
 */
export function encodeHitVersion(response: { _seq_no?: number; _primary_term?: number }) {
  return encodeVersion(response._seq_no, response._primary_term);
}
