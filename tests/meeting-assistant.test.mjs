import test from 'node:test';
import assert from 'node:assert/strict';
import { translationSegments, looksLikeMeetingQuestion, chineseAssistantError, createTranslationQueue, onlineSpeakerId, hasSpeechText } from '../src/lib/meetingAssistant.ts';

test('online identities are stable across backend aliases and window initialization order', () => {
  for (const speaker of ['User', 'You', 'you', 'Me']) assert.equal(onlineSpeakerId(speaker), 'you');
  for (const speaker of ['Them', 'Interviewer']) assert.equal(onlineSpeakerId(speaker), 'them');
  assert.equal(onlineSpeakerId('Unknown', 'you_123_speech_turn_1'), 'you');
  assert.equal(onlineSpeakerId('Unknown', 'them_123_speech_turn_1'), 'them');
});
test('punctuation-only hallucinations are rejected but real thanks and short answers survive', () => {
  for (const text of ['', '  ', '..', '。', '???', '…']) {
    assert.equal(hasSpeechText(text), false);
    assert.equal(looksLikeMeetingQuestion(text), false);
  }
  for (const text of ['Thank you.', 'No.', '好的', '42']) assert.equal(hasSpeechText(text), true);
});

test('partial sentences are not translated on every token', () => {
  assert.deepEqual(translationSegments('We encrypt customer', false), []);
  assert.deepEqual(translationSegments('We encrypt customer data.', false), []);
  assert.deepEqual(translationSegments('We encrypt customer data. Deployment', false), ['We encrypt customer data.']);
});
test('stream completion flushes remaining text without losing earlier sentences', () => {
  assert.deepEqual(translationSegments('We encrypt data. Let me confirm', true), ['We encrypt data.', 'Let me confirm']);
  assert.deepEqual(translationSegments('', true), []);
});
test('abbreviations, decimals, paragraphs and numbered lists', () => {
  assert.deepEqual(translationSegments('Dr. Smith confirmed version 2.5. Next', false), ['Dr. Smith confirmed version 2.5.']);
  assert.deepEqual(translationSegments('1. First item\n2. Second item', true), ['1. First item', '2. Second item']);
  assert.deepEqual(translationSegments('First paragraph\nSecond paragraph', true), ['First paragraph', 'Second paragraph']);
});
test('detects spoken questions and excludes plain assertions', () => {
  for (const text of ['Can you explain the rollout?', 'How quickly can we deploy', 'Please walk us through the setup', 'We need this by Friday?']) assert.equal(looksLikeMeetingQuestion(text), true);
  for (const text of ['Good morning.', 'We encrypt all customer data.', 'The timeline is two weeks.']) assert.equal(looksLikeMeetingQuestion(text), false);
});
test('recognizes English interview requests without a question mark', () => {
  const requests = [
    'Give me an example of a time you led a team.',
    'Please give us one example from your last role',
    'I’d like you to briefly describe a difficult project.',
    "We'd like you to describe your contributions",
    'Next, I would like you to explain how you validated the result.',
    'Thanks for the introduction. Share an example of handling conflict.',
    'Okay, take me through your decision.',
    'Talk about a time when you missed a deadline.',
  ];
  for (const request of requests) assert.equal(looksLikeMeetingQuestion(request), true, request);

  const statements = [
    "I'd like to describe our team before we begin.",
    'I would like you to pause while I pull up your résumé.',
    'She asked me to give an example in the last round.',
    'Thanks for your time. The next step is a call with our team.',
  ];
  for (const statement of statements) assert.equal(looksLikeMeetingQuestion(statement), false, statement);
});
test('configuration errors have actionable Chinese messages', () => {
  assert.match(chineseAssistantError('No active LLM provider: none'), /配置 AI 服务/);
  assert.match(chineseAssistantError('No active model selected'), /选择或下载模型/);
  assert.match(chineseAssistantError('HTTP 429'), /额度/);
});
test('concurrent duplicate translations share one request; provider/source affect cache', async () => {
  let calls = 0;
  const translate = createTranslationQueue(async (text) => { calls++; return '中:' + text; });
  const results = await Promise.all([translate('Hello', 'zh', 'en', 'a'), translate('Hello', 'zh', 'en', 'a')]);
  assert.deepEqual(results, ['中:Hello', '中:Hello']);
  assert.equal(calls, 1);
  await translate('Hello', 'zh', 'en', 'a');
  assert.equal(calls, 1);
  await translate('Hello', 'zh', 'en', 'b');
  await translate('Hello', 'zh', 'fr', 'b');
  assert.equal(calls, 3);
});
test('queue bounds concurrency and retains successful sentences after failures', async () => {
  let active = 0, maximum = 0, failedOnce = false;
  const translate = createTranslationQueue(async (text) => {
    active++; maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 3));
    active--;
    if (text === 'retry' && !failedOnce) { failedOnce = true; throw new Error('offline'); }
    return text;
  });
  const results = await Promise.allSettled(['a', 'b', 'retry', 'c'].map((text) => translate(text, 'zh', 'en', 'a')));
  assert.equal(maximum, 2);
  assert.equal(results[2].status, 'rejected');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await translate('retry', 'zh', 'en', 'a'), 'retry');
});
test('translation success cache is bounded and does not cache empty output', async () => {
  let calls = 0;
  const translate = createTranslationQueue(async (text) => { calls++; return text; }, 1, 2);
  for (const text of ['a', 'b', 'c', 'a']) await translate(text, 'zh', 'en', 'a');
  assert.equal(calls, 4);
  await assert.rejects(translate('', 'zh', 'en', 'a'));
});
