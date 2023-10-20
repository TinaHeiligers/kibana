/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import { Payload } from '@hapi/boom';
import type { PublicMethodsOf } from '@kbn/utility-types';
import { isNotFoundFromUnsupportedServer } from '@kbn/core-elasticsearch-server-internal';
import type {
  ISavedObjectTypeRegistry,
  ISavedObjectsSerializer,
} from '@kbn/core-saved-objects-server';
import { SavedObjectsUtils } from '@kbn/core-saved-objects-utils-server';
import { SavedObjectsErrorHelpers, SavedObjectsRawDocSource } from '@kbn/core-saved-objects-server';
import type { RepositoryEsClient } from '../../repository_es_client';
import type { PreflightCheckForBulkDeleteParams } from '../internals/repository_bulk_delete_internal_types';
import type { CreatePointInTimeFinderFn } from '../../point_in_time_finder';
import {
  type Either,
  getSavedObjectNamespaces,
  isRight,
  rawDocExistsInNamespaces,
  isFoundGetResponse,
  type GetResponseFound,
} from '../utils';
import {
  preflightCheckForCreate,
  PreflightCheckForCreateObject,
} from '../internals/preflight_check_for_create';

export type IPreflightCheckHelper = PublicMethodsOf<PreflightCheckHelper>;

export class PreflightCheckHelper {
  private registry: ISavedObjectTypeRegistry;
  private serializer: ISavedObjectsSerializer;
  private client: RepositoryEsClient;
  private getIndexForType: (type: string) => string;
  private createPointInTimeFinder: CreatePointInTimeFinderFn;

  constructor({
    registry,
    serializer,
    client,
    getIndexForType,
    createPointInTimeFinder,
  }: {
    registry: ISavedObjectTypeRegistry;
    serializer: ISavedObjectsSerializer;
    client: RepositoryEsClient;
    getIndexForType: (type: string) => string;
    createPointInTimeFinder: CreatePointInTimeFinderFn;
  }) {
    this.registry = registry;
    this.serializer = serializer;
    this.client = client;
    this.getIndexForType = getIndexForType;
    this.createPointInTimeFinder = createPointInTimeFinder;
  }

  public async preflightCheckForCreate(objects: PreflightCheckForCreateObject[]) {
    return await preflightCheckForCreate({
      objects,
      registry: this.registry,
      client: this.client,
      serializer: this.serializer,
      getIndexForType: this.getIndexForType.bind(this),
      createPointInTimeFinder: this.createPointInTimeFinder.bind(this),
    });
  }

  /**
   * Fetch multi-namespace saved objects
   * @returns MgetResponse
   * @notes multi-namespace objects shared to more than one space require special handling. We fetch these docs to retrieve their namespaces.
   * @internal
   */
  public async preflightCheckForBulkDelete(params: PreflightCheckForBulkDeleteParams) {
    const { expectedBulkGetResults, namespace } = params;
    const bulkGetMultiNamespaceDocs = expectedBulkGetResults
      .filter(isRight)
      .filter(({ value }) => value.esRequestIndex !== undefined)
      .map(({ value: { type, id } }) => ({
        _id: this.serializer.generateRawId(namespace, type, id),
        _index: this.getIndexForType(type),
        _source: ['type', 'namespaces'],
      }));

    const bulkGetMultiNamespaceDocsResponse = bulkGetMultiNamespaceDocs.length
      ? await this.client.mget(
          { body: { docs: bulkGetMultiNamespaceDocs } },
          { ignore: [404], meta: true }
        )
      : undefined;
    // fail fast if we can't verify a 404 response is from Elasticsearch
    if (
      bulkGetMultiNamespaceDocsResponse &&
      isNotFoundFromUnsupportedServer({
        statusCode: bulkGetMultiNamespaceDocsResponse.statusCode,
        headers: bulkGetMultiNamespaceDocsResponse.headers,
      })
    ) {
      throw SavedObjectsErrorHelpers.createGenericNotFoundEsUnavailableError();
    }
    return bulkGetMultiNamespaceDocsResponse;
  }

  /**
   * Pre-flight check to ensure that a multi-namespace object exists in the current namespace.
   */
  public async preflightCheckNamespaces({
    type,
    id,
    namespace,
    initialNamespaces,
  }: PreflightCheckNamespacesParams): Promise<PreflightCheckNamespacesResult> {
    if (!this.registry.isMultiNamespace(type)) {
      throw new Error(`Cannot make preflight get request for non-multi-namespace type '${type}'.`);
    }
    const { body, statusCode, headers } = await this.client.get<SavedObjectsRawDocSource>(
      {
        id: this.serializer.generateRawId(undefined, type, id),
        index: this.getIndexForType(type),
      },
      {
        ignore: [404],
        meta: true,
      }
    );

    const namespaces = initialNamespaces ?? [SavedObjectsUtils.namespaceIdToString(namespace)];

    const indexFound = statusCode !== 404;
    if (indexFound && isFoundGetResponse(body)) {
      if (!rawDocExistsInNamespaces(this.registry, body, namespaces)) {
        return { checkResult: 'found_outside_namespace' };
      }
      return {
        checkResult: 'found_in_namespace',
        savedObjectNamespaces: initialNamespaces ?? getSavedObjectNamespaces(namespace, body),
        rawDocSource: body,
      };
    } else if (isNotFoundFromUnsupportedServer({ statusCode, headers })) {
      // checking if the 404 is from Elasticsearch
      throw SavedObjectsErrorHelpers.createGenericNotFoundError(type, id);
    }
    return {
      checkResult: 'not_found',
      savedObjectNamespaces: initialNamespaces ?? getSavedObjectNamespaces(namespace),
    };
  }

  /**
   * Pre-flight check fetching the document regardless of its namespace type for update.
   */
  public async preflightGetDocForUpdate({
    type,
    id,
    namespace,
  }: PreflightDocParams): Promise<PreflightDocResult> {
    const { statusCode, body, headers } = await this.client.get<SavedObjectsRawDocSource>(
      {
        id: this.serializer.generateRawId(namespace, type, id),
        index: this.getIndexForType(type),
      },
      { ignore: [404], meta: true }
    );

    // checking if the 404 is from Elasticsearch
    if (isNotFoundFromUnsupportedServer({ statusCode, headers })) {
      throw SavedObjectsErrorHelpers.createGenericNotFoundEsUnavailableError(type, id);
    }

    const indexFound = statusCode !== 404;
    if (indexFound && isFoundGetResponse(body)) {
      return {
        checkDocFound: 'found',
        rawDocSource: body,
      };
    }

    return {
      checkDocFound: 'not_found',
    };
  }

  /**
   * Pre-flight check to ensure that a multi-namespace object exists in the current namespace for update API.
   */
  public preflightCheckNamespacesForUpdate({
    type,
    namespace,
    initialNamespaces,
    preflightDocResult,
  }: PreflightNSParams): PreflightNSResult {
    const { checkDocFound, rawDocSource } = preflightDocResult;
    if (!this.registry.isMultiNamespace(type)) {
      return {
        checkSkipped: true,
      };
    }

    const namespaces = initialNamespaces ?? [SavedObjectsUtils.namespaceIdToString(namespace)];

    if (checkDocFound === 'found' && rawDocSource !== undefined) {
      if (!rawDocExistsInNamespaces(this.registry, rawDocSource, namespaces)) {
        return { checkResult: 'found_outside_namespace', checkSkipped: false };
      }
      return {
        checkResult: 'found_in_namespace',
        savedObjectNamespaces:
          initialNamespaces ?? getSavedObjectNamespaces(namespace, rawDocSource),
        rawDocSource,
        checkSkipped: false,
      };
    }

    return {
      checkResult: 'not_found',
      savedObjectNamespaces: initialNamespaces ?? getSavedObjectNamespaces(namespace),
      checkSkipped: false,
    };
  }

  /**
   * Pre-flight check to ensure that an upsert which would create a new object does not result in an alias conflict.
   *
   * If an upsert would result in the creation of a new object, we need to check for alias conflicts too.
   * This takes an extra round trip to Elasticsearch, but this won't happen often.
   */
  public async preflightCheckForUpsertAliasConflict(
    type: string,
    id: string,
    namespace: string | undefined
  ) {
    const namespaceString = SavedObjectsUtils.namespaceIdToString(namespace);
    const [{ error }] = await preflightCheckForCreate({
      registry: this.registry,
      client: this.client,
      serializer: this.serializer,
      getIndexForType: this.getIndexForType.bind(this),
      createPointInTimeFinder: this.createPointInTimeFinder.bind(this),
      objects: [{ type, id, namespaces: [namespaceString] }],
    });
    if (error?.type === 'aliasConflict') {
      throw SavedObjectsErrorHelpers.createConflictError(type, id);
    }
    // any other error from this check does not matter
  }

  /**
  Pre-flight check fetching all documents for bulkUpdate, regardless of its namespace type */
  // public async preflightGetDocsForBulkUpdate(params: PreflightGetDocsForBulkUpdate)
  /**
   * Fetch multiple saved objects
   * @returns MgetResponse
   * @internal
   */
  public async preflightGetDocsForBulkUpdate({
    validObjects,
    namespace,
  }: PreflightGetDocsForBulkUpdateParams) {
    // const { expectedBulkGetResults, namespace } = params;
    const validObjectsAsRight = validObjects as ExpectedBulkGetResultRight[];

    // if (validObjects.length === 0) {
    //   // We only have error results; return early to avoid potentially trying authZ checks for 0 types which would result in an exception.
    //   return {
    //     // Technically the returned array should only contain SavedObject results, but for errors this is not true (we cast to 'any' below)
    //     saved_objects: expectedBulkGetResults.map<SavedObject>(
    //       ({ value }) => value as unknown as SavedObject
    //     ),
    //   };
    // }

    // `objectNamespace` is a namespace string, while `namespace` is a namespace ID.
    // each of the validObjects in the map might have it's own objectNamespace, we get that using a custom function

    // @TINA note: only using type, id and namespace to get the docs, not searching by attributes
    const bulkGetDocs = validObjectsAsRight
      .filter(({ value }) => value.esRequestIndex !== undefined)
      .map(({ value: { type, id, objectNamespace } }) => ({
        _id: this.serializer.generateRawId(
          this.getNamespaceId(objectNamespace, namespace),
          type,
          id
        ),
        _index: this.getIndexForType(type), // the index in which to get the object
        _source: ['type', 'namespaces'],
      }));
    // @TINA note: initial call to fetch all docs, seems to be issued for single and multinamespace types
    const bulkGetResponse = bulkGetDocs.length
      ? await this.client.mget({ body: { docs: bulkGetDocs } }, { ignore: [404], meta: true })
      : undefined;
    // fail fast if we can't verify a 404 response is from Elasticsearch
    if (
      bulkGetResponse &&
      isNotFoundFromUnsupportedServer({
        statusCode: bulkGetResponse.statusCode,
        headers: bulkGetResponse.headers,
      })
    ) {
      throw SavedObjectsErrorHelpers.createGenericNotFoundEsUnavailableError();
    }
    return bulkGetResponse;
  }
  /**
  Private method to get the objects' namespace id for bulkUpdate
  /**
   * @returns string | undefined
   * @internal
   */
  private getNamespaceId = (objectNamespace?: string, namespace?: string) =>
    objectNamespace !== undefined
      ? SavedObjectsUtils.namespaceStringToId(objectNamespace)
      : namespace;
}

/**
 * @internal
 */
export interface PreflightCheckNamespacesParams {
  /** The object type to fetch */
  type: string;
  /** The object ID to fetch */
  id: string;
  /** The current space */
  namespace: string | undefined;
  /** Optional; for an object that is being created, this specifies the initial namespace(s) it will exist in (overriding the current space) */
  initialNamespaces?: string[];
}

/**
 * @internal
 */
export interface PreflightNSParams {
  /** The object type to fetch */
  type: string;
  /** The object ID to fetch */
  id: string;
  /** The current space */
  namespace: string | undefined;
  /** Optional; for an object that is being created, this specifies the initial namespace(s) it will exist in (overriding the current space) */
  initialNamespaces?: string[];
  /** Optional; for a pre-fetched object */
  preflightDocResult: PreflightDocResult;
}

/**
 * @internal
 */
export interface PreflightNSResult {
  /** If the object exists, and whether or not it exists in the current space */
  checkResult?: 'not_found' | 'found_in_namespace' | 'found_outside_namespace';
  /**
   * What namespace(s) the object should exist in, if it needs to be created; practically speaking, this will never be undefined if
   * checkResult == not_found or checkResult == found_in_namespace
   */
  savedObjectNamespaces?: string[];
  /** The source of the raw document, if the object already exists */
  rawDocSource?: GetResponseFound<SavedObjectsRawDocSource>;
  /** Indicates if the namespaces check is called or not. Non-multinamespace types are not shareable */
  checkSkipped?: boolean;
}

/**
 * @internal
 */
export interface PreflightCheckNamespacesResult {
  /** If the object exists, and whether or not it exists in the current space */
  checkResult: 'not_found' | 'found_in_namespace' | 'found_outside_namespace';
  /**
   * What namespace(s) the object should exist in, if it needs to be created; practically speaking, this will never be undefined if
   * checkResult == not_found or checkResult == found_in_namespace
   */
  savedObjectNamespaces?: string[];
  /** The source of the raw document, if the object already exists */
  rawDocSource?: GetResponseFound<SavedObjectsRawDocSource>;
}

/**
 * @internal
 */
export interface PreflightDocParams {
  /** The object type to fetch */
  type: string;
  /** The object ID to fetch */
  id: string;
  /** The current space */
  namespace: string | undefined;
  /**
   * optional migration version compatibility.
   * {@link SavedObjectsRawDocParseOptions.migrationVersionCompatibility}
   */
  migrationVersionCompatibility?: 'compatible' | 'raw';
}

/**
 * @internal
 */
export interface PreflightDocResult {
  /** If the object exists, and whether or not it exists in the current space */
  checkDocFound: 'not_found' | 'found';
  /** The source of the raw document, if the object already exists in the server's version (unsafe to use) */
  rawDocSource?: GetResponseFound<SavedObjectsRawDocSource>;
}
/**
  @internal

   */
export type DocumentToSave = Record<string, unknown>;
/**
  @internal

   */
export type ExpectedBulkGetResult = Either<
  { type: string; id: string; error: Payload },
  {
    type: string;
    id: string;
    version?: string;
    documentToSave: DocumentToSave;
    objectNamespace?: string;
    esRequestIndex?: number;
  }
>;
/**
  @internal

   */
export interface PreflightGetDocsForBulkUpdateParams {
  validObjects: ExpectedBulkGetResult[];
  namespace?: string;
}

interface ExpectedBulkGetResultRight {
  tag: 'Right';
  value: {
    type: string;
    id: string;
    version?: string;
    documentToSave: DocumentToSave;
    objectNamespace?: string;
    esRequestIndex?: number;
  };
}
