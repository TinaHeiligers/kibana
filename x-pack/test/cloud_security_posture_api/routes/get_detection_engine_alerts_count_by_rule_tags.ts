/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { ELASTIC_HTTP_VERSION_HEADER } from '@kbn/core-http-common';
import expect from '@kbn/expect';
import { FtrProviderContext } from '../ftr_provider_context';
import { CspSecurityCommonProvider } from './helper/user_roles_utilites';
import { waitForPluginInitialized } from '../utils';

// eslint-disable-next-line import/no-default-export
export default function (providerContext: FtrProviderContext) {
  const { getService } = providerContext;

  const retry = getService('retry');
  const supertest = getService('supertest');
  const logger = getService('log');
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const cspSecurity = CspSecurityCommonProvider(providerContext);

  describe('/internal/cloud_security_posture/detection_engine_rules/alerts/_status', () => {
    describe('GET detection_engine_rules API with user that has specific access', async () => {
      before(async () => {
        await waitForPluginInitialized({ retry, logger, supertest });
      });

      it('GET detection_engine_rules API with user with read access', async () => {
        const { status } = await supertestWithoutAuth
          .get(
            '/internal/cloud_security_posture/detection_engine_rules/alerts/_status?tags=["CIS"]'
          )
          .set(ELASTIC_HTTP_VERSION_HEADER, '1')
          .set('kbn-xsrf', 'xxxx')
          .auth(
            'role_security_read_user_alerts',
            cspSecurity.getPasswordForUser('role_security_read_user_alerts')
          );
        expect(status).to.be(200);
      });

      it('GET detection_engine_rules API with user without read access', async () => {
        const { status } = await supertestWithoutAuth
          .get(
            '/internal/cloud_security_posture/detection_engine_rules/alerts/_status?tags=["CIS"]'
          )
          .set(ELASTIC_HTTP_VERSION_HEADER, '1')
          .set('kbn-xsrf', 'xxxx')
          .auth(
            'role_security_no_read_user_alerts',
            cspSecurity.getPasswordForUser('role_security_no_read_user_alerts')
          );
        expect(status).to.be(403);
      });
    });
  });
}
