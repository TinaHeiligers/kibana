/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { ReactElement } from 'react';
import { render, act } from '@testing-library/react';
import { I18nProvider } from '@kbn/i18n-react';
import type { AppMountParameters } from '@kbn/core-application-browser';

import { MockedMounterTuple, Mountable } from '../src/test_helpers/test_types';

type Dom = ReturnType<typeof render> | null;
type Renderer = () => Dom | Promise<Dom>;

export const createRenderer = (element: ReactElement | null): Renderer => {
  const dom: Dom = element && render(<I18nProvider>{element}</I18nProvider>);

  return () =>
    new Promise(async (resolve, reject) => {
      try {
        if (dom) {
          await act(async () => {}); // just acts, nothing else.
        }

        setImmediate(() => resolve(dom)); // flushes any pending promises
      } catch (error) {
        reject(error);
      }
    });
};

export const createAppMounter = ({
  appId,
  html = `<div>App ${appId}</div>`,
  appRoute = `/app/${appId}`,
  exactRoute = false,
  extraMountHook,
}: {
  appId: string;
  html?: string;
  appRoute?: string;
  exactRoute?: boolean;
  extraMountHook?: (params: AppMountParameters) => void;
}): MockedMounterTuple => {
  const unmount = jest.fn();
  return [
    appId,
    {
      mounter: {
        appRoute,
        appBasePath: appRoute,
        exactRoute,
        mount: jest.fn(async (params: AppMountParameters) => {
          const { appBasePath: basename, element } = params;
          Object.assign(element, {
            innerHTML: `<div>\nbasename: ${basename}\nhtml: ${html}\n</div>`,
          });
          unmount.mockImplementation(() => Object.assign(element, { innerHTML: '' }));
          if (extraMountHook) {
            extraMountHook(params);
          }
          return unmount;
        }),
      },
      unmount,
    },
  ];
};

export function getUnmounter(app: Mountable) {
  return app.mounter.mount.mock.results[0].value;
}
