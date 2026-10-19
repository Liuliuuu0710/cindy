import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export default {
  name: 'skillhub-home',
  entry: './skillhub-home-fixture.tsx',
  viewport: { width: 1280, height: 800 },
  real: 'SkillhubHomeContent, PluginManagementLayout, category and sort controls, cards, navigation, translations and themes',
  notCovered:
    'Live catalog data, install/update/import, remote devices and full application sidebar behavior; catalog/auth hooks use synthetic inputs',
  stubs: {
    'src/renderer/contexts/AuthContext':
      'export const useAuth = () => ({ user: null, dataOwnerId: "fixture" }); export const useOptionalAuthDeviceId = () => null; export const useOptionalAuthUser = () => null; export const AuthProvider = ({children}) => children;',
    'src/renderer/features/skillhub/RemoteSkillsPage':
      'export const RemoteSkillsPage = () => null;',
    'src/renderer/features/skillhub/components/InstallTargetPicker':
      'export const InstallTargetPicker = () => null;',
    'src/renderer/features/skillhub/hooks/useSkillhub': {
      partial:
        'const state = { skills: [], projects: [], bootstrapped: true, syncResults: new Map() }; export const useSkillhub = () => state;',
    },
    'src/renderer/features/skillhub/hooks/useMarketSkillUpdate': {
      partial:
        'export const useMarketSkillUpdate = () => ({ updatingNames: new Set(), update: () => {} });',
    },
    'src/renderer/features/skillhub/hooks/useMarketList': {
      partial: readFileSync(new URL('./market-stub.ts', import.meta.url), 'utf8'),
    },
  },
  cases: {
    default: { about: 'B compact header and category rail with real production layout' },
    narrow: {
      about: 'Narrow content keeps the short top switcher and category controls visible',
      viewport: { width: 800, height: 800 },
    },
  },
  async ready(page) {
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.getByTestId('skill-category-filter-scroller').waitFor();
  },
  async check(page, ui) {
    // Group review: check production geometry, not source strings. The narrow
    // pane must leave room beside its primary switch and inside the category rail.
    if (ui.case === 'narrow') {
      const frame = await page.locator('.plugin-management-header-frame').boundingBox();
      const tabs = await page.locator('.plugin-motion-tabs').boundingBox();
      assert.ok(tabs.width < frame.width - 40, 'primary switch stays content-sized');
    }
    const scroller = page.getByTestId('skill-category-filter-scroller');
    const padding = await scroller.evaluate((el) =>
      parseFloat(getComputedStyle(el.parentElement).paddingLeft),
    );
    assert.ok(padding >= 12, 'capsule has safe side padding');
    await page
      .getByRole('button', { name: await ui.t('skillhub.home.sortDownloads'), exact: true })
      .click();
    await page
      .getByRole('menuitemradio', { name: await ui.t('skillhub.home.sortUpdated'), exact: true })
      .click();
    await ui.capture('sort-updated');
  },
};
