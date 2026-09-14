const { chromium, launchOptions, artifactPath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1050, height: 820 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const send = async (text, speaker, id, final, timestamp = 100000) => page.evaluate(async ({text,speaker,id,final,timestamp}) => {
    await window.__cnTest.emit(final ? 'transcript_final' : 'transcript_update', {segment:{text,speaker,id,is_final:final,timestamp_ms:timestamp,speaker_id:'speaker_0'}});
  }, {text,speaker,id,final,timestamp});
  try {
    await page.goto('http://127.0.0.1:5178/tests/cn-preview.html');
    await page.waitForFunction(() => !!window.__cnTest);
    await page.evaluate(() => { window.__cnTest.clear(); window.__cnTest.resetSpeakers(); window.__cnTest.automatic(true); window.__cnTest.translateLive(); });
    for (let i=0;i<5;i++) await send('..', 'Them', 'ghost_'+i, true);
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => window.__cnTest.segments().length), 0);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 0);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.transcriptTranslations), 0);
    console.log('PASS: punctuation events create no subtitles, translations or automatic replies');
    await send('Thank you.', 'User', 'you_session_speech_turn_1', true, 90000);
    await send('You are welcome.', 'Them', 'them_session_speech_turn_1', true, 92000);
    await page.waitForFunction(() => window.__cnTest.segments().length === 2);
    const speakers = await page.evaluate(() => window.__cnTest.speakers());
    assert.equal(speakers.you.display_name, '我方'); assert.equal(speakers.them.display_name, '对方');
    assert.equal(Object.keys(speakers).length, 2);
    assert.equal(await page.getByText(/发言者\s*\d/).count(), 0);
    console.log('PASS: cold overlay state and identical diarization IDs still have distinct fixed channel labels; real thanks preserved');
    const question = 'Would you want to live there again in future? Please explain your reasons and how your plans might affect that decision.';
    await send(question.slice(0,56), 'Them', 'them_session_speech_turn_2', false);
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 0);
    await page.getByText('字幕译文：'+question.slice(0,56), {exact:true}).waitFor();
    // A user's brief backchannel during a long teacher turn must not suppress
    // the later complete question (turn timestamps mark START, not END).
    await send('I see.', 'User', 'you_session_speech_turn_2', true, 105000);
    await send(question, 'Them', 'them_session_speech_turn_2', false);
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 0);
    assert.equal(await page.evaluate(() => window.__cnTest.segments().filter(s=>s.id==='them_session_speech_turn_2').length), 1);
    await send(question, 'Them', 'them_session_speech_turn_2', true);
    await page.waitForFunction(() => window.__cnTest.stats.generations === 1);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.lastQuestion), question);
    await page.waitForFunction(() => !window.__cnTest.streaming());
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 1);
    await page.screenshot({path:artifactPath('speech-turns.png'),fullPage:true});
    console.log('PASS: incremental translation while speaking, one assembled turn and one reply only after finalization');
    await send('That makes sense.', 'Them', 'them_session_speech_turn_3', true, 110000);
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 1);
    console.log('PASS: later non-question does not re-answer an old question');
    assert.deepEqual(errors, []);
  } catch(e) {
    await page.screenshot({path:artifactPath('speech-turns-failure.png'),fullPage:true});
    throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
