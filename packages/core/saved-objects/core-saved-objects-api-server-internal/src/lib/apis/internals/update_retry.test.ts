/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { apiContextMock, repositoryMock } from '../../../mocks';
import { createRegistry, getMockGetResponse } from '../../../test_helpers/repository.test.common';
import { executeUpdateRetryOnConflict } from './update_retry';

describe('executeUpdateRetryOnConflict', () => {
  const registry = createRegistry();
  const repository = repositoryMock.create();

  const id = 'logstash-*';
  const type = 'index-pattern';
  const attributes = { title: 'Testing' };

  it('executes update', async () => {
    const options = { retryOnConflict: 3 };
    const apiContext = apiContextMock.create();

    repository.update = jest.fn().mockResolvedValue(getMockGetResponse(registry, { type, id }));
    await executeUpdateRetryOnConflict({ type, id, attributes, options }, apiContext);
    expect(repository.update).toHaveBeenCalledTimes(4);
  });
});
