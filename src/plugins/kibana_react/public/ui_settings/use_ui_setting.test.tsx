/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { useGlobalUiSetting$, useUiSetting$ } from './use_ui_setting';
import { createKibanaReactContext } from '../context';
import { KibanaServices } from '../context/types';
import { Subject } from 'rxjs';
import { coreMock } from '@kbn/core/public/mocks';
import useObservable from 'react-use/lib/useObservable';

jest.mock('react-use/lib/useObservable');
const useObservableSpy = useObservable as any as jest.SpyInstance;
useObservableSpy.mockImplementation((observable, def) => def);

const mock = (): [KibanaServices, Subject<any>] => {
  const core = coreMock.createStart();
  const get = core.settings.client.get;
  const get$ = core.settings.client.get$;
  const subject = new Subject();

  get.mockImplementation(() => 'bar');
  get$.mockImplementation(() => subject);

  return [core, subject];
};

let container: HTMLDivElement | null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  useObservableSpy.mockClear();
});

afterEach(() => {
  document.body.removeChild(container!);
  container = null;
});

describe('useUiSetting', () => {
  const TestConsumer: React.FC<{
    setting: string;
    newValue?: string;
  }> = ({ setting, newValue = '' }) => {
    const [value, set] = useUiSetting$(setting, 'DEFAULT');

    return (
      <div>
        {setting}: <strong>{value}</strong>
        <button onClick={() => set(newValue)}>Set new value!</button>
      </div>
    );
  };

  test('returns setting value', async () => {
    const [core] = mock();
    const { Provider } = createKibanaReactContext(core);

    ReactDOM.render(
      <Provider>
        <TestConsumer setting="foo" />
      </Provider>,
      container
    );

    const strong = container!.querySelector('strong');
    expect(strong!.textContent).toBe('bar');
    expect(core.settings!.client.get).toHaveBeenCalledTimes(1);
    expect((core.settings!.client.get as any).mock.calls[0][0]).toBe('foo');
  });

  test('calls uiSettings.get() method with correct key and default value', async () => {
    const [core] = mock();
    const { Provider } = createKibanaReactContext(core);

    ReactDOM.render(
      <Provider>
        <TestConsumer setting="foo" />
      </Provider>,
      container
    );

    expect(core.uiSettings!.get).toHaveBeenCalledTimes(0);
    expect(core.settings!.client.get).toHaveBeenCalledTimes(1);
    expect((core.settings!.client.get as any).mock.calls[0][0]).toBe('foo');
    expect((core.settings!.client.get as any).mock.calls[0][1]).toBe('DEFAULT');
  });
});

describe('useGlobalUiSetting', () => {
  const mockGlobal = (): [KibanaServices, Subject<any>] => {
    const core = coreMock.createStart();
    const get = core.settings.globalClient.get;
    const get$ = core.settings.globalClient.get$;
    const subject = new Subject();

    get.mockImplementation(() => 'baz');
    get$.mockImplementation(() => subject);

    return [core, subject];
  };

  const TestConsumer: React.FC<{
    setting: string;
    newValue?: string;
  }> = ({ setting, newValue = '' }) => {
    const [value, set] = useGlobalUiSetting$(setting, 'default');

    return (
      <div>
        {setting}: <strong>{value}</strong>
        <button onClick={() => set(newValue)}>Set new value!</button>
      </div>
    );
  };

  test('returns setting value', async () => {
    const [core] = mockGlobal();
    const { Provider } = createKibanaReactContext(core);

    ReactDOM.render(
      <Provider>
        <TestConsumer setting="foo" />
      </Provider>,
      container
    );

    const strong = container!.querySelector('strong');
    expect(strong!.textContent).toBe('baz');
    expect(core.settings!.globalClient.get).toHaveBeenCalledTimes(1);
    expect((core.settings!.globalClient.get as any).mock.calls[0][0]).toBe('foo');
  });

  test('calls uiSettings.get() method with correct key and default value', async () => {
    const [core] = mockGlobal();
    const { Provider } = createKibanaReactContext(core);

    ReactDOM.render(
      <Provider>
        <TestConsumer setting="fooBar" />
      </Provider>,
      container
    );

    expect(core.settings!.globalClient.get).toHaveBeenCalledTimes(1);
    expect((core.settings!.globalClient.get as any).mock.calls[0][0]).toBe('fooBar');
    expect((core.settings!.globalClient.get as any).mock.calls[0][1]).toBe('default');
  });
});

describe('useUiSetting$', () => {
  const TestConsumerX: React.FC<{
    setting: string;
    newValue?: string;
  }> = ({ setting, newValue = '' }) => {
    const [value, set] = useUiSetting$(setting, 'DEFAULT');

    return (
      <div>
        {setting}: <strong>{value}</strong>
        <button onClick={() => set(newValue)}>Set new value!</button>
      </div>
    );
  };

  test('synchronously renders setting value', async () => {
    const [core] = mock();
    const { Provider } = createKibanaReactContext(core);

    ReactDOM.render(
      <Provider>
        <TestConsumerX setting="foo" />
      </Provider>,
      container
    );

    const strong = container!.querySelector('strong');
    expect(strong!.textContent).toBe('bar');
    expect(core.settings!.client.get).toHaveBeenCalledTimes(1);
    expect((core.settings!.client.get as any).mock.calls[0][0]).toBe('foo');
  });

  test('calls Core with correct arguments', async () => {
    const core = coreMock.createStart();
    const { Provider } = createKibanaReactContext(core);

    ReactDOM.render(
      <Provider>
        <TestConsumerX setting="non_existing" />
      </Provider>,
      container
    );

    expect(core.settings!.client.get).toHaveBeenCalledWith('non_existing', 'DEFAULT');
  });

  test('subscribes to observable using useObservable', async () => {
    const [core, subject] = mock();
    const { Provider } = createKibanaReactContext(core);

    expect(useObservableSpy).toHaveBeenCalledTimes(0);

    ReactDOM.render(
      <Provider>
        <TestConsumerX setting="theme:darkMode" />
      </Provider>,
      container
    );

    expect(useObservableSpy).toHaveBeenCalledTimes(1);
    expect(useObservableSpy.mock.calls[0][0]).toBe(subject);
  });

  test('can set new hook value', async () => {
    const [core] = mock();
    const { Provider } = createKibanaReactContext(core);

    ReactDOM.render(
      <Provider>
        <TestConsumerX setting="a" newValue="c" />
      </Provider>,
      container
    );

    expect(core.uiSettings!.set).toHaveBeenCalledTimes(0);

    act(() => {
      Simulate.click(container!.querySelector('button')!, {});
    });

    expect(core.settings!.client.set).toHaveBeenCalledTimes(1);
    expect(core.settings!.client.set).toHaveBeenCalledWith('a', 'c');
  });
});
