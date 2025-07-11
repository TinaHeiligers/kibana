/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { v4 as uuidv4 } from 'uuid';
import type { TaskManagerSetupContract, TaskManagerStartContract } from './plugin';
import type { ConcreteTaskInstance } from './task';
import { TaskStatus } from './task';

const createSetupMock = () => {
  const mock: jest.Mocked<TaskManagerSetupContract> = {
    index: '.kibana_task_manager',
    addMiddleware: jest.fn(),
    registerTaskDefinitions: jest.fn(),
    registerCanEncryptedSavedObjects: jest.fn(),
  };
  return mock;
};

const createStartMock = () => {
  const mock: jest.Mocked<TaskManagerStartContract> = {
    fetch: jest.fn(),
    get: jest.fn(),
    aggregate: jest.fn(),
    remove: jest.fn(),
    bulkRemove: jest.fn(),
    schedule: jest.fn(),
    runSoon: jest.fn(),
    ensureScheduled: jest.fn().mockResolvedValue(Promise.resolve()), // it's a promise and there are some places where it's followed by `.catch()`
    removeIfExists: jest.fn().mockResolvedValue(Promise.resolve()), // it's a promise and there are some places where it's followed by `.catch()`
    bulkUpdateSchedules: jest.fn(),
    bulkSchedule: jest.fn(),
    bulkDisable: jest.fn(),
    bulkEnable: jest.fn(),
    getRegisteredTypes: jest.fn(),
    bulkUpdateState: jest.fn(),
    registerEncryptedSavedObjectsClient: jest.fn(),
  };
  return mock;
};

const createTaskMock = (overrides: Partial<ConcreteTaskInstance> = {}): ConcreteTaskInstance => {
  return {
    id: `task_${uuidv4()}`,
    attempts: 0,
    schedule: undefined,
    params: { hello: 'world' },
    retryAt: null,
    runAt: new Date(),
    scheduledAt: new Date(),
    scope: undefined,
    startedAt: null,
    state: { foo: 'bar' },
    status: TaskStatus.Idle,
    taskType: 'foo',
    user: undefined,
    version: '123',
    ownerId: '123',
    ...overrides,
  };
};

export const taskManagerMock = {
  createSetup: createSetupMock,
  createStart: createStartMock,
  createTask: createTaskMock,
};
