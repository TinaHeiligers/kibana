/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

/**
 * Error thrown when saved object migrations encounter a transformation error.
 * Transformation errors happen when a transform function throws an error for an unsanitized saved object
 * The id (doc.id) reported in this error class is just the uuid part and doesn't tell users what the full elasticsearch id is.
 * in order to convert the id to the serialized version further upstream using transform.generateRawId, we need to provide the following items:
 * - namespace: doc.namespace,
 * - type: doc.type,
 * - id: doc.id,
 */
export class TransformSavedObjectError extends Error {
  constructor(
    public readonly id_uuid_part: string,
    public readonly type: string,
    public readonly failedTransform: string,
    public readonly failedDoc: string,
    public readonly originalError: Error,
    public readonly namespace?: string
  ) {
    super(
      `Unable to transform the saved object document with id: '${id_uuid_part}', namespace: ${namespace}, type: ${type}, Transform: ${failedTransform}\nDoc: ${failedDoc}.`
    );

    // Set the prototype explicitly, see:
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, TransformSavedObjectError.prototype);
  }
}
