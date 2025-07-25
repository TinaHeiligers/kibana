/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { ReactNode } from 'react';

import { PresentationPanelError } from '@kbn/presentation-panel-plugin/public';

import { Embeddable } from './embeddable';
import { EmbeddableInput, EmbeddableOutput } from './i_embeddable';

export const ERROR_EMBEDDABLE_TYPE = 'error';

export class ErrorEmbeddable extends Embeddable<EmbeddableInput, EmbeddableOutput, ReactNode> {
  public readonly type = ERROR_EMBEDDABLE_TYPE;
  public error: Error | string;

  constructor(error: Error | string, input: EmbeddableInput) {
    super(input, {});
    this.error = error;
  }

  public reload() {}

  public render() {
    const error = typeof this.error === 'string' ? { message: this.error, name: '' } : this.error;

    return (
      <PresentationPanelError
        api={{
          uuid: this.id,
          ...this,
        }}
        error={error}
      />
    );
  }
}
