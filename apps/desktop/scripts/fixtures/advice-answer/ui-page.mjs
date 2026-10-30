import assert from 'node:assert/strict';

export default {
  name: 'advice-answer',
  entry: './advice-answer-fixture.tsx',
  viewport: { width: 760, height: 700 },
  real: 'AdviceAnswerCards, shared advice parser, disclosure controls, translations and production theme tokens',
  notCovered: 'Message routing, native mobile selection menus and host persistence; uses synthetic message content',
  cases: {
    default: { about: 'Three collapsed suggestions; expand the first explanation and collapse it again' },
    narrow: { about: 'Same suggestions at 320px without horizontal overflow', viewport: { width: 320, height: 860 } },
  },
  async check(page, ui) {
    const card = page.getByTestId('advice-answer');
    assert.equal(await card.locator('li').count(), 3);
    const expandLabel = await ui.t('chat.adviceCard.expandExplanation');
    const collapseLabel = await ui.t('chat.adviceCard.collapseExplanation');
    assert.equal(await card.getByRole('button', { name: expandLabel, exact: true }).count(), 3);
    await card.getByRole('button', { name: expandLabel, exact: true }).first().click();
    const expanded = card.getByRole('button', { name: collapseLabel, exact: true });
    assert.equal(await expanded.getAttribute('aria-expanded'), 'true');
    assert.equal(await card.locator('li').first().locator('p:not([hidden])').count(), 2);
    await ui.capture('expanded');
    await expanded.click();
    assert.equal(await card.locator('button[aria-expanded="true"]').count(), 0);
  },
};
