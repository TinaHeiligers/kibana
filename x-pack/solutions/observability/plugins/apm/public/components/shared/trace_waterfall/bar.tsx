/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { css } from '@emotion/react';
import React from 'react';

export function Bar({ width, left, color }: { width: number; left: number; color: string }) {
  return (
    <div
      css={css`
        height: 12px;
        background-color: ${color};
        width: ${width}%;
        margin-left: ${left}%;
      `}
    />
  );
}
