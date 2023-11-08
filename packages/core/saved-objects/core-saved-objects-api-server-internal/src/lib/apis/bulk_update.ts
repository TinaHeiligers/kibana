/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { Payload } from '@hapi/boom';
import {
  SavedObjectsErrorHelpers,
  DecoratedError,
  AuthorizeUpdateObject,
  SavedObjectsRawDoc,
  SavedObjectSanitizedDoc,
} from '@kbn/core-saved-objects-server';
import { SavedObjectsUtils } from '@kbn/core-saved-objects-utils-server';
import { encodeVersion } from '@kbn/core-saved-objects-base-server-internal';
import {
  SavedObject,
  SavedObjectsBulkUpdateObject,
  SavedObjectsBulkUpdateOptions,
  SavedObjectsBulkUpdateResponse,
} from '@kbn/core-saved-objects-api-server';
import { MgetResponseItem } from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { DEFAULT_REFRESH_SETTING } from '../constants';
import {
  type Either,
  errorContent,
  getBulkOperationError,
  getCurrentTime,
  getExpectedVersionProperties,
  isMgetDoc,
  left,
  right,
  isLeft,
  rawDocExistsInNamespace,
  isValidRequest,
  isRight,
  getSavedObjectFromSource,
  mergeForUpdate,
} from './utils';
import { ApiExecutionContext } from './types';
import { MigrationHelper } from './helpers';

export interface PerformUpdateParams<T = unknown> {
  objects: Array<SavedObjectsBulkUpdateObject<T>>;
  options: SavedObjectsBulkUpdateOptions;
}

export const performBulkUpdate = async <T>(
  { objects, options }: PerformUpdateParams<T>,
  { registry, helpers, allowedTypes, client, serializer, extensions = {} }: ApiExecutionContext
): Promise<SavedObjectsBulkUpdateResponse<T>> => {
  const {
    common: commonHelper,
    encryption: encryptionHelper,
    preflight: preflightHelper,
    migration: migratorHelper,
  } = helpers;
  const { securityExtension } = extensions;

  const namespace = commonHelper.getCurrentNamespace(options.namespace);
  const time = getCurrentTime();
  // MOVE INTERNALS TO SEPARATE INTERNAL FUNCTION CALL

  // START PREFLIGHT CHECKS: start of preflight check helpers calls and virtual hash maps creation(s) to keep track of objects.
  let bulkGetRequestIndexCounter = 0;
  type DocumentUpdates = Record<string, unknown>;
  type ExpectedBulkGetResult = Either<
    { type: string; id: string; error: Payload },
    {
      type: string;
      id: string;
      version?: string;
      documentUpdates: DocumentUpdates;
      objectNamespace?: string;
      esRequestIndex: number;
      migrationVersionCompatibility?: 'compatible' | 'raw';
      rawDocSource?: MgetResponseItem<unknown>;
    }
  >;
  // create the expected results from fetching all docs
  const expectedBulkGetResults = objects.map<ExpectedBulkGetResult>((object) => {
    const {
      type,
      id,
      attributes,
      references,
      version,
      namespace: objectNamespace,
      migrationVersionCompatibility,
    } = object;
    let error: DecoratedError | undefined;
    //  initial check on request validity
    try {
      const { validRequest, error: invalidRequestError } = isValidRequest({
        allowedTypes,
        type,
        id,
        objectNamespace,
      });
      if (!validRequest) {
        error = invalidRequestError;
      }
    } catch (e) {
      error = e;
    }
    if (error) {
      return left({ id, type, error: errorContent(error) });
    }
    const documentUpdates = {
      [type]: attributes,
      updated_at: time,
      ...(Array.isArray(references) && { references }),
    };

    return right({
      type,
      id,
      version,
      documentUpdates,
      objectNamespace,
      esRequestIndex: bulkGetRequestIndexCounter++,
      migrationVersionCompatibility,
      rawDocSource: {} as MgetResponseItem<unknown>,
    });
  });

  const validObjects = expectedBulkGetResults.filter(isRight);

  if (validObjects.length === 0) {
    // We only have error results; return early to avoid potentially trying authZ checks for 0 types which would result in an exception.
    return {
      // Technically the returned array should only contain SavedObject results, but for errors this is not true (we cast to 'any' below)
      saved_objects: expectedBulkGetResults.map<SavedObject<T>>(
        ({ value }) => value as unknown as SavedObject<T>
      ),
    };
  }
  // Namespace utility methods - TODO refactor to extract if possible
  // `objectNamespace` is a namespace string, while `namespace` is a namespace ID.
  // The object namespace string, if defined, will supersede the operation's namespace ID
  // (converted here to the namespaceString for the namespace ID).
  const getNamespaceString = (objectNamespace?: string) =>
    objectNamespace ?? SavedObjectsUtils.namespaceIdToString(namespace);

  const getNamespaceId = (objectNamespace?: string) =>
    objectNamespace !== undefined
      ? SavedObjectsUtils.namespaceStringToId(objectNamespace)
      : namespace;
  // --continue with preflight stuff

  // @TINA get docs with preflightGetDocsForBulkUpdate
  const bulkGetResponse = await preflightHelper.preflightGetDocsForBulkUpdate({
    validObjects,
    namespace,
  });
  // END PREFLIGHT CHECKS: up to here is preflight checks and virtual hashmaps creation to keep track of each object
  // START AUTH CHECK FOR IF REQUESTOR HAS AUTHORIZATION & PERMISSIONS TO UPDATE THE OBJECT
  const authObjects: AuthorizeUpdateObject[] = validObjects.map((element) => {
    const { type, id, objectNamespace, esRequestIndex: index } = element.value;
    // we previously didn't check auth for objects that aren't shared, now we do.
    const preflightResult = bulkGetResponse?.body.docs[index]; // check auth for all objects that exist. We optimistically assume that every valid object will have a corresponding doc returned from mget
    return {
      type,
      id,
      objectNamespace,
      // @ts-expect-error MultiGetHit._source is optional
      existingNamespaces: preflightResult?._source?.namespaces ?? [], // leave as empty array for types that aren't multinamespace
    };
  });

  const authorizationResult = await securityExtension?.authorizeBulkUpdate({
    namespace,
    objects: authObjects,
  });
  // END AUTH CHECK -- @TINA end Nov 7th.
  let bulkUpdateRequestIndexCounter = 0;
  const bulkUpdateParams: object[] = [];
  type ExpectedBulkUpdateResult = Either<
    { type: string; id: string; error: Payload },
    {
      type: string;
      id: string;
      namespaces: string[];
      documentUpdates: DocumentUpdates;
      esRequestIndex: number;
    }
  >;
  const expectedBulkUpdateResults = await Promise.all(
    expectedBulkGetResults.map<Promise<ExpectedBulkUpdateResult>>(async (expectedBulkGetResult) => {
      if (isLeft(expectedBulkGetResult)) {
        return expectedBulkGetResult;
      }

      const {
        esRequestIndex,
        id,
        type,
        version,
        documentUpdates,
        objectNamespace,
        migrationVersionCompatibility,
      } = expectedBulkGetResult.value;

      let namespaces;
      let versionProperties;

      const indexFound = bulkGetResponse?.statusCode !== 404;
      const actualResult = indexFound ? bulkGetResponse?.body.docs[esRequestIndex] : undefined;
      const docFound = indexFound && isMgetDoc(actualResult) && actualResult.found;

      if (
        !docFound ||
        !rawDocExistsInNamespace(
          registry,
          actualResult as SavedObjectsRawDoc,
          getNamespaceId(objectNamespace)
        )
      ) {
        return left({
          id,
          type,
          error: errorContent(SavedObjectsErrorHelpers.createGenericNotFoundError(type, id)),
        });
      }

      if (registry.isMultiNamespace(type)) {
        // @ts-expect-error MultiGetHit is incorrectly missing _id, _source
        namespaces = actualResult!._source.namespaces ?? [
          // @ts-expect-error MultiGetHit is incorrectly missing _id, _source
          SavedObjectsUtils.namespaceIdToString(actualResult!._source.namespace),
        ];
        versionProperties = getExpectedVersionProperties(version);
      } else {
        if (registry.isSingleNamespace(type)) {
          // if `objectNamespace` is undefined, fall back to `options.namespace`
          namespaces = [getNamespaceString(objectNamespace)];
        }
        versionProperties = getExpectedVersionProperties(version);
      }
      let migrated;
      const documentFromSource = getSavedObjectFromSource<T>(
        registry,
        type,
        id,
        actualResult as SavedObjectsRawDoc,
        { migrationVersionCompatibility }
      );
      try {
        migrated = migratorHelper.migrateStorageDocument(documentFromSource) as SavedObject<T>;
      } catch (migrateStorageDocError) {
        return left({
          id,
          type,
          error: errorContent(
            SavedObjectsErrorHelpers.decorateGeneralError(
              migrateStorageDocError,
              'Failed to migrate document to the latest version'
            )
          ),
        });
      }
      const updatedAttributes = mergeForUpdate({
        targetAttributes: {
          ...migrated!.attributes,
        },
        updatedAttributes: await encryptionHelper.optionallyEncryptAttributes(
          type,
          id,
          namespaces,
          documentUpdates
        ),
        typeMappings: registry.getType(type)!.mappings,
      });
      const migratedUpdatedSavedObjectDoc = migratorHelper.migrateInputDocument({
        ...migrated!,
        id,
        type,
        // need to override the redacted NS values from the decrypted/migrated document
        namespace: objectNamespace,
        namespaces,
        attributes: updatedAttributes,
        ...documentUpdates,
      });

      const docToSend = serializer.savedObjectToRaw(
        migratedUpdatedSavedObjectDoc as SavedObjectSanitizedDoc
      );
      // @TINA: types problem, a lot above is wrong and a lot below needs to change.
      const expectedResult = {
        type,
        id,
        namespaces,
        esRequestIndex: bulkUpdateRequestIndexCounter++,
        documentUpdates: docToSend,
        // documentUpdates: expectedBulkGetResult.value.documentUpdates, // merge raw updates with existing doc migrated to the client version
      };
      // migrate down, merge update, migrate back up.

      bulkUpdateParams.push(
        {
          update: {
            _id: serializer.generateRawId(getNamespaceId(objectNamespace), type, id),
            _index: commonHelper.getIndexForType(type),
            ...versionProperties,
          },
        },
        {
          doc: {
            ...documentUpdates,
            [type]: await encryptionHelper.optionallyEncryptAttributes(
              type,
              id,
              objectNamespace || namespace,
              documentUpdates[type]
            ),
          },
        }
      );

      return right(expectedResult);
    })
  );

  const { refresh = DEFAULT_REFRESH_SETTING } = options;
  const bulkUpdateResponse = bulkUpdateParams.length
    ? await client.bulk({
        refresh,
        body: bulkUpdateParams,
        _source_includes: ['originId'],
        require_alias: true,
      })
    : undefined;

  const result = {
    saved_objects: expectedBulkUpdateResults.map((expectedResult) => {
      if (isLeft(expectedResult)) {
        return expectedResult.value as any;
      }

      const { type, id, namespaces, documentUpdates, esRequestIndex } = expectedResult.value;
      const response = bulkUpdateResponse?.items[esRequestIndex] ?? {};
      const rawResponse = Object.values(response)[0] as any;

      const error = getBulkOperationError(type, id, rawResponse);
      if (error) {
        return { type, id, error };
      }

      // When a bulk update operation is completed, any fields specified in `_sourceIncludes` will be found in the "get" value of the
      // returned object. We need to retrieve the `originId` if it exists so we can return it to the consumer.
      const { _seq_no: seqNo, _primary_term: primaryTerm, get } = rawResponse;

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { [type]: attributes, references, updated_at } = documentUpdates;

      const { originId } = get._source;
      return {
        id,
        type,
        ...(namespaces && { namespaces }),
        ...(originId && { originId }),
        updated_at,
        version: encodeVersion(seqNo, primaryTerm),
        attributes,
        references,
      };
    }),
  };

  return encryptionHelper.optionallyDecryptAndRedactBulkResult(
    result,
    authorizationResult?.typeMap,
    objects
  );
};
