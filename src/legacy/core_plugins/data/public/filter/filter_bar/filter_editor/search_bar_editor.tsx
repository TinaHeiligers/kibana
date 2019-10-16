/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { FunctionComponent, useState } from 'react';
import { SavedQuery } from '@kbn/es-query/src/filters/lib/saved_query_filter';
import { UiSettingsClientContract } from 'kibana/public';
import { EuiButtonEmpty } from '@elastic/eui';
import { EuiPopover } from '@elastic/eui';
import { TimeHistoryContract } from 'ui/timefilter';
import { Filter } from '@kbn/es-query';
import { TimeRange } from 'src/plugins/data/common/types';
import { IndexPattern, Query } from '../../..';
import { SearchBar } from '../../../search/search_bar/components/search_bar';
/*
TODO: figure out how to import and use the Stateful SearchBar. So far, the following cause webpack errors:
// import { SearchBarProps } from '../../../../../../core_plugins/data/public';
// import { start as data } from '../../../../../data/public/legacy';
// import { start as data } from '../../../legacy';
// const { SearchBar } = data.ui;

Take a look at the graph app implementation: x-pack/legacy/plugins/graph/public/components/app.tsx
*/
interface Props {
  uiSettings: UiSettingsClientContract;
  currentSavedQuery?: SavedQuery[];
  indexPatterns: IndexPattern[];
  showSaveQuery: boolean;
  timeHistory?: TimeHistoryContract; // I need some other way of accessing timeHistory rather than passing it down all the way from the search bar
  onChange: (item: any) => void;
}
export const SearchBarEditor: FunctionComponent<Props> = ({
  uiSettings,
  currentSavedQuery,
  indexPatterns,
  showSaveQuery,
  timeHistory,
  onChange,
}) => {
  const [data, setData] = useState({ dateRange: {}, query: {}, filters: [] });
  const onClearSavedQuery = () => {
    // console.log('saved query cleared');
  };
  const onQueryDataChange = (queryAndDateRange: { dateRange: TimeRange; query?: Query }) => {
    const dateRange = queryAndDateRange.dateRange;
    const query = queryAndDateRange.query
      ? queryAndDateRange.query
      : { query: '', language: 'kuery' };
    // console.log('queryAndDateRange changed with dateRange:', dateRange);
    // console.log('queryAndDateRange changed with query:', query);
    // add to the items on the search bar data
    const newData = { ...data, dateRange, query };
    setData(newData);
    // onChange(queryAndDateRange);
    return queryAndDateRange;
  };
  const onFiltersUpdated = (newFilters: Filter[] | any) => {
    // I seem to get the filters back and can update them from here.
    // console.log('filtersUpdated, filters?', newFilters);
    if (newFilters.length > 0) {
      const newData = { ...data, filters: newFilters };
      setData(newData);
    }
    return newFilters;
  };
  return (
    <div className="savedQueryFilterEditor">
      <SearchBar
        indexPatterns={indexPatterns}
        showFilterBar={true}
        filters={
          currentSavedQuery &&
          currentSavedQuery.length > 0 &&
          currentSavedQuery[0].attributes.filters &&
          currentSavedQuery[0].attributes.filters.length > 0
            ? currentSavedQuery[0].attributes.filters
            : []
        }
        onFiltersUpdated={onFiltersUpdated}
        showQueryInput={true}
        query={
          currentSavedQuery && currentSavedQuery.length > 0
            ? {
                language: currentSavedQuery[0].attributes.query.language,
                query: currentSavedQuery[0].attributes.query.query,
              }
            : { language: uiSettings.get('search:queryLanguage'), query: '' }
        }
        onQueryChange={onQueryDataChange}
        showSaveQuery={showSaveQuery}
        savedQuery={
          currentSavedQuery && currentSavedQuery.length > 0 ? currentSavedQuery[0] : undefined
        }
        onClearSavedQuery={onClearSavedQuery}
        showDatePicker={true}
        timeHistory={timeHistory!}
        customSubmitButton={null}
      />
    </div>
  );
};
