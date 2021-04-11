/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

/*
 * This file provides logic for migrating raw documents.
 */
import {
  SavedObjectsRawDoc,
  SavedObjectsSerializer,
  SavedObjectUnsanitizedDoc,
} from '../../serialization';
import { MigrateAndConvertFn } from './document_migrator';
import { SavedObjectsMigrationLogger } from '.';

/**
 * Error thrown when saved object migrations encounter a corrupt saved object.
 * Corrupt saved objects cannot be serialized because:
 *  - there's no `[type]` property which contains the type attributes
 *  - the type or namespace in the _id doesn't match the `type` or `namespace`
 *    properties
 */
export class CorruptSavedObjectError extends Error {
  constructor(public readonly rawId: string) {
    super(`Unable to migrate the corrupt saved object document(s) with _id: '${rawId}'.`);

    // Set the prototype explicitly, see:
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, CorruptSavedObjectError.prototype);
  }
}

/**
 * Applies the specified migration function to every saved object document in the list
 * of raw docs. Any raw docs that are not valid saved objects will simply be passed through.
 *
 * @param {TransformFn} migrateDoc
 * @param {SavedObjectsRawDoc[]} rawDocs
 * @returns {SavedObjectsRawDoc[]}
 */
export async function migrateRawDocs(
  serializer: SavedObjectsSerializer,
  migrateDoc: MigrateAndConvertFn,
  rawDocs: SavedObjectsRawDoc[],
  log: SavedObjectsMigrationLogger
): Promise<SavedObjectsRawDoc[]> {
  const migrateDocWithoutBlocking = transformNonBlocking(migrateDoc);
  const processedDocs = [];
  for (const raw of rawDocs) {
    const options = { namespaceTreatment: 'lax' as const };
    if (serializer.isRawSavedObject(raw, options)) {
      const savedObject = serializer.rawToSavedObject(raw, options);
      savedObject.migrationVersion = savedObject.migrationVersion || {};
      processedDocs.push(
        ...(await migrateDocWithoutBlocking(savedObject)).map((attrs) =>
          serializer.savedObjectToRaw({
            references: [],
            ...attrs,
          })
        )
      );
    } else {
      throw new CorruptSavedObjectError(raw._id);
    }
  }
  return processedDocs;
}

/** TINA: approach options for https://github.com/elastic/kibana/issues/90279:
 * don't log the errors
 * return a list of processed docs and errors
 * log those errors somewhere upstream in the next method that returns a complete list (using a new log message "corrupt-saved-object-${index-prefix}-${doc._id}" type)
 *
 * Thoughts:
 * Could we rather throw an error containing all the so ids that couldn't be transformed as the either.left option? If we do that
 * we can parse out the ids later on to report those
 *
 * OR:
 * go back to returning both arrays and let the model handle the control flow and decision making of what to do with the two arrays and what they represent.
 */
export interface DocumentsTransformResult {
  processedDocs: SavedObjectsRawDoc[];
  failedDocsIds: string[];
}

export async function migrateRawDocsNonThrowing(
  serializer: SavedObjectsSerializer,
  migrateDoc: MigrateAndConvertFn,
  rawDocs: SavedObjectsRawDoc[],
  log: SavedObjectsMigrationLogger
  // This method should never fail because we're returning an array of something, either transformed raw saved objects or an array of saved object ids.
  // According to the docs we should be using a Task for process that will never fail
): Promise<DocumentsTransformResult> {
  const migrateDocWithoutBlocking = transformNonBlocking(migrateDoc);
  const processedDocs: SavedObjectsRawDoc[] = [];
  const corruptSavedObjectsIds: string[] = [];
  try {
    for (const raw of rawDocs) {
      const options = { namespaceTreatment: 'lax' as const };
      if (serializer.isRawSavedObject(raw, options)) {
        const savedObject = serializer.rawToSavedObject(raw, options);
        savedObject.migrationVersion = savedObject.migrationVersion || {};
        processedDocs.push(
          ...(await migrateDocWithoutBlocking(savedObject)).map((attrs) =>
            serializer.savedObjectToRaw({
              references: [],
              ...attrs,
            })
          )
        );
      } else {
        // should we be pushing only the id onto this array or the whole doc?
        corruptSavedObjectsIds.push(raw._id);
      }
    }
    return { processedDocs, failedDocsIds: corruptSavedObjectsIds };
  } catch (e) {
    throw e;
  }
}
/**
 * Migration transform functions are potentially CPU heavy e.g. doing decryption/encryption
 * or (de)/serializing large JSON payloads.
 * Executing all transforms for a batch in a synchronous loop can block the event-loop for a long time.
 * To prevent this we use setImmediate to ensure that the event-loop can process other parallel
 * work in between each transform.
 */
function transformNonBlocking(
  transform: MigrateAndConvertFn
): (doc: SavedObjectUnsanitizedDoc) => Promise<SavedObjectUnsanitizedDoc[]> {
  // promises aren't enough to unblock the event loop
  return (doc: SavedObjectUnsanitizedDoc) =>
    new Promise((resolve, reject) => {
      // set immediate is though
      setImmediate(() => {
        try {
          resolve(transform(doc));
        } catch (e) {
          reject(e);
        }
      });
    });
}
