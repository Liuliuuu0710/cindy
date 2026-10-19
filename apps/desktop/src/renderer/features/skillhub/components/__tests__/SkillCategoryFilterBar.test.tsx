// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SkillCategoryFilterBar } from '../SkillCategoryFilterBar';

const categories = [
  { slug: 'automation', name: 'Automation', count: 10, myCount: 1 },
  { slug: 'productivity', name: 'Productivity', count: 8, myCount: 0 },
];

function renderBar(onSelectCategory = vi.fn()) {
  return {
    onSelectCategory,
    ...render(
      <SkillCategoryFilterBar
        categories={categories}
        selectedCategory="automation"
        allLabel="All"
        ariaLabel="Filter skills by category"
        onSelectCategory={onSelectCategory}
      />,
    ),
  };
}

function mockScroller(
  scroller: HTMLElement,
  values: { scrollLeft: number; clientWidth: number; scrollWidth: number },
) {
  let scrollLeft = values.scrollLeft;
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: values.clientWidth });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: values.scrollWidth });
  Object.defineProperty(scroller, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(scroller, 'scrollTo', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
});

describe('SkillCategoryFilterBar', () => {
  it('renders a single-select category group', () => {
    const { onSelectCategory } = renderBar();

    expect(screen.getByRole('radiogroup', { name: 'Filter skills by category' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Automation' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('radio', { name: 'Productivity' }));
    expect(onSelectCategory).toHaveBeenCalledWith('productivity');
  });

  it('centers the selected category immediately after selection changes', () => {
    const { rerender } = renderBar();
    const scroller = screen.getByTestId('skill-category-filter-scroller');
    mockScroller(scroller, { scrollLeft: 0, clientWidth: 200, scrollWidth: 600 });
    const nextSelected = screen.getByRole('radio', { name: 'Productivity' });
    Object.defineProperty(nextSelected, 'offsetLeft', { configurable: true, value: 260 });
    Object.defineProperty(nextSelected, 'offsetWidth', { configurable: true, value: 96 });
    vi.mocked(scroller.scrollTo).mockClear();
    rerender(
      <SkillCategoryFilterBar
        categories={categories}
        selectedCategory="productivity"
        allLabel="All"
        ariaLabel="Filter skills by category"
        onSelectCategory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Productivity' }));
    expect(scroller.scrollTo).toHaveBeenCalledWith({ left: 208, behavior: 'auto' });
  });

  it('ignores clicking the already selected category', () => {
    const { onSelectCategory } = renderBar();
    const scroller = screen.getByTestId('skill-category-filter-scroller');
    vi.mocked(scroller.scrollTo).mockClear();
    fireEvent.click(screen.getByRole('radio', { name: 'Automation' }));
    expect(onSelectCategory).not.toHaveBeenCalled();
    expect(scroller.scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls internally with Shift + wheel without changing category', () => {
    const { onSelectCategory } = renderBar();
    const scroller = screen.getByTestId('skill-category-filter-scroller');
    mockScroller(scroller, { scrollLeft: 20, clientWidth: 200, scrollWidth: 600 });
    fireEvent.wheel(scroller, { shiftKey: true, deltaY: 40 });
    expect(scroller.scrollLeft).toBe(60);
    expect(onSelectCategory).not.toHaveBeenCalled();
  });

  it('keeps the overflowing category row free of arrow controls', () => {
    renderBar();
    const scroller = screen.getByTestId('skill-category-filter-scroller');
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 600 });
    fireEvent.scroll(scroller);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('reveals the focused category without centering the page', () => {
    renderBar();
    const category = screen.getByRole('radio', { name: 'Productivity' });
    category.scrollIntoView = vi.fn();

    fireEvent.focus(category);
    expect(category.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
  });

  it('preserves arrow-key selection and follows focus at both ends', () => {
    const { onSelectCategory } = renderBar();
    const all = screen.getByRole('radio', { name: 'All' });
    const automation = screen.getByRole('radio', { name: 'Automation' });
    const productivity = screen.getByRole('radio', { name: 'Productivity' });
    for (const category of [all, automation, productivity]) {
      category.scrollIntoView = vi.fn();
    }

    fireEvent.keyDown(automation, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(productivity);
    expect(onSelectCategory).toHaveBeenLastCalledWith('productivity');
    expect(productivity.scrollIntoView).toHaveBeenCalled();

    fireEvent.keyDown(productivity, { key: 'Home' });
    expect(document.activeElement).toBe(all);
    expect(all.scrollIntoView).toHaveBeenCalled();

    fireEvent.keyDown(all, { key: 'End' });
    expect(document.activeElement).toBe(productivity);
    expect(onSelectCategory).toHaveBeenLastCalledWith('productivity');
  });
});
