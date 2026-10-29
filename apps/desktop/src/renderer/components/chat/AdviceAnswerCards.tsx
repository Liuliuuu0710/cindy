import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdviceAnswer } from '@cindy/maker-shared/message-presentation';
import { Tip } from '@/components/ui/tooltip';

function AdviceRow({ item, index }: { item: AdviceAnswer['items'][number]; index: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const explanationId = useId();
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)_44px] items-center gap-x-2 px-3 py-2">
      <span aria-hidden="true" className="text-13 font-normal tabular-nums text-[var(--text-tertiary)]">
        {String(index + 1).padStart(2, '0')}
      </span>
      <h3 className="m-0 whitespace-pre-wrap text-16 font-medium leading-6">{item.title}</h3>
      <Tip text={expanded ? t('chat.adviceCard.collapseExplanation') : t('chat.adviceCard.expandExplanation')}>
        <button
          type="button"
          aria-label={expanded ? t('chat.adviceCard.collapseExplanation') : t('chat.adviceCard.expandExplanation')}
          aria-expanded={expanded}
          aria-controls={explanationId}
          onClick={() => setExpanded((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <ChevronDown aria-hidden="true" size={16} className={expanded ? 'rotate-180' : undefined} />
        </button>
      </Tip>
      <p className="col-start-2 col-end-4 m-0 whitespace-pre-wrap text-14 leading-6">
        <span className="mr-2 inline-block rounded-full bg-[var(--surface-chip)] px-2 py-0.5 text-12 font-medium leading-none text-[var(--text-secondary)]">{item.actionLabel}</span>{item.action}
      </p>
      <p id={explanationId} hidden={!expanded} className="col-start-2 col-end-4 m-0 mt-2 border-l border-[var(--border-default)] pl-2 whitespace-pre-wrap text-13 text-[var(--text-secondary)] leading-6">
        {item.explanation}
      </p>
    </li>
  );
}

/** Native disclosure only; model text is escaped by React, never inserted as HTML. */
export function AdviceAnswerCards({ answer }: { answer: AdviceAnswer }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 [overflow-wrap:anywhere]" data-testid="advice-answer">
      <h2 className="m-0 whitespace-pre-wrap text-18 font-medium leading-7">{answer.title}</h2>
      <p className="m-0 whitespace-pre-wrap">{answer.introduction}</p>
      <ol className="m-0 list-none divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-0">
        {answer.items.map((item, index) => (
          <AdviceRow key={index} item={item} index={index} />
        ))}
      </ol>
      <p className="m-0 whitespace-pre-wrap text-13 font-normal leading-6">{answer.note}</p>
    </section>
  );
}
