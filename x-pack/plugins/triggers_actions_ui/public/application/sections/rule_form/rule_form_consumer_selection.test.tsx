/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RuleFormConsumerSelection } from './rule_form_consumer_selection';
import { RuleCreationValidConsumer } from '../../../types';
import { useKibana } from '../../../common/lib/kibana';

const mockConsumers: RuleCreationValidConsumer[] = ['logs', 'infrastructure', 'stackAlerts'];

const mockOnChange = jest.fn();

jest.mock('../../../common/lib/kibana');
const useKibanaMock = useKibana as jest.Mocked<typeof useKibana>;

describe('RuleFormConsumerSelectionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useKibanaMock().services.isServerless = false;
  });

  it('renders correctly', async () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={mockConsumers}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByTestId('ruleFormConsumerSelect')).toBeInTheDocument();
    expect(screen.getByTestId('comboBoxSearchInput')).toHaveAttribute(
      'placeholder',
      'Select a scope'
    );
    expect(screen.getByTestId('comboBoxSearchInput')).toHaveValue('');
    fireEvent.click(screen.getByTestId('comboBoxToggleListButton'));
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByText('Stack Rules')).toBeInTheDocument();
  });

  it('should be able to initialize to the prop initialSelectedConsumer', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={mockConsumers}
        onChange={mockOnChange}
        initialSelectedConsumer={'logs'}
        errors={{}}
      />
    );
    expect(mockOnChange).toHaveBeenLastCalledWith('logs');
  });

  it('should NOT initialize if initialSelectedConsumer is equal to null', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={mockConsumers}
        onChange={mockOnChange}
        initialSelectedConsumer={null}
        errors={{}}
      />
    );
    expect(mockOnChange).not.toBeCalled();
  });

  it('should initialize to the first valid consumers if initialSelectedConsumer is not valid', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={['logs', 'infrastructure']}
        onChange={mockOnChange}
        initialSelectedConsumer={'apm' as RuleCreationValidConsumer}
        errors={{}}
      />
    );
    expect(mockOnChange).toHaveBeenLastCalledWith('logs');
  });

  it('should initialize to stackAlerts if the initialSelectedConsumer is not a valid and consumers has stackAlerts', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={['infrastructure', 'stackAlerts']}
        onChange={mockOnChange}
        initialSelectedConsumer={'logs'}
        errors={{}}
      />
    );
    expect(mockOnChange).toHaveBeenLastCalledWith('stackAlerts');
  });

  it('should initialize to stackAlerts if the initialSelectedConsumer is undefined and consumers has stackAlerts', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={['infrastructure', 'stackAlerts']}
        onChange={mockOnChange}
        initialSelectedConsumer={undefined}
        errors={{}}
      />
    );
    expect(mockOnChange).toHaveBeenLastCalledWith('stackAlerts');
  });

  it('should be able to select infrastructure and call onChange', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={mockConsumers}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    fireEvent.click(screen.getByTestId('comboBoxToggleListButton'));
    fireEvent.click(screen.getByTestId('infrastructure'));
    expect(mockOnChange).toHaveBeenLastCalledWith('infrastructure');
  });

  it('should be able to select logs and call onChange', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={mockConsumers}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    fireEvent.click(screen.getByTestId('comboBoxToggleListButton'));
    fireEvent.click(screen.getByTestId('logs'));
    expect(mockOnChange).toHaveBeenLastCalledWith('logs');
  });

  it('should be able to show errors when there is one', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={mockConsumers}
        onChange={mockOnChange}
        errors={{ consumer: ['Scope is required'] }}
      />
    );
    expect(screen.queryAllByText('Scope is required')).toHaveLength(1);
  });

  it('should display nothing if there is only 1 consumer to select', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={null}
        consumers={['stackAlerts']}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(mockOnChange).toHaveBeenLastCalledWith('stackAlerts');
    expect(screen.queryByTestId('ruleFormConsumerSelect')).not.toBeInTheDocument();
  });

  it('should display the initial selected consumer', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={'logs'}
        consumers={mockConsumers}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByTestId('comboBoxSearchInput')).toHaveValue('Logs');
  });

  it('should not display the initial selected consumer if it is not a selectable option', () => {
    render(
      <RuleFormConsumerSelection
        selectedConsumer={'logs'}
        consumers={['stackAlerts', 'infrastructure']}
        onChange={mockOnChange}
        errors={{}}
      />
    );
    expect(screen.getByTestId('comboBoxSearchInput')).toHaveValue('');
  });

  it('should not show the role visibility dropdown on serverless on an o11y project', () => {
    useKibanaMock().services.isServerless = true;

    render(
      <RuleFormConsumerSelection
        selectedConsumer={'logs'}
        consumers={['stackAlerts', 'infrastructure', 'observability']}
        onChange={mockOnChange}
        errors={{}}
      />
    );
    expect(screen.queryByTestId('ruleFormConsumerSelect')).not.toBeInTheDocument();
  });

  it('should set the consumer correctly on an o11y project', () => {
    useKibanaMock().services.isServerless = true;

    render(
      <RuleFormConsumerSelection
        selectedConsumer={'logs'}
        consumers={['stackAlerts', 'infrastructure', 'observability']}
        onChange={mockOnChange}
        errors={{}}
      />
    );
    expect(mockOnChange).toHaveBeenLastCalledWith('observability');
  });
});
