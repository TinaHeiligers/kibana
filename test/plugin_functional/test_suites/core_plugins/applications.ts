/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import url from 'url';
import expect from '@kbn/expect';
import { PluginFunctionalProviderContext } from '../../services';

export default function ({ getService, getPageObjects }: PluginFunctionalProviderContext) {
  const PageObjects = getPageObjects(['common', 'header']);
  const browser = getService('browser');
  const appsMenu = getService('appsMenu');
  const testSubjects = getService('testSubjects');
  const find = getService('find');
  const retry = getService('retry');
  const deployment = getService('deployment');
  const esArchiver = getService('esArchiver');

  function waitUntilLoadingIsDone() {
    return PageObjects.header.waitUntilLoadingHasFinished();
  }

  const loadingScreenNotShown = async () =>
    expect(await testSubjects.exists('kbnLoadingMessage')).to.be(false);

  const getAppWrapperHeight = async () => {
    const wrapper = await find.byClassName('kbnAppWrapper');
    return (await wrapper.getSize()).height;
  };

  const getKibanaUrl = (pathname?: string, search?: string) =>
    url.format({
      protocol: 'http:',
      hostname: process.env.TEST_KIBANA_HOST || 'localhost',
      port: process.env.TEST_KIBANA_PORT || '5620',
      pathname,
      search,
    });
  // const getKibanaUrl = (pathname?: string, search?: string) => {
  //   return url.format({
  //     protocol: 'http:',
  //     hostname: process.env.TEST_KIBANA_HOST || 'localhost',
  //     port: process.env.TEST_KIBANA_PORT || '5620',
  //     pathname,
  //     search,
  //   });
  // };

  // const waitForUrlToBeWithTimeout = async (pathname?: string, search?: string, time?: number) => {
  //   const expectedUrl = getKibanaUrl(pathname, search);
  //   return await retry.waitForWithTimeout('navigates to app root', time ?? 3000, async () => {
  //     return (await browser.getCurrentUrl()) === expectedUrl;
  //   });
  // };

  // Try using Dashboard implementations
  // intension: Use navigateToAppFromAppsMenu rather than appsMenu.clickLink directly,
  async function navigateToAppFromAppsMenu(title: string) {
    await retry.try(async () => {
      await appsMenu.clickLink(title);
      //
      // try using if plain clickLink doesn't work:
      //
      // await appsMenu.clickLink(title, {
      //   category: 'recentlyViewed',
      //   closeCollapsibleNav: true,
      // });
      await waitUntilLoadingIsDone();
      const currentUrl = await browser.getCurrentUrl();
      if (!currentUrl.includes('app/foo/home')) {
        throw new Error(`Not in dashboard application after clicking 'Dashboard' in apps menu`);
      }
    });
  }

  /** Use retry logic to make URL assertions less flaky */
  const waitForUrlToBe = (pathname?: string, search?: string) => {
    const expectedUrl = getKibanaUrl(pathname, search);
    return retry.waitFor(`Url to be ${expectedUrl}`, async () => {
      return (await browser.getCurrentUrl()) === expectedUrl;
    });
  };

  const navigateTo = async (path: string) =>
    await browser.navigateTo(`${deployment.getHostPort()}${path}`);

  describe('ui applications', function describeIndexTests() {
    console.log('STARTING CORE APPLICATIONS FTR TESTS!!!!!!!!!');
    debugger;
    before(async () => {
      await esArchiver.emptyKibanaIndex();
      await PageObjects.common.navigateToApp('foo');
      await PageObjects.common.dismissBanner();
    });

    it('starts on home page', async () => {
      console.log('DOES IT START ON THE HOME PAGE?????');
      await testSubjects.existOrFail('fooAppHome');
    });

    it('redirects and renders correctly regardless of trailing slash', async () => {
      console.log('STARTING: redirects and renders correctly regardless of trailing slash');
      await navigateTo(`/app/foo`);
      await waitForUrlToBe('/app/foo/home');
      await testSubjects.existOrFail('fooAppHome');
      await navigateTo(`/app/foo/`);
      await waitForUrlToBe('/app/foo/home');
      await testSubjects.existOrFail('fooAppHome');
    });

    it('navigates to its own pages', async () => {
      debugger;
      // Go to page A
      await testSubjects.click('fooNavPageA');
      await waitForUrlToBe('/app/foo/page-a');
      await loadingScreenNotShown();
      await testSubjects.existOrFail('fooAppPageA');

      // Go to home page
      debugger;
      console.log('DO WE NAVIGATE BACK TO HOME?');
      await testSubjects.click('fooNavHome');
      await waitForUrlToBe('/app/foo/home');
      await loadingScreenNotShown();
      await testSubjects.existOrFail('fooAppHome');
    });

    it('can use the back button to navigate within an app', async () => {
      debugger;
      await browser.goBack();
      await waitForUrlToBe('/app/foo/page-a');
      await loadingScreenNotShown();
      await testSubjects.existOrFail('fooAppPageA');
    });

    // this is the one that's causing the failures
    it('navigates to app root when navlink is clicked', async () => {
      debugger;
      console.log("DO WE NAVIGATE BACK TO HOME IN THE TEST THAT'S CAUSING ISSUES?");
      await testSubjects.click('fooNavHome');
      debugger;
      console.log('now trying to navigate to the app root, named Foo');

      // await appsMenu.clickLink('Foo');
      navigateToAppFromAppsMenu('Foo');
      console.log('THE TEST CLICKED THE LINK, DOES THE URL AND UI CHANGE AT ALL?');

      // await waitForUrlToBeWithTimeout('/app/foo/home'); // fix https://github.com/elastic/kibana/issues/166677 timeout failure
      await waitForUrlToBe('/app/foo/home');
      await loadingScreenNotShown();
      console.log('DID WE NAVIGATE BACK TO HOME?');
      await testSubjects.existOrFail('fooAppHome');
    });

    it('navigates to other apps', async () => {
      await testSubjects.click('fooNavBarPageB');
      await loadingScreenNotShown();
      await testSubjects.existOrFail('barAppPageB');
      await waitForUrlToBe('/app/bar/page-b', 'query=here');
    });

    it('preserves query parameters across apps', async () => {
      const querySpan = await testSubjects.find('barAppPageBQuery');
      expect(await querySpan.getVisibleText()).to.eql(`[["query","here"]]`);
    });

    it('can use the back button to navigate back to previous app', async () => {
      await browser.goBack();
      await waitForUrlToBe('/app/foo/home');
      await loadingScreenNotShown();
      await testSubjects.existOrFail('fooAppHome');
    });

    it('chromeless applications are not visible in apps list', async () => {
      expect(await appsMenu.linkExists('Chromeless')).to.be(false);
    });

    it('navigating to chromeless application hides chrome', async () => {
      await PageObjects.common.navigateToApp('chromeless');
      await loadingScreenNotShown();
      expect(await testSubjects.exists('headerGlobalNav')).to.be(false);

      const wrapperHeight = await getAppWrapperHeight();
      const windowHeight = (await browser.getWindowInnerSize()).height;
      expect(wrapperHeight).to.eql(windowHeight);
    });

    it('navigating away from chromeless application shows chrome', async () => {
      await PageObjects.common.navigateToApp('foo');
      await loadingScreenNotShown();
      expect(await testSubjects.exists('headerGlobalNav')).to.be(true);

      const wrapperHeight = await getAppWrapperHeight();
      const windowHeight = (await browser.getWindowInnerSize()).height;
      expect(wrapperHeight).to.be.below(windowHeight);
    });
  });
}
