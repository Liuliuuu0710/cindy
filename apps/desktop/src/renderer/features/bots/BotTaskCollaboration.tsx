import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WINDOW_NO_DRAG_STYLE } from '@/components/layout/windowDrag';
import type { Session } from '@/lib/ccAgent.types';
import { useSessionResponsibilities } from './botFollowScopes';

/** Read-only responsibility snapshot; never presents the task creator as its modification owner. */
export function BotTaskCollaboration({ session }: { session: Session }) {
  const { t } = useTranslation();
  const responsibilities = useSessionResponsibilities(session);
  if (!responsibilities.length) return null;
  const groups = [
    { key: 'modify', names: responsibilities.filter((entry) => entry.role === 'modify').map((entry) => entry.bot.name) },
    { key: 'verify', names: responsibilities.filter((entry) => entry.role === 'verify').map((entry) => entry.bot.name) },
    { key: 'unclassified', names: responsibilities.filter((entry) => !entry.role).map((entry) => entry.bot.name) },
  ];
  const conflict = groups[0]!.names.length > 1;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" style={WINDOW_NO_DRAG_STYLE}
          aria-label={t('bots.taskCollaboration.title')}
          className="ml-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-12 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
          <Users size={14} aria-hidden="true" />
          <span>{t('bots.taskCollaboration.title')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-w-[calc(100vw-24px)] space-y-3 text-13" style={WINDOW_NO_DRAG_STYLE}>
        <dl className="space-y-3">
          {groups.filter((group) => group.key !== 'unclassified' || group.names.length).map((group) => (
            <div key={group.key} className="space-y-1">
              <dt className="text-12 text-[var(--text-secondary)]">{t(`bots.taskCollaboration.${group.key}`)}</dt>
              <dd className="break-words text-[var(--text-primary)]">{group.names.join(' · ') || t('bots.taskCollaboration.unconfirmed')}</dd>
            </div>
          ))}
        </dl>
        <p className="text-12 leading-relaxed text-[var(--text-secondary)]">
          {t(conflict ? 'bots.taskCollaboration.conflict' : 'bots.taskCollaboration.note')}
        </p>
      </PopoverContent>
    </Popover>
  );
}
