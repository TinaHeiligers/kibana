/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type React from 'react';
import { useUpsellingComponent } from '../../../../../../common/hooks/use_upselling';

export const useGetCustomNotificationUnavailableComponent = (): React.ComponentType | null => {
  return useUpsellingComponent('endpoint_custom_notification');
};
