/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { Spaces } from '../../../scenarios';
import { getUrlPrefix, getTestRuleData, ObjectRemover } from '../../../../common/lib';
import type { FtrProviderContext } from '../../../../common/ftr_provider_context';

export default function monitoringAlertTests({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const retry = getService('retry');

  describe('monitoring', () => {
    const objectRemover = new ObjectRemover(supertest);

    const run = async (id: string) => {
      await retry.try(async () => {
        // Sometimes the rule may already be running, which returns a 200. Try until it isn't
        const response = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rule/${id}/_run_soon`)
          .set('kbn-xsrf', 'foo');
        expect(response.status).to.eql(204);
      });
    };

    after(async () => await objectRemover.removeAll());

    it('should return an accurate history for a single success', async () => {
      const createResponse = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(getTestRuleData({ schedule: { interval: '1h' } }));
      expect(createResponse.status).to.eql(200);
      objectRemover.add(Spaces.space1.id, createResponse.body.id, 'rule', 'alerting');

      // Allow at least one execution
      await waitForExecutionCount(1, createResponse.body.id);

      const getResponse = await supertest.get(
        `${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rule/${createResponse.body.id}`
      );
      expect(getResponse.status).to.eql(200);

      expect(getResponse.body.monitoring.run.history.length).to.be(1);
      expect(getResponse.body.monitoring.run.history[0].success).to.be(true);
      expect(getResponse.body.monitoring.run.calculated_metrics.success_ratio).to.be(1);
    });

    it('should return an accurate history for multiple success', async () => {
      const createResponse = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(getTestRuleData({ schedule: { interval: '1h' } }));
      expect(createResponse.status).to.eql(200);

      const ruleId = createResponse.body.id;
      objectRemover.add(Spaces.space1.id, ruleId, 'rule', 'alerting');

      for (let i = 1; i < 3; i++) {
        await waitForExecutionCount(i, ruleId);
        await run(ruleId);
      }
      // Allow at least three executions
      await waitForExecutionCount(3, ruleId);

      const getResponse = await supertest.get(
        `${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rule/${ruleId}`
      );
      expect(getResponse.status).to.eql(200);

      expect(getResponse.body.monitoring.run.history.length).to.be(3);
      expect(getResponse.body.monitoring.run.history[0].success).to.be(true);
      expect(getResponse.body.monitoring.run.history[1].success).to.be(true);
      expect(getResponse.body.monitoring.run.history[2].success).to.be(true);
      expect(getResponse.body.monitoring.run.calculated_metrics.success_ratio).to.be(1);
    });

    it('should return an accurate history for some successes and some failures', async () => {
      const pattern = [true, true, true, false, false]; // Once we start failing, the rule type doesn't update state so the failures have to be at the end
      const createResponse = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestRuleData({
            rule_type_id: 'test.patternSuccessOrFailure',
            schedule: { interval: '1h' },
            params: {
              pattern,
            },
          })
        );
      expect(createResponse.status).to.eql(200);

      const ruleId = createResponse.body.id;
      objectRemover.add(Spaces.space1.id, ruleId, 'rule', 'alerting');

      for (let i = 1; i < 5; i++) {
        await waitForExecutionCount(i, ruleId);
        await run(ruleId);
      }
      // Allow at least five executions
      await waitForExecutionCount(5, ruleId);

      const getResponse = await supertest.get(
        `${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rule/${ruleId}`
      );
      expect(getResponse.status).to.eql(200);

      expect(getResponse.body.monitoring.run.history.length).to.be(5);
      expect(getResponse.body.monitoring.run.history[0].success).to.be(true);
      expect(getResponse.body.monitoring.run.history[1].success).to.be(true);
      expect(getResponse.body.monitoring.run.history[2].success).to.be(true);
      expect(getResponse.body.monitoring.run.history[3].success).to.be(false);
      expect(getResponse.body.monitoring.run.history[4].success).to.be(false);
      expect(getResponse.body.monitoring.run.calculated_metrics.success_ratio).to.be(0.6);
    });

    it('should populate rule objects with the calculated percentiles', async () => {
      const createResponse = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestRuleData({
            schedule: { interval: '3s' },
          })
        );

      expect(createResponse.status).to.eql(200);
      objectRemover.add(Spaces.space1.id, createResponse.body.id, 'rule', 'alerting');

      // Allow at least three executions
      await waitForExecutionCount(3, createResponse.body.id);

      const getResponse = await supertest.get(
        `${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rule/${createResponse.body.id}`
      );
      expect(getResponse.status).to.eql(200);

      getResponse.body.monitoring.run.history.forEach((history: any) => {
        expect(history.duration).to.be.a('number');
      });
    });
  });

  const MAX_ATTEMPTS = 25;
  let attempts = 0;
  async function waitForExecutionCount(count: number, id: string): Promise<boolean> {
    if (attempts++ >= MAX_ATTEMPTS) {
      expect().fail(`waiting for execution of alert ${id} to hit ${count}`);
      return true;
    }
    const getResponse = await supertest.get(
      `${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rule/${id}`
    );
    expect(getResponse.status).to.eql(200);
    if (getResponse.body.monitoring.run.history.length >= count) {
      attempts = 0;
      return true;
    }
    // eslint-disable-next-line no-console
    console.log(
      `found ${getResponse.body.monitoring.run.history.length} and looking for ${count}, waiting 3s then retrying`
    );
    await delay(3000);
    return waitForExecutionCount(count, id);
  }

  async function delay(millis: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, millis));
  }
}
