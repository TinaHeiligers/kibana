/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { KibanaRole, PROJECT_DEFAULT_ROLES } from '../../../../../common';
import { coreWorkerFixtures } from '../../worker';

export type LoginFunction = (role: string) => Promise<void>;

export interface BrowserAuthFixture {
  /**
   * Logs in as a user with viewer-only permissions.
   * @returns A Promise that resolves once the cookie in browser is set.
   */
  loginAsViewer: () => Promise<void>;
  /**
   * Logs in as a user with administrative privileges
   * @returns A Promise that resolves once the cookie in browser is set.
   */
  loginAsAdmin: () => Promise<void>;
  /**
   * Logs in as a user with elevated, but not admin, permissions.
   * @returns A Promise that resolves once the cookie in browser is set.
   */
  loginAsPrivilegedUser: () => Promise<void>;
  /**
   * Logs in as a user with a role.
   * @param role - A role object that defines the Kibana and ES previleges.
   * @returns A Promise that resolves once the cookie in browser is set.
   */
  loginAs: (role: string) => Promise<void>;
  /**
   * Logs in as a user with a custom role.
   * @param role - A role object that defines the Kibana and ES previleges. Role will re-created if it doesn't exist.
   * @returns A Promise that resolves once the cookie in browser is set.
   */
  loginWithCustomRole: (role: KibanaRole) => Promise<void>;
}

/**
 * The "browserAuth" fixture simplifies the process of logging into Kibana with
 * different roles during tests. It uses the "samlAuth" fixture to create an authentication session
 * for the specified role and the "context" fixture to update the cookie with the role-scoped session.
 */
export const browserAuthFixture = coreWorkerFixtures.extend<{ browserAuth: BrowserAuthFixture }>({
  browserAuth: async ({ log, context, samlAuth, config, kbnUrl, esClient }, use) => {
    const setSessionCookie = async (cookieValue: string) => {
      await context.clearCookies();
      await context.addCookies([
        {
          name: 'sid',
          value: cookieValue,
          path: '/',
          domain: kbnUrl.domain(),
        },
      ]);
    };

    let isCustomRoleCreated = false;

    const loginAs: LoginFunction = async (role: string) => {
      const cookie = await samlAuth.session.getInteractiveUserSessionCookieWithRoleScope(role);
      await setSessionCookie(cookie);
    };

    const loginWithCustomRole = async (role: KibanaRole) => {
      await samlAuth.setCustomRole(role);
      isCustomRoleCreated = true;
      return loginAs(samlAuth.customRoleName);
    };

    const loginAsAdmin = () => loginAs('admin');
    const loginAsViewer = () => loginAs('viewer');
    const loginAsPrivilegedUser = () => {
      const roleName = config.serverless
        ? PROJECT_DEFAULT_ROLES.get(config.projectType!)!
        : 'editor';
      return loginAs(roleName);
    };

    log.serviceLoaded('browserAuth');
    await use({
      loginAsAdmin,
      loginAsViewer,
      loginAsPrivilegedUser,
      loginAs,
      loginWithCustomRole,
    });

    if (isCustomRoleCreated) {
      log.debug(`Deleting custom role with name ${samlAuth.customRoleName}`);
      await esClient.security.deleteRole({ name: samlAuth.customRoleName });
    }
  },
});
