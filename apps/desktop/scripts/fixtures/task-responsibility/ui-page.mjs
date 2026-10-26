import assert from 'node:assert/strict';

// #6967 UI verification: real read-only components and scope hook, synthetic Host
// responses only. Does not verify full-header layout, transport, authorization or disk writes.
export default {
  name: 'task-responsibility',
  entry: './responsibility-fixture.tsx',
  viewport: { width: 560, height: 800 },
  real: 'BotTaskCollaboration, botFollowScopes, TaskDeliveryReceipt, product translations and theme tokens',
  notCovered: 'Full SessionContentHeader layout, AgentActionRow integration, actual Host persistence/delivery, Mobile and atomic reassignment',
  stubs: {
    'src/renderer/features/bots/botStore': { partial: `
      const profiles = [
        { id: 'editor', name: 'Demo editor', enabled: true, status: 'active' },
        { id: 'verifier', name: 'Demo verifier', enabled: true, status: 'active' },
        { id: 'legacy', name: 'Demo legacy', enabled: true, status: 'active' },
      ];
      export const useBotProfiles = () => profiles;
      export const hasLoadedBotProfiles = () => true;
      export const ensureBotProfilesLoaded = async () => profiles;
    ` },
  },
  cases: {
    default: { about: 'Explicit modification/verifier roles, legacy unconfirmed follower, queued and started delivery, explicit verification claim' },
    conflict: { about: 'Two modification owners require confirmation; failed/mismatched receipts cannot imply acceptance' },
  },
  async ready(page) {
    await page.getByRole('button').first().waitFor();
  },
  async check(page, ui) {
    const expected = ui.case === 'conflict' ? ['failed', 'unknown', 'verify'] : ['queued', 'started', 'verify'];
    assert.deepEqual(await page.locator('[data-task-delivery-receipt]').evaluateAll(nodes => nodes.map(node => node.dataset.taskDeliveryReceipt)), expected);
    await page.getByRole('button', { name: await ui.t('bots.taskCollaboration.title'), exact: true }).click();
    await page.getByText('Demo editor', { exact: ui.case !== 'conflict' }).waitFor();
    await page.getByText(await ui.t(ui.case === 'conflict' ? 'bots.taskCollaboration.conflict' : 'bots.taskCollaboration.note'), { exact: true }).waitFor();
    await page.getByText('Demo legacy', { exact: true }).waitFor();
    await ui.capture('responsibilities');
    await page.keyboard.press('Escape');
  },
};
