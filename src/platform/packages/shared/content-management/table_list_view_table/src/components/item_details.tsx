/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useCallback, useMemo } from 'react';
import { EuiText, EuiLink, EuiSpacer, EuiHighlight, useEuiTheme } from '@elastic/eui';
import { RedirectAppLinks } from '@kbn/shared-ux-link-redirect-app';
import { FavoriteButton } from '@kbn/content-management-favorites-public';
import { UserContentCommonSchema } from '@kbn/content-management-table-list-view-common';
import { css } from '@emotion/react';

import type { Tag } from '../types';
import { useServices } from '../services';
import type { TableListViewTableProps } from '../table_list_view_table';

import { TagBadge } from './tag_badge';

type InheritedProps<T extends UserContentCommonSchema> = Pick<
  TableListViewTableProps<T>,
  'getOnClickTitle' | 'getDetailViewLink' | 'id'
>;
interface Props<T extends UserContentCommonSchema> extends InheritedProps<T> {
  item: T;
  searchTerm?: string;
  onClickTag: (tag: Tag, isCtrlKey: boolean) => void;
  isFavoritesEnabled?: boolean;
}

/**
 * Copied from https://stackoverflow.com/a/9310752
 */
const escapeRegExp = (text: string) => {
  return text.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

export function ItemDetails<T extends UserContentCommonSchema>({
  id,
  item,
  searchTerm = '',
  getDetailViewLink,
  getOnClickTitle,
  onClickTag,
  isFavoritesEnabled,
}: Props<T>) {
  const { euiTheme } = useEuiTheme();
  const {
    references,
    attributes: { title, description },
  } = item;
  const { navigateToUrl, currentAppId$, TagList, itemHasTags } = useServices();

  const redirectAppLinksCoreStart = useMemo(
    () => ({
      application: {
        navigateToUrl,
        currentAppId$,
      },
    }),
    [currentAppId$, navigateToUrl]
  );

  const onClickTitleHandler = useMemo(() => {
    const onClickTitle = getOnClickTitle?.(item);
    if (!onClickTitle || getDetailViewLink?.(item)) {
      return undefined;
    }

    return ((e) => {
      e.preventDefault();
      onClickTitle();
    }) as React.MouseEventHandler<HTMLAnchorElement>;
  }, [getOnClickTitle, item, getDetailViewLink]);

  const renderTitle = useCallback(() => {
    const href = getDetailViewLink ? getDetailViewLink(item) : undefined;

    if (!href && !getOnClickTitle?.(item)) {
      // This item is not clickable
      return <span>{title}</span>;
    }

    return (
      <RedirectAppLinks coreStart={redirectAppLinksCoreStart}>
        {/* eslint-disable-next-line  @elastic/eui/href-or-on-click */}
        <EuiLink
          href={getDetailViewLink?.(item)}
          onClick={onClickTitleHandler}
          data-test-subj={`${id}ListingTitleLink-${item.attributes.title.split(' ').join('-')}`}
        >
          <EuiHighlight highlightAll search={escapeRegExp(searchTerm)}>
            {title}
          </EuiHighlight>
        </EuiLink>
        {isFavoritesEnabled && (
          <FavoriteButton
            id={item.id}
            css={css`
              margin-top: -${euiTheme.size.m}; // trying to nicer align the star with the title
              margin-bottom: -${euiTheme.size.s};
              margin-left: ${euiTheme.size.xxs};
            `}
          />
        )}
      </RedirectAppLinks>
    );
  }, [
    euiTheme,
    getDetailViewLink,
    getOnClickTitle,
    id,
    item,
    onClickTitleHandler,
    redirectAppLinksCoreStart,
    searchTerm,
    title,
    isFavoritesEnabled,
  ]);

  const hasTags = itemHasTags(references);

  return (
    <div>
      <EuiText size="s">{renderTitle()}</EuiText>
      {Boolean(description) && (
        <EuiText size="s" color="subdued">
          <p>
            <EuiHighlight highlightAll search={escapeRegExp(searchTerm)}>
              {description!}
            </EuiHighlight>
          </p>
        </EuiText>
      )}
      {hasTags && (
        <>
          <EuiSpacer size="s" />
          <TagList
            references={references}
            tagRender={(tag) => <TagBadge key={tag.name} tag={tag} onClick={onClickTag} />}
          />
        </>
      )}
    </div>
  );
}
