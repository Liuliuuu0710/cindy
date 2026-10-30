import { mountPage } from '../../ui-page/harness';
import { AdviceAnswerCards } from '../../../src/renderer/components/chat/AdviceAnswerCards';
import { parseAdviceAnswer } from '@cindy/maker-shared/message-presentation';
import { adviceAnswerMarkdown } from '../../../../../packages/maker-shared/src/__tests__/fixtures/adviceAnswer';

const answer = parseAdviceAnswer(adviceAnswerMarkdown)!;
mountPage({ render: () => (
  <main className="min-h-screen bg-content-area p-4 text-foreground">
    <div className="mx-auto max-w-[680px]"><AdviceAnswerCards answer={answer} /></div>
  </main>
) });
