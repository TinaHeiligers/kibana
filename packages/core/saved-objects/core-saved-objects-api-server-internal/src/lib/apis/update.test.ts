/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

/* eslint-disable @typescript-eslint/no-shadow */

import { mockGetCurrentTime, mockPreflightCheckForCreate } from '../repository.test.mock';

import * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { SavedObjectsErrorHelpers } from '@kbn/core-saved-objects-server';
import { SavedObjectsRepository } from '../repository';
import { loggerMock } from '@kbn/logging-mocks';
import {
  SavedObjectsSerializer,
  encodeHitVersion,
} from '@kbn/core-saved-objects-base-server-internal';
import { elasticsearchClientMock } from '@kbn/core-elasticsearch-client-server-mocks';
import { kibanaMigratorMock } from '../../mocks';
import {
  MULTI_NAMESPACE_ISOLATED_TYPE,
  mockVersionProps,
  mockTimestampFields,
  mockTimestamp,
  mappings,
  mockVersion,
  createRegistry,
  createDocumentMigrator,
  getMockGetResponse,
  createSpySerializer,
  createBadRequestErrorPayload,
  createGenericNotFoundErrorPayload,
  updateSuccess,
} from '../../test_helpers/repository.test.common';

describe('SavedObjectsRepository', () => {
  let client: ReturnType<typeof elasticsearchClientMock.createElasticsearchClient>;
  let repository: SavedObjectsRepository;
  let migrator: ReturnType<typeof kibanaMigratorMock.create>;
  let logger: ReturnType<typeof loggerMock.create>;
  let serializer: jest.Mocked<SavedObjectsSerializer>;

  const registry = createRegistry();
  const documentMigrator = createDocumentMigrator(registry);

  beforeEach(() => {
    client = elasticsearchClientMock.createElasticsearchClient();
    migrator = kibanaMigratorMock.create();
    documentMigrator.prepareMigrations();
    migrator.migrateDocument = jest.fn().mockImplementation(documentMigrator.migrate);
    migrator.runMigrations = jest.fn().mockResolvedValue([{ status: 'skipped' }]);
    logger = loggerMock.create();

    // create a mock serializer "shim" so we can track function calls, but use the real serializer's implementation
    serializer = createSpySerializer(registry);

    const allTypes = registry.getAllTypes().map((type) => type.name);
    const allowedTypes = [...new Set(allTypes.filter((type) => !registry.isHidden(type)))];

    // @ts-expect-error must use the private constructor to use the mocked serializer
    repository = new SavedObjectsRepository({
      index: '.kibana-test',
      mappings,
      client,
      migrator,
      typeRegistry: registry,
      serializer,
      allowedTypes,
      logger,
    });

    mockGetCurrentTime.mockReturnValue(mockTimestamp);
  });

  describe('#update', () => {
    const id = 'logstash-*';
    const type = 'index-pattern';
    const attributes = { title: 'Testing' };
    const namespace = 'foo-namespace';
    const references = [
      {
        name: 'ref_0',
        type: 'test',
        id: '1',
      },
    ];
    const originId = 'some-origin-id';

    beforeEach(() => {
      mockPreflightCheckForCreate.mockReset();
      mockPreflightCheckForCreate.mockImplementation(({ objects }) => {
        return Promise.resolve(objects.map(({ type, id }) => ({ type, id }))); // respond with no errors by default
      });
      client.create.mockResponseImplementation((params) => {
        return {
          body: {
            _id: params.id,
            ...mockVersionProps,
          } as estypes.CreateResponse,
        };
      });
    });

    describe('client calls', () => {
      it(`should use the ES get action then index action when type is not multi-namespace for existing objects`, async () => {
        const type = 'index-pattern';
        const id = 'logstash-*';
        migrator.migrateDocument.mockImplementationOnce((doc) => ({ ...doc, migrated: true }));
        await updateSuccess(client, repository, registry, type, id, attributes, { namespace });
        expect(client.get).toHaveBeenCalledTimes(1);
        expect(mockPreflightCheckForCreate).not.toHaveBeenCalled();
        expect(client.index).toHaveBeenCalledTimes(1);
      });

      it('retries the operation in case of conflict error', async () => {
        client.get.mockResponse(getMockGetResponse(registry, { type, id }));

        client.index
          .mockImplementationOnce(() => {
            throw SavedObjectsErrorHelpers.createConflictError(type, id, 'conflict');
          })
          .mockImplementationOnce(() => {
            throw SavedObjectsErrorHelpers.createConflictError(type, id, 'conflict');
          })
          .mockResponseImplementation((params) => {
            return {
              body: {
                _id: params.id,
                _seq_no: 1,
                _primary_term: 1,
              },
            } as any;
          });

        await repository.update(type, id, attributes, { retryOnConflict: 3 });

        expect(client.get).toHaveBeenCalledTimes(3);
        expect(client.index).toHaveBeenCalledTimes(3);
      });

      it('retries the operation a maximum of `retryOnConflict` times', async () => {
        client.get.mockResponse(getMockGetResponse(registry, { type, id }));

        client.index.mockImplementation(() => {
          throw SavedObjectsErrorHelpers.createConflictError(type, id, 'conflict');
        });

        await expect(
          repository.update(type, id, attributes, { retryOnConflict: 3 })
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `"Saved object [index-pattern/logstash-*] conflict"`
        );

        expect(client.get).toHaveBeenCalledTimes(4);
        expect(client.index).toHaveBeenCalledTimes(4);
      });

      it('default to a `retry_on_conflict` setting of `0` when `version` is provided', async () => {
        client.get.mockResponse(getMockGetResponse(registry, { type, id }));

        client.index.mockImplementation(() => {
          throw SavedObjectsErrorHelpers.createConflictError(type, id, 'conflict');
        });

        await expect(
          repository.update(type, id, attributes, {
            version: encodeHitVersion({ _seq_no: 100, _primary_term: 200 }),
          })
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `"Saved object [index-pattern/logstash-*] conflict"`
        );

        expect(client.get).toHaveBeenCalledTimes(1);
        expect(client.index).toHaveBeenCalledTimes(1);
      });
    });

    describe('errors', () => {
      const expectNotFoundError = async (type: string, id: string) => {
        await expect(
          repository.update(type, id, {}, { migrationVersionCompatibility: 'raw' })
        ).rejects.toThrowError(createGenericNotFoundErrorPayload(type, id));
      };

      it(`throws when type is invalid`, async () => {
        await expectNotFoundError('unknownType', id);
        expect(client.index).not.toHaveBeenCalled();
      });

      it(`throws when id is empty`, async () => {
        await expect(repository.update(type, '', attributes)).rejects.toThrowError(
          createBadRequestErrorPayload('id cannot be empty')
        );
        expect(client.index).not.toHaveBeenCalled();
      });
    });

    describe('returns', () => {
      it(`returns _seq_no and _primary_term encoded as version`, async () => {
        const result = await updateSuccess(client, repository, registry, type, id, attributes, {
          namespace,
          references,
        });
        expect(result).toEqual({
          id,
          type,
          ...mockTimestampFields,
          version: mockVersion,
          attributes,
          references,
          namespaces: [namespace],
        });
      });

      it(`includes namespaces if type is multi-namespace`, async () => {
        const result = await updateSuccess(
          client,
          repository,
          registry,
          MULTI_NAMESPACE_ISOLATED_TYPE,
          id,
          attributes
        );
        expect(result).toMatchObject({
          namespaces: expect.any(Array),
        });
      });

      it(`includes namespaces if type is not multi-namespace`, async () => {
        const result = await updateSuccess(client, repository, registry, type, id, attributes);
        expect(result).toMatchObject({
          namespaces: ['default'],
        });
      });

      it(`includes originId property if present in cluster call response`, async () => {
        const result = await updateSuccess(
          client,
          repository,
          registry,
          type,
          id,
          attributes,
          {},
          { originId }
        );
        expect(result).toMatchObject({ originId });
      });
    });
  });
});
