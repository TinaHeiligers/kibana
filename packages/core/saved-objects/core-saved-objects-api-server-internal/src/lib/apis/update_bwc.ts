/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import {
  SavedObjectsErrorHelpers,
  SavedObjectsRawDoc,
  SavedObjectsRawDocSource,
  type SavedObject,
  type SavedObjectSanitizedDoc,
} from '@kbn/core-saved-objects-server';
import {
  SavedObjectsUpdateOptions,
  SavedObjectsUpdateResponse,
} from '@kbn/core-saved-objects-api-server';
import { decodeRequestVersion } from '@kbn/core-saved-objects-base-server-internal';
import { DEFAULT_REFRESH_SETTING } from '../constants';
import { getCurrentTime, getSavedObjectFromSource } from './utils';
import { ApiExecutionContext } from './types';
import { IValidationHelper, PreflightCheckNamespacesResult } from './helpers';
import { PreflightGetDocResult } from './helpers/preflight_check';
import { internalUpdate } from './internals';
import { isNotFoundFromUnsupportedServer } from '@kbn/core-elasticsearch-server-internal';

export interface PerformUpdateBWCParams<T = unknown> {
  type: string;
  id: string;
  attributes: T;
  options: SavedObjectsUpdateOptions<T>;
}

function validateCreateObject(
  rawUpsert: SavedObjectsRawDoc,
  validationHelper: IValidationHelper,
  type: string
) {
  const attributes = rawUpsert._source[type];
  try {
    validationHelper.validateObjectForCreate(type, attributes);
  } catch (err) {
    // ignore throwing the error for now, return pre-defined result type:
    return {
      error: 'validation_error',
      reason: `Request attributes ${attributes} not valid for type ${type}. ${err}`
    }
  }
}

function isUpdateAnOption(
  preflightNamespacesResult: PreflightCheckNamespacesResult | undefined,
  preflightGetDocResult: PreflightGetDocResult
) {
  if (!preflightNamespacesResult && preflightGetDocResult.checkDocFound === 'found') {
    return true;
  } else if (
    preflightNamespacesResult?.checkResult === 'found_in_namespace' &&
    preflightNamespacesResult.rawDocSource
  ) {
    return true;
  } else return false;
}


export const performBWCUpdate = async <T>(
  { id, type, attributes, options }: PerformUpdateBWCParams<T>,
  { registry, helpers, allowedTypes, client, serializer, extensions }: ApiExecutionContext
): Promise<SavedObjectsUpdateResponse<T>> => {
  const {
    common: commonHelper,
    encryption: encryptionHelper,
    preflight: preflightHelper,
    migration: migrationHelper,
    validation: validationHelper,
  } = helpers;
  const { securityExtension } = extensions;

  const namespace = commonHelper.getCurrentNamespace(options.namespace);
  // 1. ensure valid request
  if (!allowedTypes.includes(type)) {
    throw SavedObjectsErrorHelpers.createGenericNotFoundError(type, id);
  }
  if (!id) {
    throw SavedObjectsErrorHelpers.createBadRequestError('id cannot be empty');
  }

  const {
    version,
    references,
    upsert,
    refresh = DEFAULT_REFRESH_SETTING,
    // retryOnConflict = version ? 0 : DEFAULT_RETRY_COUNT, // not an option for `create/index`
    migrationVersionCompatibility,
  } = options;

  // 2. get doc
  // @TINA TODO: check the preflightGetDoc only returns or throws.
  const preflightGetDocResult: PreflightGetDocResult = await preflightHelper.preflightGetDoc({
    type,
    id,
    namespace,
  });
  // here we have a valid doc result
  // 3. migrate to this Kibana version
  let migrated: SavedObject<T>;

  let savedObjectResponse: SavedObjectSanitizedDoc<T>;

  if (
    preflightGetDocResult.checkDocFound === 'found' &&
    preflightGetDocResult.unsafeRawDoc !== undefined
  ) {
    const rawDocSource = getSavedObjectFromSource<T>(
      registry,
      type,
      id,
      preflightGetDocResult.unsafeRawDoc,
      {
        migrationVersionCompatibility,
      }
    );

    // error case: migrating storage doc fails -> general error (500): 'Failed to migrate document to the latest version.'
    try {
      migrated = migrationHelper.migrateStorageDocument(rawDocSource) as SavedObject<T>;
    } catch (error) {
      throw SavedObjectsErrorHelpers.decorateGeneralError(
        error,
        'Failed to migrate document to the latest version.'
      );
    }
  }
  // TODO NEXT BEFORE DOING ANAYTHING ELSE: in-client update attributes
  // the original doc will be in v2 (version we need to give client)
  // take the attr from that and update the ones given in the request.
  // pass that to the create method
  // 2023-06-19

  // 4. do Namespaces check if multi-namespace type
  // note: if preflightNamespacesResult exists, it implies the type is multi-namespace
  // returns: checkResult & savedObjectNamespaces if checkResult is not found_outside_namespace.
  let preflightNamespacesResult: PreflightCheckNamespacesResult | undefined;

  if (registry.isMultiNamespace(type)) {
    // console.log('multinamespace', registry.isMultiNamespace(type));
    preflightNamespacesResult = await preflightHelper.preflightCheckNamespacesForUpdate({
      type,
      id,
      namespace,
      rawDocSource: preflightGetDocResult.unsafeRawDoc,
    });
  }

  const existingNamespaces =
    (preflightNamespacesResult && preflightNamespacesResult?.savedObjectNamespaces) ?? [];
  // auth and audit logging for update for Kibana auth, happens before request to client

  const authorizationResult = await securityExtension?.authorizeUpdate({
    namespace,
    object: { type, id, existingNamespaces },
  });
  /** condition 1: upsert is ingored if the doc exists:with upsert, we can't create a new doc that already exists and will fall back to trying to update the existing doc BUT it doesn't exist in the CURRENT space, so we can't do anything. not including upsert for updating a multinamespace doc when falling back to update for multinamespace types implies these objects can be updated accross space (doc doesn't exist in the current namespace but we can still update it from here)
  - condition 2: Specifically for Not trying upsert in the first place: we can't update something that doesn't exist.
  -- condition 3: singlenamespace types: can't use update if obj does not exist. We can still create it with upsert.
   */
  if (
    preflightNamespacesResult?.checkResult === 'found_outside_namespace' ||
    (!upsert && preflightNamespacesResult?.checkResult === 'not_found') || //
    (!registry.isMultiNamespace(type) &&
      !upsert &&
      preflightGetDocResult?.checkDocFound === 'not_found')
  ) {
    throw SavedObjectsErrorHelpers.createGenericNotFoundError(type, id); // covers case for can't update and where upsert isn't given
  }

  if (upsert && preflightNamespacesResult?.checkResult === 'not_found') {
    // If an upsert would result in the creation of a new object, we need to check for alias conflicts too.
    // This takes an extra round trip to Elasticsearch, but this won't happen often.
    // TODO: improve performance by combining these into a single preflight check
    await preflightHelper.preflightCheckForUpsertAliasConflict(type, id, namespace);
  }
  /**
   * upsert is ingored if the doc exists. If if upsert is also specified, we simply don't set rawUpsert if a doc that can be updated exists where it needs to.
   */
  let rawUpsert: SavedObjectsRawDoc | undefined; // only defined when all pre-checks are done and it's safe to create the doc. Holds tru for both multi-namespace and other namespace types.
  const time = getCurrentTime();

  // adds migrated `upsert` to `rawUpsert` if the doc doesn't exist and upsert is declared.
  // in this case, we don't update the doc, we create it.
  if (
    upsert &&
    (!preflightNamespacesResult || preflightNamespacesResult.checkResult === 'not_found')
  ) {
    let savedObjectNamespace: string | undefined;
    let savedObjectNamespaces: string[] | undefined;

    if (
      registry.isSingleNamespace(type) &&
      preflightGetDocResult?.checkDocFound === 'not_found' &&
      namespace
    ) {
      savedObjectNamespace = namespace;
    } else if (registry.isMultiNamespace(type)) {
      savedObjectNamespaces = preflightNamespacesResult!.savedObjectNamespaces;
    }

    // there's a bunch of other fields SO used in create (typeMigrationVersion, migrationVersion etc) but we don't have these here.
    // can we leave them out?

    const migratedUpsert = migrationHelper.migrateInputDocument({
      id,
      type,
      ...(savedObjectNamespace && { namespace: savedObjectNamespace }),
      ...(savedObjectNamespaces && { namespaces: savedObjectNamespaces }),
      attributes: {
        ...(await encryptionHelper.optionallyEncryptAttributes(type, id, namespace, upsert)),
      },
      created_at: time,
      updated_at: time,
      ...(Array.isArray(references) && { references }),
    });

    rawUpsert = serializer.savedObjectToRaw(migratedUpsert as SavedObjectSanitizedDoc);
    // validate object creation for current version:
    // SO repo tests throw on objects with `coreMigrationVersion` against test Kibana version (2.0.0)
    validateCreateObject(rawUpsert, validationHelper, type);
  }

  let updatedRawDoc: SavedObjectsRawDoc | undefined;

  if (
    (registry.isMultiNamespace(type) && preflightNamespacesResult?.checkResult === 'found_in_namespace' && preflightGetDocResult.unsafeRawDoc) ||
    (preflightGetDocResult.checkDocFound === 'found')
    ) {
      const { unsafeRawDoc } = preflightGetDocResult;
      // client-side update. What else do we need here? How do we handle the version
      const rawDoc = {
        ...unsafeRawDoc,
        _source: {
          ...unsafeRawDoc?._source,
          [type]: {
            ...await encryptionHelper.optionallyEncryptAttributes(type, id, namespace, migrated!.attributes),
            ...await encryptionHelper.optionallyEncryptAttributes(type, id, namespace, attributes),
          },
        },
        updated_at: time,
        ...(Array.isArray(references) && { references }),
        }
      updatedRawDoc = rawDoc
      }

  // ORIGINAL UPDATE CREATE DOC THAT GET'S ES TO DO THE UPDATE
  // const updateSavedObjectDoc = {
  //   [type]: await encryptionHelper.optionallyEncryptAttributes(type, id, namespace, attributes),
  //   updated_at: time,
  //   ...(Array.isArray(references) && { references }),
  // };

  // implement body of upsert as performUpsertAsCreate in internals
  if (upsert && rawUpsert && ) {
    const requestParams = {
      id: rawUpsert!._id,
      index: commonHelper.getIndexForType(type),
      refresh,
      body: rawUpsert!._source,
      ...(version ? decodeRequestVersion(version) : {}),
      require_alias: true,
    };
    const {
      body,
      statusCode,
      headers,
    } = await client.create(requestParams, { meta: true, });

    if (isNotFoundFromUnsupportedServer({ statusCode, headers })) {
    throw SavedObjectsErrorHelpers.createGenericNotFoundEsUnavailableError(id, type);
  }
    return encryptionHelper.optionallyDecryptAndRedactSingleResult(
    serializer.rawToSavedObject<T>({ ...rawUpsert, ...body }, { migrationVersionCompatibility }),
    authorizationResult?.typeMap,
    attributes
  );
  } else if (!upsert && isUpdateAnOption(preflightNamespacesResult, preflightGetDocResult)) {
    savedObjectResponse = await internalUpdate({
      helpers,
      client,
      serializer,
      type,
      id,
      namespace,
      references,
      migrationVersionCompatibility,
      version,
      refresh,
      attributes,
      migrated: migrated!,
    });
  }

  return encryptionHelper.optionallyDecryptAndRedactSingleResult(
    serializer.rawToSavedObject<T>({ ...rawUpsert, ... }, { migrationVersionCompatibility }),
    authorizationResult?.typeMap,
    attributes
  );
};
