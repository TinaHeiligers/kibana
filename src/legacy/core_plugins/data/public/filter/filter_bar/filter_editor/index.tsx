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

import {
  EuiButton,
  EuiButtonEmpty,
  // @ts-ignore
  EuiCodeEditor,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiForm,
  EuiFormRow,
  EuiPopoverTitle,
  EuiSpacer,
  EuiSwitch,
  EuiTabs,
  EuiTab,
} from '@elastic/eui';
import { FieldFilter, Filter, KibanaQueryBarData } from '@kbn/es-query';
import { i18n } from '@kbn/i18n';
import { FormattedMessage, InjectedIntl, injectI18n } from '@kbn/i18n/react';
import { get, isEqual } from 'lodash';
import React, { Component } from 'react';
import { UiSettingsClientContract } from 'kibana/public';
import { TimeHistoryContract } from 'ui/timefilter';
import { Field, IndexPattern } from '../../../index_patterns';
import { SavedQuery } from '../../../search/search_bar/index';
import { GenericComboBox, GenericComboBoxProps } from './generic_combo_box';
import {
  buildCustomFilter,
  buildFilter,
  getFieldFromFilter,
  getFilterableFields,
  getFilterParams,
  getIndexPatternFromFilter,
  getOperatorFromFilter,
  getOperatorOptions,
  getQueryDslFromFilter,
  isFilterValid,
  buildFilterFromSavedQuery,
  getSavedQueryFromFilter,
  getKibanaQueryBarDataFromFilter,
  buildFilterFromKibanaQueryBarData,
} from './lib/filter_editor_utils';
import { Operator } from './lib/filter_operators';
import { PhraseValueInput } from './phrase_value_input';
import { PhrasesValuesInput } from './phrases_values_input';
import { RangeValueInput } from './range_value_input';
import { SavedQueryService } from '../../../search/search_bar/lib/saved_query_service';
import { SearchBarEditor } from './search_bar_editor';

interface Props {
  filter: Filter;
  indexPatterns: IndexPattern[];
  onSubmit: (filter: Filter) => void;
  onCancel: () => void;
  intl: InjectedIntl;
  uiSettings: UiSettingsClientContract;
  savedQueryService: SavedQueryService;
  showSaveQuery?: boolean;
  timeHistory?: TimeHistoryContract;
}

interface State {
  selectedIndexPattern?: IndexPattern;
  selectedField?: Field;
  selectedOperator?: Operator;
  params: any;
  useCustomLabel: boolean;
  customLabel: string | null;
  queryDsl: string;
  isCustomEditorOpen: boolean;
  isKibanaQueryBarDataEditorOpen: boolean;
  isRegularEditorOpen: boolean;
  isNewFilter: boolean;
  selectedSavedQuery?: SavedQuery[];
  selectedKibanaQueryBarData?: KibanaQueryBarData;
}

class FilterEditorUI extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      selectedIndexPattern: this.getIndexPatternFromFilter(),
      selectedField: this.getFieldFromFilter(),
      selectedOperator: this.getSelectedOperator(),
      params: getFilterParams(props.filter),
      useCustomLabel: props.filter.meta.alias !== null,
      customLabel: props.filter.meta.alias,
      queryDsl: JSON.stringify(getQueryDslFromFilter(props.filter), null, 2),
      isCustomEditorOpen: this.isUnknownFilterType(),
      isKibanaQueryBarDataEditorOpen: this.isKibanaQueryBarDataFilterType(),
      isRegularEditorOpen: this.isRegularFilterType(),
      isNewFilter: !props.filter.meta.type,
      selectedKibanaQueryBarData: getKibanaQueryBarDataFromFilter(props.filter),
    };
  }

  public render() {
    return (
      <div>
        <EuiPopoverTitle>
          <EuiFlexGroup alignItems="baseline" responsive={false}>
            <EuiFlexItem>
              {/* Toggles between add and edit depending on if we have a filter or not */}
              {this.state.isNewFilter ? (
                <FormattedMessage
                  id="data.filter.filterEditor.addFilterPopupTitle"
                  defaultMessage="Add a filter"
                />
              ) : (
                <FormattedMessage
                  id="data.filter.filterEditor.editFilterPopupTitle"
                  defaultMessage="Edit filter"
                />
              )}
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPopoverTitle>

        <div className="globalFilterItem__editorForm">
          <EuiForm>
            <EuiTabs display="condensed">
              <EuiTab
                disabled={!this.state.isNewFilter && this.isKibanaQueryBarDataFilterType()}
                onClick={this.openRegularEditor}
                aria-label={
                  this.state.isNewFilter
                    ? i18n.translate('data.filter.filterEditor.tab.create', {
                        defaultMessage: 'Create. Click to select.',
                      })
                    : i18n.translate('data.filter.filterEditor.tab.edit', {
                        defaultMessage: 'Edit. Click to select.',
                      })
                }
              >
                {this.state.isNewFilter ? (
                  <FormattedMessage
                    id="data.filter.filterEditor.tabCreateFilterPopupTitle"
                    defaultMessage="Create"
                  />
                ) : (
                  <FormattedMessage
                    id="data.filter.filterEditor.tabEditFilterPopupTitle"
                    defaultMessage="Edit"
                  />
                )}
              </EuiTab>
              {this.props.showSaveQuery && (
                <EuiTab
                  disabled={!this.state.isNewFilter && !this.isKibanaQueryBarDataFilterType()}
                  onClick={this.openKibanaQueryBarDataEditor}
                  aria-label={
                    this.state.isNewFilter
                      ? i18n.translate('data.filter.filterEditor.tab.useSavedQuery', {
                          defaultMessage: 'Use a saved query. Click to select.',
                        })
                      : i18n.translate('data.filter.filterEditor.tab.changeSavedQuery', {
                          defaultMessage: 'Change saved query. Click to select.',
                        })
                  }
                >
                  {this.state.isNewFilter ? (
                    <FormattedMessage
                      id="data.filter.filterEditor.tabUseSavedQueryFilterPopupTitle"
                      defaultMessage="Use saved query"
                    />
                  ) : (
                    <FormattedMessage
                      id="data.filter.filterEditor.tabChangeSavedQueryFilterPopupTitle"
                      defaultMessage="Change saved query"
                    />
                  )}
                </EuiTab>
              )}
            </EuiTabs>
            <EuiFlexGroup direction={'rowReverse'}>
              <EuiFlexItem grow={false}>
                {/* only render the option for using DSL when we're not working with KibanaQueryBarData filters */}
                {!this.state.isKibanaQueryBarDataEditorOpen && (
                  <EuiButtonEmpty size="xs" onClick={this.toggleCustomEditor}>
                    {this.state.isCustomEditorOpen ? (
                      this.state.isNewFilter ? (
                        <FormattedMessage
                          id="data.filter.filterEditor.editFilterValuesButtonLabel"
                          defaultMessage="Create filter values"
                        />
                      ) : (
                        <FormattedMessage
                          id="data.filter.filterEditor.editFilterValuesButtonLabel"
                          defaultMessage="Edit filter values"
                        />
                      )
                    ) : this.state.isNewFilter ? (
                      <FormattedMessage
                        id="data.filter.filterEditor.editQueryDslButtonLabel"
                        defaultMessage="Create as Query DSL"
                      />
                    ) : (
                      <FormattedMessage
                        id="data.filter.filterEditor.editQueryDslButtonLabel"
                        defaultMessage="Edit as Query DSL"
                      />
                    )}
                  </EuiButtonEmpty>
                )}
              </EuiFlexItem>
            </EuiFlexGroup>
            {/* only show the index pattern if we're not working with a saved query filter */}
            {!this.state.isKibanaQueryBarDataEditorOpen && this.renderIndexPatternInput()}

            {this.renderEditor()}

            <EuiSpacer size="m" />

            <EuiSwitch
              id="filterEditorCustomLabelSwitch"
              label={this.props.intl.formatMessage({
                id: 'data.filter.filterEditor.createCustomLabelSwitchLabel',
                defaultMessage: 'Create custom label?',
              })}
              checked={this.state.useCustomLabel}
              onChange={this.onCustomLabelSwitchChange}
            />

            {this.state.useCustomLabel && (
              <div>
                <EuiSpacer size="m" />
                <EuiFormRow
                  label={this.props.intl.formatMessage({
                    id: 'data.filter.filterEditor.createCustomLabelInputLabel',
                    defaultMessage: 'Custom label',
                  })}
                >
                  <EuiFieldText
                    value={`${this.state.customLabel}`}
                    onChange={this.onCustomLabelChange}
                  />
                </EuiFormRow>
              </div>
            )}

            <EuiSpacer size="m" />

            <EuiFlexGroup direction="rowReverse" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButton
                  fill
                  onClick={this.onSubmit}
                  isDisabled={!this.isFilterValid()}
                  data-test-subj="saveFilter"
                >
                  <FormattedMessage
                    id="data.filter.filterEditor.saveButtonLabel"
                    defaultMessage="Save"
                  />
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  flush="right"
                  onClick={this.props.onCancel}
                  data-test-subj="cancelSaveFilter"
                >
                  <FormattedMessage
                    id="data.filter.filterEditor.cancelButtonLabel"
                    defaultMessage="Cancel"
                  />
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem />
            </EuiFlexGroup>
          </EuiForm>
        </div>
      </div>
    );
  }
  private renderEditor() {
    if (this.state.isCustomEditorOpen) {
      return this.renderCustomEditor();
    } else if (this.state.isKibanaQueryBarDataEditorOpen) {
      return this.renderKibanaQueryBarDataEditor();
    } else {
      return this.renderRegularEditor();
    }
  }

  private renderIndexPatternInput() {
    if (
      this.props.indexPatterns.length <= 1 &&
      this.props.indexPatterns.find(
        indexPattern => indexPattern === this.state.selectedIndexPattern
      )
    ) {
      return '';
    }
    const { selectedIndexPattern } = this.state;
    return (
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiFormRow
            label={this.props.intl.formatMessage({
              id: 'data.filter.filterEditor.indexPatternSelectLabel',
              defaultMessage: 'Index Pattern',
            })}
          >
            <IndexPatternComboBox
              placeholder={this.props.intl.formatMessage({
                id: 'data.filter.filterBar.indexPatternSelectPlaceholder',
                defaultMessage: 'Select an index pattern',
              })}
              options={this.props.indexPatterns}
              selectedOptions={selectedIndexPattern ? [selectedIndexPattern] : []}
              getLabel={indexPattern => indexPattern.title}
              onChange={this.onIndexPatternChange}
              singleSelection={{ asPlainText: true }}
              isClearable={false}
              data-test-subj="filterIndexPatternsSelect"
            />
          </EuiFormRow>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  private renderRegularEditor() {
    return (
      <div>
        <EuiFlexGroup responsive={false} gutterSize="s">
          <EuiFlexItem grow={2}>{this.renderFieldInput()}</EuiFlexItem>
          <EuiFlexItem grow={false} style={{ flexBasis: 160 }}>
            {this.renderOperatorInput()}
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="s" />
        <div data-test-subj="filterParams">{this.renderParamsEditor()}</div>
      </div>
    );
  }

  private renderFieldInput() {
    const { selectedIndexPattern, selectedField } = this.state;
    const fields = selectedIndexPattern ? getFilterableFields(selectedIndexPattern) : [];
    return (
      <EuiFormRow
        label={this.props.intl.formatMessage({
          id: 'data.filter.filterEditor.fieldSelectLabel',
          defaultMessage: 'Field',
        })}
      >
        <FieldComboBox
          id="fieldInput"
          isDisabled={!selectedIndexPattern}
          placeholder={this.props.intl.formatMessage({
            id: 'data.filter.filterEditor.fieldSelectPlaceholder',
            defaultMessage: 'Select a field first',
          })}
          options={fields}
          selectedOptions={selectedField ? [selectedField] : []}
          getLabel={field => field.name}
          onChange={this.onFieldChange}
          singleSelection={{ asPlainText: true }}
          isClearable={false}
          data-test-subj="filterFieldSuggestionList"
        />
      </EuiFormRow>
    );
  }

  private renderOperatorInput() {
    const { selectedField, selectedOperator } = this.state;
    const operators = selectedField ? getOperatorOptions(selectedField) : [];
    return (
      <EuiFormRow
        label={this.props.intl.formatMessage({
          id: 'data.filter.filterEditor.operatorSelectLabel',
          defaultMessage: 'Operator',
        })}
      >
        <OperatorComboBox
          isDisabled={!selectedField}
          placeholder={
            selectedField
              ? this.props.intl.formatMessage({
                  id: 'data.filter.filterEditor.operatorSelectPlaceholderSelect',
                  defaultMessage: 'Select',
                })
              : this.props.intl.formatMessage({
                  id: 'data.filter.filterEditor.operatorSelectPlaceholderWaiting',
                  defaultMessage: 'Waiting',
                })
          }
          options={operators}
          selectedOptions={selectedOperator ? [selectedOperator] : []}
          getLabel={({ message }) => message}
          onChange={this.onOperatorChange}
          singleSelection={{ asPlainText: true }}
          isClearable={false}
          data-test-subj="filterOperatorList"
        />
      </EuiFormRow>
    );
  }

  private renderCustomEditor() {
    return (
      <EuiFormRow
        label={i18n.translate('data.filter.filterEditor.queryDslLabel', {
          defaultMessage: 'Elasticsearch Query DSL',
        })}
      >
        <EuiCodeEditor
          value={this.state.queryDsl}
          onChange={this.onQueryDslChange}
          mode="json"
          width="100%"
          height="250px"
        />
      </EuiFormRow>
    );
  }

  private renderParamsEditor() {
    const indexPattern = this.state.selectedIndexPattern;
    if (!indexPattern || !this.state.selectedOperator) {
      return '';
    }

    switch (this.state.selectedOperator.type) {
      case 'exists':
        return '';
      case 'phrase':
        return (
          <PhraseValueInput
            indexPattern={indexPattern}
            field={this.state.selectedField}
            value={this.state.params}
            onChange={this.onParamsChange}
            data-test-subj="phraseValueInput"
          />
        );
      case 'phrases':
        return (
          <PhrasesValuesInput
            indexPattern={indexPattern}
            field={this.state.selectedField}
            values={this.state.params}
            onChange={this.onParamsChange}
          />
        );
      case 'range':
        return (
          <RangeValueInput
            field={this.state.selectedField}
            value={this.state.params}
            onChange={this.onParamsChange}
          />
        );
    }
  }

  public onKibanaQueryBarDataSelected = (selectedKibanaQueryBarData: KibanaQueryBarData) => {
    // if what we're getting isn't the same as what we have on state, then change state
    // note that on state, we potentially have a duplicate of the selectedKibanaQueryBarData as the params. Params, however, change with other filter types.
    if (
      isEqual(this.state.params, this.state.selectedKibanaQueryBarData) &&
      !isEqual(selectedKibanaQueryBarData, this.state.selectedKibanaQueryBarData)
    ) {
      const updatedParams = selectedKibanaQueryBarData;
      this.setState({ selectedKibanaQueryBarData, params: updatedParams });
    }
  };

  private renderKibanaQueryBarDataEditor() {
    return (
      <div className="kibanaQueryBarDataEditor">
        <SearchBarEditor
          currentKibanaQueryBarData={this.state.selectedKibanaQueryBarData}
          uiSettings={this.props.uiSettings}
          indexPatterns={
            this.state.selectedIndexPattern
              ? [this.state.selectedIndexPattern]
              : this.props.indexPatterns
          }
          showSaveQuery={this.props.showSaveQuery!}
          timeHistory={this.props.timeHistory!}
          onSelectionChange={this.onKibanaQueryBarDataSelected}
        />
      </div>
    );
  }

  // TOGGLE EDITORS OPEN AND CLOSED

  private openCustomEditor = () => {
    this.setState({ isCustomEditorOpen: true });
  };

  private closeCustomEditor = () => {
    this.setState({ isCustomEditorOpen: false });
  };

  private toggleCustomEditor = () => {
    this.closeKibanaQueryBarDataEditor();
    const isCustomEditorOpen = !this.state.isCustomEditorOpen;
    this.setState({ isCustomEditorOpen });
  };

  private openRegularEditor = () => {
    this.closeKibanaQueryBarDataEditor();
    this.closeCustomEditor();
    this.setState({ isRegularEditorOpen: true });
  };

  private closeRegularEditor = () => {
    this.setState({ isRegularEditorOpen: false });
  };

  // private toggleRegularEditor = () => {
  //   // close the saved query editor if it is open
  //   if (this.state.isKibanaQueryBarDataEditorOpen) {
  //     this.closeKibanaQueryBarDataEditor();
  //   }
  //   if (this.state.isCustomEditorOpen) {
  //     this.toggleCustomEditor();
  //   }
  //   const isRegularEditorOpen = !this.state.isRegularEditorOpen;
  //   this.setState({ isRegularEditorOpen });
  // };

  private closeKibanaQueryBarDataEditor = () => {
    this.setState({ isKibanaQueryBarDataEditorOpen: false });
  };
  private openKibanaQueryBarDataEditor = () => {
    this.closeCustomEditor();
    this.closeRegularEditor();
    this.setState({ isKibanaQueryBarDataEditorOpen: true });
  };

  // private toggleKibanaQueryBarDataEditor = () => {
  //   // close the custom query editor if it is open
  //   if (this.state.isCustomEditorOpen) {
  //     this.toggleCustomEditor();
  //   }
  //   if (this.state.isRegularEditorOpen) {
  //     this.toggleRegularEditor();
  //   }
  //   const isKibanaQueryBarDataEditorOpen = !this.state.isKibanaQueryBarDataEditorOpen;
  //   this.setState({ isKibanaQueryBarDataEditorOpen });
  // };

  private isUnknownFilterType() {
    const { type } = this.props.filter.meta;
    return !!type && !['phrase', 'phrases', 'range', 'exists', 'savedQuery'].includes(type);
  }

  // private isSavedQueryFilterType = () => {
  //   const { type } = this.props.filter.meta;
  //   return !!type && ['savedQuery'].includes(type);
  // };

  private isKibanaQueryBarDataFilterType = () => {
    const { type } = this.props.filter.meta;
    return !!type && ['kibanaQueryBarData'].includes(type);
  };

  private isRegularFilterType = () => {
    const { type } = this.props.filter.meta;
    return !!type && ['phrase', 'phrases', 'range', 'exists'].includes(type);
  };

  private getIndexPatternFromFilter() {
    return getIndexPatternFromFilter(this.props.filter, this.props.indexPatterns);
  }

  private getFieldFromFilter() {
    const indexPattern = this.getIndexPatternFromFilter();
    return indexPattern && getFieldFromFilter(this.props.filter as FieldFilter, indexPattern);
  }

  private getSelectedOperator() {
    return getOperatorFromFilter(this.props.filter);
  }

  private getKibanaQueryBarDataFromFilter() {
    if (this.isKibanaQueryBarDataFilterType()) {
      return getKibanaQueryBarDataFromFilter({ ...this.props.filter });
    }
  }

  // private getSavedQueryFromFilter() {
  //   if (this.isSavedQueryFilterType()) {
  //     const savedQueryfilter = { ...this.props.filter };
  //     if (
  //       savedQueryfilter &&
  //       savedQueryfilter.meta.params &&
  //       savedQueryfilter.meta.params.savedQuery
  //     ) {
  //       return getSavedQueryFromFilter(savedQueryfilter);
  //     }
  //   }
  // }

  private isFilterValid() {
    const {
      isCustomEditorOpen,
      isKibanaQueryBarDataEditorOpen,
      queryDsl,
      selectedIndexPattern: indexPattern,
      selectedField: field,
      selectedOperator: operator,
      selectedKibanaQueryBarData,
      params,
    } = this.state;

    if (isCustomEditorOpen) {
      try {
        return Boolean(JSON.parse(queryDsl));
      } catch (e) {
        return false;
      }
    } else if (isKibanaQueryBarDataEditorOpen) {
      return !!selectedKibanaQueryBarData && isEqual(selectedKibanaQueryBarData, params);
    }

    return isFilterValid(indexPattern, field, operator, params);
  }

  private onIndexPatternChange = ([selectedIndexPattern]: IndexPattern[]) => {
    const selectedField = undefined;
    const selectedOperator = undefined;
    const params = undefined;
    this.setState({ selectedIndexPattern, selectedField, selectedOperator, params });
  };

  private onFieldChange = ([selectedField]: Field[]) => {
    const selectedOperator = undefined;
    const params = undefined;
    this.setState({ selectedField, selectedOperator, params });
  };

  private onOperatorChange = ([selectedOperator]: Operator[]) => {
    // Only reset params when the operator type changes
    const params =
      get(this.state.selectedOperator, 'type') === get(selectedOperator, 'type')
        ? this.state.params
        : undefined;
    this.setState({ selectedOperator, params });
  };

  private onCustomLabelSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const useCustomLabel = event.target.checked;
    const customLabel = event.target.checked ? '' : null;
    this.setState({ useCustomLabel, customLabel });
  };

  private onCustomLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const customLabel = event.target.value;
    this.setState({ customLabel });
  };

  private onParamsChange = (params: any) => {
    this.setState({ params });
  };

  private onQueryDslChange = (queryDsl: string) => {
    this.setState({ queryDsl });
  };

  private onSubmit = () => {
    const {
      selectedIndexPattern: indexPattern,
      selectedField: field,
      selectedOperator: operator,
      params,
      useCustomLabel,
      customLabel,
      isCustomEditorOpen,
      isKibanaQueryBarDataEditorOpen,
      queryDsl,
      selectedKibanaQueryBarData,
    } = this.state;

    const { $state } = this.props.filter;
    if (!$state || !$state.store) {
      return; // typescript validation
    }
    const alias = useCustomLabel ? customLabel : null;

    if (isCustomEditorOpen) {
      const { index, disabled, negate } = this.props.filter.meta;
      const newIndex = index || this.props.indexPatterns[0].id!;
      const body = JSON.parse(queryDsl);
      const filter = buildCustomFilter(newIndex, body, disabled, negate, alias, $state.store);
      this.props.onSubmit(filter);
    } else if (indexPattern && field && operator) {
      const filter = buildFilter(
        indexPattern,
        field,
        operator,
        this.props.filter.meta.disabled,
        params,
        alias,
        $state.store
      );
      this.props.onSubmit(filter);
    } else if (isKibanaQueryBarDataEditorOpen && selectedKibanaQueryBarData) {
      const filter = buildFilterFromKibanaQueryBarData(
        this.props.filter.meta.disabled,
        params,
        alias,
        $state.store
      );
      this.props.onSubmit(filter);
    }
  };
}

function IndexPatternComboBox(props: GenericComboBoxProps<IndexPattern>) {
  return GenericComboBox(props);
}

function FieldComboBox(props: GenericComboBoxProps<Field>) {
  return GenericComboBox(props);
}

function OperatorComboBox(props: GenericComboBoxProps<Operator>) {
  return GenericComboBox(props);
}

export const FilterEditor = injectI18n(FilterEditorUI);
