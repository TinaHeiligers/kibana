/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';

import type {
  UpdateExceptionListItemSchema,
  ExceptionListItemSchema,
} from '@kbn/securitysolution-io-ts-list-types';
import { EXCEPTION_LIST_URL, EXCEPTION_LIST_ITEM_URL } from '@kbn/securitysolution-list-constants';
import { getExceptionListItemResponseMockWithoutAutoGeneratedValues } from '@kbn/lists-plugin/common/schemas/response/exception_list_item_schema.mock';
import {
  getCreateExceptionListItemMinimalSchemaMock,
  getCreateExceptionListItemSchemaMock,
} from '@kbn/lists-plugin/common/schemas/request/create_exception_list_item_schema.mock';
import { getCreateExceptionListMinimalSchemaMock } from '@kbn/lists-plugin/common/schemas/request/create_exception_list_schema.mock';
import { getUpdateMinimalExceptionListItemSchemaMock } from '@kbn/lists-plugin/common/schemas/request/update_exception_list_item_schema.mock';

import {
  deleteAllExceptions,
  removeExceptionListItemServerGeneratedProperties,
  removeExceptionListServerGeneratedProperties,
} from '../../../utils';
import { FtrProviderContext } from '../../../../../ftr_provider_context';

export default ({ getService }: FtrProviderContext) => {
  const supertest = getService('supertest');
  const log = getService('log');
  const utils = getService('securitySolutionUtils');

  describe('@ess @serverless @serverlessQA update_exception_list_items', () => {
    describe('update exception list items', () => {
      afterEach(async () => {
        await deleteAllExceptions(supertest, log);
      });

      describe('regressions', () => {
        it('updates an item via its item_id without side effects', async () => {
          // create a simple exception list
          await supertest
            .post(EXCEPTION_LIST_URL)
            .set('kbn-xsrf', 'true')
            .send(getCreateExceptionListMinimalSchemaMock())
            .expect(200);

          // create a simple exception list item
          await supertest
            .post(EXCEPTION_LIST_ITEM_URL)
            .set('kbn-xsrf', 'true')
            .send(getCreateExceptionListItemMinimalSchemaMock())
            .expect(200);

          const { body: items } = await supertest
            .get(
              `${EXCEPTION_LIST_ITEM_URL}/_find?list_id=${
                getCreateExceptionListMinimalSchemaMock().list_id
              }`
            )
            .set('kbn-xsrf', 'true')
            .send()
            .expect(200);

          expect(items.total).to.eql(1);
          const [item] = items.data;
          const expectedId = item.id;
          const expectedItemId = item.item_id;

          // update an exception list item's name, specifying its item_id
          const updatePayload: UpdateExceptionListItemSchema = {
            ...getUpdateMinimalExceptionListItemSchemaMock(),
            name: 'some other name',
          };
          await supertest
            .put(EXCEPTION_LIST_ITEM_URL)
            .set('kbn-xsrf', 'true')
            .send(updatePayload)
            .expect(200);

          const { body: itemsAfterUpdate } = await supertest
            .get(
              `${EXCEPTION_LIST_ITEM_URL}/_find?list_id=${
                getCreateExceptionListMinimalSchemaMock().list_id
              }`
            )
            .set('kbn-xsrf', 'true')
            .send()
            .expect(200);

          // Validate that we have a single exception item with the expected properties
          expect(itemsAfterUpdate.total).to.eql(1);
          const [updatedItem] = itemsAfterUpdate.data;
          expect(updatedItem.name).to.eql('some other name');
          expect(updatedItem.id?.length).to.be.greaterThan(0);
          expect(updatedItem.id).to.equal(expectedId);
          expect(updatedItem.item_id?.length).to.be.greaterThan(0);
          expect(updatedItem.item_id).to.equal(expectedItemId);
        });

        it('updates an item via its id without side effects', async () => {
          // create a simple exception list
          await supertest
            .post(EXCEPTION_LIST_URL)
            .set('kbn-xsrf', 'true')
            .send(getCreateExceptionListMinimalSchemaMock())
            .expect(200);

          // create a simple exception list item
          await supertest
            .post(EXCEPTION_LIST_ITEM_URL)
            .set('kbn-xsrf', 'true')
            .send(getCreateExceptionListItemMinimalSchemaMock())
            .expect(200);

          const { body: items } = await supertest
            .get(
              `${EXCEPTION_LIST_ITEM_URL}/_find?list_id=${
                getCreateExceptionListMinimalSchemaMock().list_id
              }`
            )
            .set('kbn-xsrf', 'true')
            .send()
            .expect(200);

          expect(items.total).to.eql(1);
          const [item] = items.data;
          const expectedId = item.id;
          const expectedItemId = item.item_id;

          // update an exception list item's name, specifying its id
          const { item_id: _, ...updateItemWithoutItemId } =
            getUpdateMinimalExceptionListItemSchemaMock();
          const updatePayload: UpdateExceptionListItemSchema = {
            ...updateItemWithoutItemId,
            name: 'some other name',
            id: expectedId,
          };
          await supertest
            .put(EXCEPTION_LIST_ITEM_URL)
            .set('kbn-xsrf', 'true')
            .send(updatePayload)
            .expect(200);

          const { body: itemsAfterUpdate } = await supertest
            .get(
              `${EXCEPTION_LIST_ITEM_URL}/_find?list_id=${
                getCreateExceptionListMinimalSchemaMock().list_id
              }`
            )
            .set('kbn-xsrf', 'true')
            .send()
            .expect(200);

          // Validate that we have a single exception item with the expected properties
          expect(itemsAfterUpdate.total).to.eql(1);
          const [updatedItem] = itemsAfterUpdate.data;
          expect(updatedItem.name).to.eql('some other name');
          expect(updatedItem.id?.length).to.be.greaterThan(0);
          expect(updatedItem.id).to.equal(expectedId);
          expect(updatedItem.item_id?.length).to.be.greaterThan(0);
          expect(updatedItem.item_id).to.equal(expectedItemId);
        });

        it('preserves optional fields that are unspecified in the request, a la PATCH semantics', async () => {
          // create a simple exception list
          await supertest
            .post(EXCEPTION_LIST_URL)
            .set('kbn-xsrf', 'true')
            .send(getCreateExceptionListMinimalSchemaMock())
            .expect(200);

          // create a simple exception list item
          const { meta, ...createPayload } = {
            ...getCreateExceptionListItemSchemaMock(),
            comments: [
              {
                comment: 'Im an old comment',
              },
            ],
          };
          await supertest
            .post(EXCEPTION_LIST_ITEM_URL)
            .set('kbn-xsrf', 'true')
            .send(createPayload)
            .expect(200);

          const { body: items } = await supertest
            .get(`${EXCEPTION_LIST_ITEM_URL}/_find?list_id=${createPayload.list_id}`)
            .set('kbn-xsrf', 'true')
            .send()
            .expect(200);

          expect(items.total).to.eql(1);
          const [item] = items.data;

          // Perform an update with only required fields. If any fields change on the item, then they're not really optional.
          const { item_id: _, ...updatePayload } = {
            ...getUpdateMinimalExceptionListItemSchemaMock(),
            id: item.id,
          };

          await supertest
            .put(EXCEPTION_LIST_ITEM_URL)
            .set('kbn-xsrf', 'true')
            .send(updatePayload)
            .expect(200);

          const { body: itemsAfterUpdate } = await supertest
            .get(`${EXCEPTION_LIST_ITEM_URL}/_find?list_id=${createPayload.list_id}`)
            .set('kbn-xsrf', 'true')
            .send()
            .expect(200);

          // Validate that we have a single exception item with the expected properties
          expect(itemsAfterUpdate.total).to.eql(1);
          const [updatedItem] = itemsAfterUpdate.data;
          expect(updatedItem.id).to.eql(item.id);
          expect(removeExceptionListItemServerGeneratedProperties(updatedItem)).to.eql(
            removeExceptionListItemServerGeneratedProperties(item)
          );
        });
      });

      it('should update a single exception list item property of name using an id', async () => {
        // create a simple exception list
        await supertest
          .post(EXCEPTION_LIST_URL)
          .set('kbn-xsrf', 'true')
          .send(getCreateExceptionListMinimalSchemaMock())
          .expect(200);

        // create a simple exception list item
        await supertest
          .post(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(getCreateExceptionListItemMinimalSchemaMock())
          .expect(200);

        // update a exception list item's name
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          name: 'some other name',
        };

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(200);

        const outputList: Partial<ExceptionListItemSchema> = {
          ...getExceptionListItemResponseMockWithoutAutoGeneratedValues(await utils.getUsername()),
          name: 'some other name',
        };

        const bodyToCompare = removeExceptionListServerGeneratedProperties(body);
        expect(bodyToCompare).to.eql(outputList);
      });

      it('should update a single exception list item property of name using an auto-generated item_id', async () => {
        // create a simple exception list
        await supertest
          .post(EXCEPTION_LIST_URL)
          .set('kbn-xsrf', 'true')
          .send(getCreateExceptionListMinimalSchemaMock())
          .expect(200);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { item_id, ...itemNoId } = getCreateExceptionListItemMinimalSchemaMock();

        // create a simple exception list item
        const { body: createListBody } = await supertest
          .post(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(itemNoId)
          .expect(200);

        // update a exception list item's name
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          item_id: createListBody.item_id,
          name: 'some other name',
        };

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(200);

        const outputList: Partial<ExceptionListItemSchema> = {
          ...getExceptionListItemResponseMockWithoutAutoGeneratedValues(await utils.getUsername()),
          name: 'some other name',
          item_id: body.item_id,
        };
        const bodyToCompare = removeExceptionListServerGeneratedProperties(body);
        expect(bodyToCompare).to.eql(outputList);
      });

      it('should give a 404 if it is given a fake exception list item id', async () => {
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          id: '5096dec6-b6b9-4d8d-8f93-6c2602079d9d',
        };
        delete updatedList.item_id;

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(404);

        expect(body).to.eql({
          status_code: 404,
          message: 'exception list item id: "5096dec6-b6b9-4d8d-8f93-6c2602079d9d" does not exist',
        });
      });

      it('should give a 404 if it is given a fake item_id', async () => {
        const updatedList: UpdateExceptionListItemSchema = {
          ...getUpdateMinimalExceptionListItemSchemaMock(),
          item_id: '5096dec6-b6b9-4d8d-8f93-6c2602079d9d',
        };

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(updatedList)
          .expect(404);

        expect(body).to.eql({
          status_code: 404,
          message:
            'exception list item item_id: "5096dec6-b6b9-4d8d-8f93-6c2602079d9d" does not exist',
        });
      });

      it('should give a 404 if both id and list_id is null', async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { item_id, ...listNoId } = getUpdateMinimalExceptionListItemSchemaMock();

        const { body } = await supertest
          .put(EXCEPTION_LIST_ITEM_URL)
          .set('kbn-xsrf', 'true')
          .send(listNoId)
          .expect(404);

        expect(body).to.eql({
          status_code: 404,
          message: 'either id or item_id need to be defined',
        });
      });
    });
  });
};
