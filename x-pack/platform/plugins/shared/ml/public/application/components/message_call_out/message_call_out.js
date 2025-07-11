/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * Provides a wrapper around EuiCallOut for the display of error messages,
 * setting the icon and color according to a supplied MESSAGE_LEVEL.
 */

import React from 'react';
import PropTypes from 'prop-types';

import { EuiCallOut } from '@elastic/eui';

import { MESSAGE_LEVEL } from '../../../../common/constants/message_levels';

function getCallOutAttributes(message, status) {
  switch (status) {
    case MESSAGE_LEVEL.ERROR:
      return { title: message, iconType: 'cross', color: 'danger' };
    case MESSAGE_LEVEL.WARNING:
      return { title: message, iconType: 'warning', color: 'warning' };
    case MESSAGE_LEVEL.SUCCESS:
      return { title: message, iconType: 'check', color: 'success' };
    case MESSAGE_LEVEL.INFO:
      return { title: message, iconType: 'info', color: 'primary' };
  }
}

export function MessageCallOut({ message, status, ...rest }) {
  return <EuiCallOut size="s" {...getCallOutAttributes(message, status)} {...rest} />;
}

MessageCallOut.propTypes = {
  message: PropTypes.string,
  status: PropTypes.oneOf([
    MESSAGE_LEVEL.ERROR,
    MESSAGE_LEVEL.WARNING,
    MESSAGE_LEVEL.SUCCESS,
    MESSAGE_LEVEL.INFO,
  ]),
};
