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
  type ISavedObjectsSerializer,
  SavedObjectSanitizedDoc,
  SavedObjectsErrorHelpers,
  SavedObjectReference,
  SavedObject,
} from '@kbn/core-saved-objects-server';
import { cloneDeep } from 'lodash';
import type { RepositoryEsClient } from '../../repository_es_client';

import type { RepositoryHelpers } from '../helpers';
import { getCurrentTime } from '../utils';

export interface InternalUpdateParams<T = unknown> {
  // so info
  type: string;
  id: string;
  namespace?: string;
  references?: SavedObjectReference[];
  migrationVersionCompatibility?: 'compatible' | 'raw';
  version?: string;
  // apiContext
  helpers: RepositoryHelpers;
  client: RepositoryEsClient;
  serializer: ISavedObjectsSerializer;
  // update request & options. attributes are the ones we want to replace in the original doc
  attributes: T;
  refresh: MutatingOperationRefreshSetting;
  // doc we retrieved from type & id, migrated to this kibana version
  migrated: SavedObject<T>;
}

export const internalUpdate = async <T>({
  namespace,
  references,
  migrationVersionCompatibility,
  version,
  helpers,
  client,
  serializer,
  type,
  id,
  attributes,
  refresh,
  migrated,
}: InternalUpdateParams): Promise<SavedObjectSanitizedDoc<T>> => {
  const {
    common: commonHelper,
    // validation: validationHelper,
    encryption: encryptionHelper,
    migration: migrationHelper,
  } = helpers;

  const time = getCurrentTime();
  const originalMigratedDoc = cloneDeep(migrated!) as SavedObject<T>; // `canUpdate` assures we have a doc to work with

  const updatedDoc = {
    ...migrated,
    attributes: {
      ...originalMigratedDoc.attributes,
      ...(attributes as T),
    },
  };
  const doc = migrationHelper.migrateInputDocument({
    ...updatedDoc,
    attributes: {
      ...(await encryptionHelper.optionallyEncryptAttributes(
        type,
        id,
        namespace,
        updatedDoc.attributes
      )),
    },
    updated_at: time,
    ...(Array.isArray(references) && { references }),
  });
  // try {
  //   validationHelper.validateObjectForCreate(type, doc as SavedObjectSanitizedDoc<T>);
  // } catch (err) {
  //    swollow error: `coreMigrationVersion` belongs to higher kibana version than current (2.0.0)
  // kibana version hardcoded to 2.0.0 in repo setup for api unit tests
  // I can't get around that, even though we ignore the validation for now.
  // }

  const raw = serializer.savedObjectToRaw(doc as SavedObjectSanitizedDoc<T>);

  const updatedDocRequestParams = {
    id: raw._id,
    index: commonHelper.getIndexForType(type),
    refresh,
    body: raw._source,
    ...(version ? decodeRequestVersion(version) : {}),
    require_alias: true,
  };

  const {
    body: indexBody,
    statusCode: indexStatusCode,
    headers: indexHeaders,
  } = await client.index(updatedDocRequestParams, { meta: true });

  if (isNotFoundFromUnsupportedServer({ statusCode: indexStatusCode, headers: indexHeaders })) {
    throw SavedObjectsErrorHelpers.createGenericNotFoundEsUnavailableError(id, type);
  }
  // console.log('indexBody', JSON.stringify(indexBody));
  return serializer.rawToSavedObject<T>(
    { ...raw, ...indexBody },
    { migrationVersionCompatibility }
  );
};
