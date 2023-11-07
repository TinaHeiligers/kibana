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
} from '@kbn/core-saved-objects-server';
import { SavedObjectsUtils } from '@kbn/core-saved-objects-utils-server';
import { encodeVersion } from '@kbn/core-saved-objects-base-server-internal';
import {
  SavedObject,
  SavedObjectsBulkUpdateObject,
  SavedObjectsBulkUpdateOptions,
  SavedObjectsBulkUpdateResponse,
} from '@kbn/core-saved-objects-api-server';
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
} from './utils';
import { ApiExecutionContext } from './types';

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
  type DocumentToSave = Record<string, unknown>;
  type ExpectedBulkGetResult = Either<
    { type: string; id: string; error: Payload },
    {
      type: string;
      id: string;
      version?: string;
      documentToSave: DocumentToSave;
      objectNamespace?: string;
      esRequestIndex: number;
    }
  >;
  // create the expected results from fetching all docs
  const expectedBulkGetResults = objects.map<ExpectedBulkGetResult>((object) => {
    const { type, id, attributes, references, version, namespace: objectNamespace } = object;
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
    // the update to the doc as Kibana Client sees it (possibly v1 when server is v2)
    // we need to move this to after fetching and migrating the docs
    const documentToSave = {
      // at this point, these are partial updates to a doc, as requested
      [type]: attributes,
      updated_at: time,
      ...(Array.isArray(references) && { references }),
    };
    // we want to fetch all the docs, regardless of namespace type
    const requiresNamespacesCheck = registry.isMultiNamespace(object.type);

    return right({
      type,
      id,
      version,
      documentToSave,
      objectNamespace,
      // keep all objects, regardless of namespace checking requirements
      ...(!requiresNamespacesCheck && {
        skipNamespaceCheck: true,
      }),
      ...(requiresNamespacesCheck && {
        skipNamespaceCheck: false,
      }),
      esRequestIndex: bulkGetRequestIndexCounter++,
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
  const namespaceString = SavedObjectsUtils.namespaceIdToString(namespace);
  const getNamespaceString = (objectNamespace?: string) => objectNamespace ?? namespaceString;
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
      documentToSave: DocumentToSave;
      esRequestIndex: number;
    }
  >;
  const expectedBulkUpdateResults = await Promise.all(
    expectedBulkGetResults.map<Promise<ExpectedBulkUpdateResult>>(async (expectedBulkGetResult) => {
      if (isLeft(expectedBulkGetResult)) {
        return expectedBulkGetResult;
      }

      const { esRequestIndex, id, type, version, documentToSave, objectNamespace } =
        expectedBulkGetResult.value;

      let namespaces;
      let versionProperties;
      if (esRequestIndex !== undefined) {
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

      const expectedResult = {
        type,
        id,
        namespaces,
        esRequestIndex: bulkUpdateRequestIndexCounter++,
        documentToSave: expectedBulkGetResult.value.documentToSave,
      };

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
            ...documentToSave,
            [type]: await encryptionHelper.optionallyEncryptAttributes(
              type,
              id,
              objectNamespace || namespace,
              documentToSave[type]
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

      const { type, id, namespaces, documentToSave, esRequestIndex } = expectedResult.value;
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
      const { [type]: attributes, references, updated_at } = documentToSave;

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
