/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ReactElement } from 'react';
import React from 'react';
import { mountWithIntl } from '@kbn/test-jest-helpers';
import { dataViewMock } from '@kbn/discover-utils/src/__mocks__';
import type { DiscoverTopNavProps } from './discover_topnav';
import { DiscoverTopNav } from './discover_topnav';
import type { TopNavMenuData } from '@kbn/navigation-plugin/public';
import { TopNavMenu } from '@kbn/navigation-plugin/public';
import { sharePluginMock } from '@kbn/share-plugin/public/mocks';
import { discoverServiceMock as mockDiscoverService } from '../../../../__mocks__/services';
import { getDiscoverStateMock } from '../../../../__mocks__/discover_state.mock';
import type { SearchBarCustomization, TopNavCustomization } from '../../../../customizations';
import type { DiscoverCustomizationId } from '../../../../customizations/customization_service';
import { useDiscoverCustomization } from '../../../../customizations';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import { internalStateActions } from '../../state_management/redux';
import { DiscoverTestProvider } from '../../../../__mocks__/test_provider';

jest.mock('@kbn/kibana-react-plugin/public', () => ({
  ...jest.requireActual('@kbn/kibana-react-plugin/public'),
  useKibana: jest.fn(),
}));

const MockCustomSearchBar: typeof mockDiscoverService.navigation.ui.AggregateQueryTopNavMenu =
  () => <div data-test-subj="custom-search-bar" />;

const mockTopNavCustomization: TopNavCustomization = {
  id: 'top_nav',
};

const mockSearchBarCustomization: SearchBarCustomization = {
  id: 'search_bar',
  CustomDataViewPicker: jest.fn(() => <div data-test-subj="custom-data-view-picker" />),
};

const mockSearchBarCustomizationWithCustomSearchBar: SearchBarCustomization = {
  id: 'search_bar',
  CustomSearchBar: MockCustomSearchBar,
};

const mockSearchBarCustomizationWithHiddenDataViewPicker: SearchBarCustomization = {
  id: 'search_bar',
  hideDataViewPicker: true,
};

let mockUseCustomizations = false;

jest.mock('../../../../customizations', () => ({
  ...jest.requireActual('../../../../customizations'),
  useDiscoverCustomization: jest.fn(),
}));

const mockDefaultCapabilities = {
  discover_v2: { save: true },
} as unknown as typeof mockDiscoverService.capabilities;

function getProps(
  {
    capabilities,
  }: {
    capabilities?: Partial<typeof mockDiscoverService.capabilities>;
  } = { capabilities: mockDefaultCapabilities }
): DiscoverTopNavProps {
  if (capabilities) {
    mockDiscoverService.capabilities = capabilities as typeof mockDiscoverService.capabilities;
  }
  const stateContainer = getDiscoverStateMock({ isTimeBased: true });
  stateContainer.internalState.dispatch(
    stateContainer.injectCurrentTab(internalStateActions.setDataView)({ dataView: dataViewMock })
  );

  return {
    stateContainer,
    savedQuery: '',
    onFieldEdited: jest.fn(),
  };
}

const mockUseKibana = useKibana as jest.Mock;
const getTestComponent = (props: DiscoverTopNavProps) =>
  mountWithIntl(
    <DiscoverTestProvider
      services={mockDiscoverService}
      stateContainer={props.stateContainer}
      runtimeState={{ currentDataView: dataViewMock, adHocDataViews: [] }}
    >
      <DiscoverTopNav {...props} />
    </DiscoverTestProvider>
  );

describe('Discover topnav component', () => {
  beforeEach(() => {
    mockTopNavCustomization.defaultMenu = undefined;
    mockUseCustomizations = false;
    jest.clearAllMocks();

    (useDiscoverCustomization as jest.Mock).mockImplementation((id: DiscoverCustomizationId) => {
      if (!mockUseCustomizations) {
        return undefined;
      }

      switch (id) {
        case 'top_nav':
          return mockTopNavCustomization;
        case 'search_bar':
          return mockSearchBarCustomization;
        default:
          throw new Error(`Unknown customization id: ${id}`);
      }
    });

    mockUseKibana.mockReturnValue({
      services: mockDiscoverService,
    });
  });

  test('generated config of TopNavMenu config is correct when discover save permissions are assigned', () => {
    const props = getProps({ capabilities: { discover_v2: { save: true } } });
    const component = getTestComponent(props);
    const topNavMenu = component.find(TopNavMenu);
    const topMenuConfig = topNavMenu.props().config?.map((obj: TopNavMenuData) => obj.id);
    expect(topMenuConfig).toEqual(['inspect', 'new', 'open', 'save']);
  });

  test('generated config of TopNavMenu config is correct when no discover save permissions are assigned', () => {
    const props = getProps({ capabilities: { discover_v2: { save: false } } });
    const component = getTestComponent(props);

    const topNavMenu = component.find(TopNavMenu).props();
    const topMenuConfig = topNavMenu.config?.map((obj: TopNavMenuData) => obj.id);
    expect(topMenuConfig).toEqual(['inspect', 'new', 'open']);
  });

  describe('top nav customization', () => {
    it('should allow disabling default menu items', () => {
      mockUseCustomizations = true;
      mockTopNavCustomization.defaultMenu = {
        newItem: { disabled: true },
        openItem: { disabled: true },
        shareItem: { disabled: true },
        alertsItem: { disabled: true },
        inspectItem: { disabled: true },
        saveItem: { disabled: true },
      };
      const props = getProps();
      const component = getTestComponent(props);

      const topNavMenu = component.find(TopNavMenu);
      const topMenuConfig = topNavMenu.props().config?.map((obj: TopNavMenuData) => obj.id);
      expect(topMenuConfig).toEqual([]);
    });

    describe('share service available', () => {
      beforeAll(() => {
        mockDiscoverService.share = sharePluginMock.createStartContract();
      });

      afterAll(() => {
        mockDiscoverService.share = undefined;
      });

      it('will include share menu item if the share service is available', () => {
        const props = getProps();
        const component = getTestComponent(props);

        const topNavMenu = component.find(TopNavMenu);
        const topMenuConfig = topNavMenu.props().config?.map((obj: TopNavMenuData) => obj.id);
        expect(topMenuConfig).toEqual(['inspect', 'new', 'open', 'share', 'save']);
      });

      it('will include export menu item if there are export integrations available', () => {
        const availableIntegrationsSpy = jest.spyOn(
          mockDiscoverService.share!,
          'availableIntegrations'
        );

        availableIntegrationsSpy.mockImplementation((_objectType, groupId) => {
          if (groupId === 'export') {
            return [
              {
                id: 'export',
                shareType: 'integration',
                groupId: 'export',
                config: () => ({}),
              },
            ];
          }

          return [];
        });

        const props = getProps();
        const component = getTestComponent(props);

        const topNavMenu = component.find(TopNavMenu).props();
        const topMenuConfig = topNavMenu.config?.map((obj: TopNavMenuData) => obj.id);
        expect(topMenuConfig).toEqual(['inspect', 'new', 'open', 'export', 'share', 'save']);
      });
    });
  });

  describe('search bar customization', () => {
    it('should render custom Search Bar', () => {
      (useDiscoverCustomization as jest.Mock).mockImplementation((id: DiscoverCustomizationId) => {
        if (id === 'search_bar') {
          return mockSearchBarCustomizationWithCustomSearchBar;
        }
      });

      const props = getProps();
      const component = getTestComponent(props);

      expect(component.find({ 'data-test-subj': 'custom-search-bar' })).toHaveLength(1);
    });

    it('should render CustomDataViewPicker', () => {
      mockUseCustomizations = true;
      const props = getProps();
      const component = getTestComponent(props);

      const topNav = component.find(mockDiscoverService.navigation.ui.AggregateQueryTopNavMenu);
      expect(topNav.prop('dataViewPickerComponentProps')).toBeUndefined();
      const dataViewPickerOverride = mountWithIntl(
        topNav.prop('dataViewPickerOverride') as ReactElement
      ).find(mockSearchBarCustomization.CustomDataViewPicker!);
      expect(dataViewPickerOverride.length).toBe(1);
    });

    it('should not render the dataView picker when hideDataViewPicker is true', () => {
      (useDiscoverCustomization as jest.Mock).mockImplementation((id: DiscoverCustomizationId) => {
        if (id === 'search_bar') {
          return mockSearchBarCustomizationWithHiddenDataViewPicker;
        }
      });

      const props = getProps();
      const component = getTestComponent(props);

      const topNav = component.find(mockDiscoverService.navigation.ui.AggregateQueryTopNavMenu);
      expect(topNav.prop('dataViewPickerComponentProps')).toBeUndefined();
    });
  });
});
