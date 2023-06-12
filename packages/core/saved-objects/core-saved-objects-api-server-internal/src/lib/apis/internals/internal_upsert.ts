/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { isNotFoundFromUnsupportedServer } from '@kbn/core-elasticsearch-server-internal';
import { MutatingOperationRefreshSetting } from '@kbn/core-saved-objects-api-server/src/apis';
import { decodeRequestVersion } from '@kbn/core-saved-objects-base-server-internal';
import {
  type ISavedObjectTypeRegistry,
  type ISavedObjectsSerializer,
  SavedObjectSanitizedDoc,
  SavedObjectsErrorHelpers,
  SavedObjectReference,
  SavedObjectsRawDoc,
} from '@kbn/core-saved-objects-server';
import type { RepositoryEsClient } from '../../repository_es_client';

import type { PreflightCheckNamespacesResult, RepositoryHelpers } from '../helpers';
/**
 PerformUpdateBWCParams<T = unknown> {
  type: string;
  id: string;
  attributes: T;
  options: SavedObjectsUpdateOptions<T>;
}
 */
function validateCreateObject(
  upsertRawMigrated: SavedObjectsRawDoc,
  migrationVersionCompatibility?: 'compatible' | 'raw',
  serializer: ISavedObjectsSerializer,
  validationHelper: RepositoryHelpers['validation'],
  type: string
) {
  const migratedUnsanitized = serializer.rawToSavedObject(upsertRawMigrated, {
    migrationVersionCompatibility,
  });
  try {
    validationHelper.validateObjectForCreate(type, migratedUnsanitized);
  } catch (err) {
    // ignore the error for now.
  }
}
export interface InternalUpsertParams<T = unknown> {
  registry: ISavedObjectTypeRegistry;
  helpers: RepositoryHelpers;
  client: RepositoryEsClient;
  serializer: ISavedObjectsSerializer;
  type: string;
  id: string;
  namespace?: string;
  preflightNamespacesResult?: PreflightCheckNamespacesResult;
  references?: SavedObjectReference[];
  // rawUpsert: SavedObjectsRawDoc | undefined;
  migrationVersionCompatibility?: 'compatible' | 'raw';
  version?: string;
  refresh: MutatingOperationRefreshSetting;
  rawUpsert: T;
  time: string;
  migratedInputAttributes: T;
}

export interface SavedObjectInternalUpsertResponse {
  savedObject: SavedObjectSanitizedDoc;
}

// export const internalUpsert = async <T>({
//   registry,
//   helpers,
//   client,
//   serializer,
//   type,
//   id,
//   namespace,
//   preflightNamespacesResult,
//   references,
//   rawUpsert,
//   migrationVersionCompatibility,
//   version,
//   refresh,
//   time,
//   migratedInputAttributes: attributes,
// }: // upsert,
// InternalUpsertParams) => {
//   const {
//     common: commonHelper,
//     validation: validationHelper,
//     encryption: encryptionHelper,
//   } = helpers;

  const overwrite = true;
  const migratedUpsertRawDoc = serializer.savedObjectToRaw(rawUpsert as SavedObjectSanitizedDoc);

  // SO repo tests throw on objects with `coreMigrationVersion` against test Kibana version (2.0.0)
  validateCreateObject(
    migratedUpsertRawDoc,
    migrationVersionCompatibility,
    serializer,
    validationHelper,
    type
  );
  // attributes here must be migrated to v2 as input args, then merged with the original doc attributes (to overwrite the ones specified in attributes as request body input with the new values also specified in the request body)
  const doc = {
    [type]: await encryptionHelper.optionallyEncryptAttributes(type, id, namespace, migratedInputAttributes),
    updated_at: time,
    ...(Array.isArray(references) && { references }),
  };
  const requestBody = {
    ...doc,
    _source: migratedUpsertRawDoc._source,
    ...(overwrite && version ? decodeRequestVersion(version) : {})
  }
  const upsertRequestParams = {
    id: migratedUpsertRawDoc._id,
    index: commonHelper.getIndexForType(type),
    refresh,
    body: {
      ...doc,
      (rawUpsert && migratedUpsertRawDoc._source),
      ...(overwrite && version ? decodeRequestVersion(version) : {}),
    },
    require_alias: true,
  };

  const {
    body: createBody,
    statusCode: createStatusCode,
    headers: createHeaders,
  } = await client.create(upsertRequestParams, { meta: true });

  if (isNotFoundFromUnsupportedServer({ statusCode: createStatusCode, headers: createHeaders })) {
    throw SavedObjectsErrorHelpers.createGenericNotFoundEsUnavailableError(id, type);
  }
  /**
   * createBody: WriteResponseBase:
   * {
   *   id: Id;
   *   _index: IndexName;
   *   _primary_term: long;
   *   result: Result;
   *   _seq_no: SequenceNumber;
   *   _shards: ShardStatistics;
   *   _version: VersionNumber;
   *   forced_refresh?: boolean;
   * }
   */
  //
  return serializer.rawToSavedObject<T>(
    { ...migratedUpsertRawDoc, ...createBody }, // NB: overwriting _seq_no, _primary_term of the original doc with those from the client & adding _source from originalDoc (after migrating the input args) to the updated doc.
    { migrationVersionCompatibility }
  );
};
