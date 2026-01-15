/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */
// Processor Integration

import type { DocumentNodeProcessor } from './process_document/document_processors/types/document_node_processor';
import { createSkipNodeWithInternalPropProcessor } from './process_document/document_processors/skip_node_with_internal_prop';
import { createIncludeLabelsProcessor } from './process_document/document_processors/include_labels';
import { createNamespaceComponentsProcessor } from './process_document/document_processors/namespace_components';
import { createFlattenFoldedAllOfItemsProcessor } from './process_document/document_processors/reduce_all_of_items/flatten_folded_all_of_items';
import { createMergeNonConflictingAllOfItemsProcessor } from './process_document/document_processors/reduce_all_of_items/merge_non_conflicting_all_of_items';
import { createUnfoldSingleAllOfItemProcessor } from './process_document/document_processors/reduce_all_of_items/unfold_single_all_of_item';
import { createExtractInlineSchemasProcessor } from './process_document/document_processors/extract_inline_schemas_to_components';
import type { ExtractInlineSchemasOptions } from './process_document/document_processors/extract_inline_schemas_to_components';
import { BundleRefProcessor } from './process_document/document_processors/bundle_refs';

/**
 * Default bundling processors in correct execution order
 *
 * CRITICAL: Order matters!
 * 1. Filter unwanted nodes
 * 2. Resolve existing references
 * 3. Reduce compositions (allOf simplification)
 * 4. Extract complex inline schemas (after allOf is simplified)
 */
export const DEFAULT_BUNDLING_PROCESSORS: Readonly<DocumentNodeProcessor[]> = [
  // Phase 1: Filter
  createSkipNodeWithInternalPropProcessor('x-internal'),

  // Phase 2: Resolve existing references
  new BundleRefProcessor(),

  // Phase 3: Simplify compositions
  createFlattenFoldedAllOfItemsProcessor(),
  createMergeNonConflictingAllOfItemsProcessor(),
  createUnfoldSingleAllOfItemProcessor(),

  // Phase 4: Extract inline schemas (AFTER allOf reduction reduces complexity)
  createExtractInlineSchemasProcessor({
    minComplexity: 3, // Higher threshold after simplification
    maxDepth: 10,
    extractSingleItems: false,
    namingPrefix: 'Generated',
  }),
];

export function withExtractInlineSchemasProcessor(
  processors: Readonly<DocumentNodeProcessor[]>,
  options?: ExtractInlineSchemasOptions
): Readonly<DocumentNodeProcessor[]> {
  return [...processors, createExtractInlineSchemasProcessor(options)];
}

export function withIncludeLabelsProcessor(
  processors: Readonly<DocumentNodeProcessor[]>,
  includeLabels: string[]
): Readonly<DocumentNodeProcessor[]> {
  return [...processors, createIncludeLabelsProcessor(includeLabels)];
}

export function withNamespaceComponentsProcessor(
  processors: Readonly<DocumentNodeProcessor[]>,
  namespacePointer: string
): Readonly<DocumentNodeProcessor[]> {
  return [...processors, createNamespaceComponentsProcessor(namespacePointer)];
}
