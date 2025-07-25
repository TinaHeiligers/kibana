/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import {
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiProgress,
  EuiText,
  EuiTextBlockTruncate,
  EuiThemeComputed,
  EuiToolTip,
  makeHighContrastColor,
  useEuiTheme,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { css } from '@emotion/react';
import type { IFieldSubTypeMulti } from '@kbn/es-query';
import type { DataViewField } from '@kbn/data-views-plugin/common';
import type { AddFieldFilterHandler } from '../../types';

export interface FieldTopValuesBucketParams {
  field: DataViewField;
  fieldValue: unknown;
  formattedFieldValue?: string;
  formattedPercentage: string;
  progressValue: number;
  count: number;
  color: string;
  type?: 'normal' | 'other';
}

export type OverrideFieldTopValueBarCallback = (
  params: FieldTopValuesBucketParams
) => Partial<FieldTopValuesBucketParams>;

export interface FieldTopValuesBucketProps extends FieldTopValuesBucketParams {
  'data-test-subj': string;
  onAddFilter?: AddFieldFilterHandler;
  /**
   * Optional callback to allow overriding props on bucket level
   */
  overrideFieldTopValueBar?: OverrideFieldTopValueBarCallback;
}

const FieldTopValuesBucket: React.FC<FieldTopValuesBucketProps> = ({
  'data-test-subj': dataTestSubject,
  onAddFilter,
  overrideFieldTopValueBar,
  ...fieldTopValuesBucketOverridableProps
}) => {
  const { euiTheme } = useEuiTheme();
  const overrides = overrideFieldTopValueBar
    ? overrideFieldTopValueBar(fieldTopValuesBucketOverridableProps)
    : ({} as FieldTopValuesBucketParams);

  const {
    field,
    type,
    fieldValue,
    formattedFieldValue,
    formattedPercentage,
    progressValue,
    count,
    color,
    textProps = {},
  } = { ...fieldTopValuesBucketOverridableProps, ...overrides };
  const fieldLabel = (field?.subType as IFieldSubTypeMulti)?.multi?.parent ?? field.name;

  const filterForLabel = i18n.translate('unifiedFieldList.fieldStats.filterValueButtonAriaLabel', {
    defaultMessage: 'Filter for {field}: "{value}"',
    values: { value: formattedFieldValue, field: fieldLabel },
  });
  const filterOutLabel = i18n.translate(
    'unifiedFieldList.fieldStats.filterOutValueButtonAriaLabel',
    {
      defaultMessage: 'Filter out {field}: "{value}"',
      values: { value: formattedFieldValue, field: fieldLabel },
    }
  );

  return (
    <EuiFlexGroup
      alignItems="stretch"
      gutterSize="s"
      responsive={false}
      data-test-subj={`${dataTestSubject}-topValues-bucket`}
    >
      <EuiFlexItem
        grow={1}
        css={css`
          min-width: 0;
        `}
      >
        <EuiProgress
          value={progressValue}
          max={1}
          size="s"
          color={type === 'other' ? 'subdued' : color}
          valueText={
            <div data-test-subj={`${dataTestSubject}-topValues-formattedPercentage`}>
              <EuiToolTip
                content={i18n.translate('unifiedFieldList.fieldStats.bucketPercentageTooltip', {
                  defaultMessage:
                    '{formattedPercentage} ({count, plural, one {# record} other {# records}})',
                  values: {
                    formattedPercentage,
                    count,
                  },
                })}
                delay="long"
              >
                <EuiText size="xs" textAlign="left" color={getPercentageColor(euiTheme, color)}>
                  {formattedPercentage}
                </EuiText>
              </EuiToolTip>
            </div>
          }
          label={
            <div
              data-test-subj={`${dataTestSubject}-topValues-formattedFieldValue`}
              css={css`
                overflow-wrap: anywhere;
              `}
            >
              {(formattedFieldValue?.length ?? 0) > 0 ? (
                <EuiToolTip content={formattedFieldValue} delay="long">
                  <EuiTextBlockTruncate lines={3}>
                    <EuiText size="xs" color={'subdued'} {...textProps}>
                      {formattedFieldValue}
                    </EuiText>
                  </EuiTextBlockTruncate>
                </EuiToolTip>
              ) : (
                <EuiText size="xs">
                  {type === 'other'
                    ? i18n.translate('unifiedFieldList.fieldStats.otherDocsLabel', {
                        defaultMessage: 'Other',
                      })
                    : formattedFieldValue === ''
                    ? i18n.translate('unifiedFieldList.fieldStats.emptyStringValueLabel', {
                        defaultMessage: '(empty)',
                      })
                    : '-'}
                </EuiText>
              )}
            </div>
          }
          labelProps={{
            title: undefined,
            css: css`
              white-space: unset !important;
            `,
          }}
        />
      </EuiFlexItem>
      {onAddFilter && field.filterable && (
        <EuiFlexItem grow={false}>
          {type === 'other' ? (
            <div
              css={css`
                width: 48px;
              `}
            />
          ) : (
            <div>
              <EuiToolTip content={filterForLabel} disableScreenReaderOutput>
                <EuiButtonIcon
                  iconSize="s"
                  iconType="plusInCircle"
                  onClick={() => onAddFilter(field, fieldValue, '+')}
                  aria-label={filterForLabel}
                  data-test-subj={`plus-${fieldLabel}-${fieldValue}`}
                  style={{
                    minHeight: 'auto',
                    minWidth: 'auto',
                    paddingRight: 2,
                    paddingLeft: 2,
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                />
              </EuiToolTip>
              <EuiToolTip content={filterOutLabel} disableScreenReaderOutput>
                <EuiButtonIcon
                  iconSize="s"
                  iconType="minusInCircle"
                  onClick={() => onAddFilter(field, fieldValue, '-')}
                  aria-label={filterOutLabel}
                  data-test-subj={`minus-${fieldLabel}-${fieldValue}`}
                  style={{
                    minHeight: 'auto',
                    minWidth: 'auto',
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingRight: 2,
                    paddingLeft: 2,
                  }}
                />
              </EuiToolTip>
            </div>
          )}
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );
};

// copied from x-pack/plugins/banners/server/utils.ts
const hexColorRegexp = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;
const isHexColor = (color: string) => {
  return hexColorRegexp.test(color);
};

const getPercentageColor = (euiTheme: EuiThemeComputed, color: string) =>
  euiTheme.themeName?.toLowerCase().includes('borealis') && isHexColor(color)
    ? makeHighContrastColor(color)(euiTheme)
    : color; // FIXME: remove in 9.x when Borealis becomes the default theme

// Necessary for React.lazy
// eslint-disable-next-line import/no-default-export
export default FieldTopValuesBucket;
