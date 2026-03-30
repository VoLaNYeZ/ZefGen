import test from 'node:test';
import assert from 'node:assert/strict';

import {
    analyzeGeneratedAppstoreMetadata,
    analyzeGeneratedDescription,
    analyzeGeneratedKeywords,
    APPSTORE_KEYWORDS_LENGTH,
    APPSTORE_SUBTITLE_OPTION_COUNT,
    MIN_DESCRIPTION_LENGTH,
    MAX_APPSTORE_SUBTITLE_LENGTH,
    repairGeneratedKeywords,
    sanitizeClientSpecForPrompt,
} from '../lib/server/generate-appstore-description.shared.js';

test('sanitizeClientSpecForPrompt keeps legitimate feature details while stripping meta scaffolding', () => {
    const rawSpec = `
The onboarding opens with a modal that explains what to do first.
Users can keep the default workout plan or customize it for travel days.
The tab bar lets people jump between progress, journal, and coach chat.
Offline notes are stored in local storage so recovery is fast after a dropped connection.
Tone options: warm, playful, sharp
Placeholder text: {cta}
Character limit: 150
Jobs-to-be-done: help stressed people feel in control
App Store copy rules: 4 bullets max
    `;

    const sanitized = sanitizeClientSpecForPrompt(rawSpec);

    assert.match(sanitized, /modal that explains what to do first/i);
    assert.match(sanitized, /default workout plan/i);
    assert.match(sanitized, /tab bar lets people jump/i);
    assert.match(sanitized, /local storage/i);
    assert.doesNotMatch(sanitized, /Tone options:/i);
    assert.doesNotMatch(sanitized, /Placeholder text:/i);
    assert.doesNotMatch(sanitized, /Character limit:/i);
    assert.doesNotMatch(sanitized, /Jobs-to-be-done:/i);
    assert.doesNotMatch(sanitized, /App Store copy rules:/i);
});

test('analyzeGeneratedDescription flags short bullet-heavy drafts', () => {
    const draft = [
        'Plan your week without the usual friction.',
        ['- Fast setup', '- Smart reminders', '- Clean organization', '- Helpful nudges', '- Clear progress'].join('\n'),
        'Download the app today and get started in seconds.',
    ].join('\n\n');

    const analysis = analyzeGeneratedDescription(draft);

    assert.match(analysis.issues.join(','), /too_short/);
    assert.match(analysis.issues.join(','), /bullet_heavy/);
    assert.match(analysis.issues.join(','), /generic_cta/);
});

test('analyzeGeneratedDescription rejects generic CTA closers even in long drafts', () => {
    const paragraphA =
        'Turn scattered plans, half-finished notes, and constant context switching into a routine that feels clear from the moment you open the app. Everything is designed to help you see what matters now, remember what matters next, and move through your day without rebuilding your focus every hour. Instead of flooding you with abstract dashboards, the experience keeps priorities readable, actions obvious, and momentum easy to recover whenever life interrupts the flow you were trying to keep. It gives people a calmer way to move through busy stretches without losing track of context, and that difference becomes obvious whenever the day gets crowded, reactive, or mentally noisy.';
    const paragraphB =
        'As the day unfolds, the app keeps your schedule, reflections, and progress connected in one place so you can make small decisions faster and with less second-guessing. It supports quick check-ins when you only have a minute, deeper planning when you finally have room to think, and the kind of gentle structure that helps busy people stay consistent without feeling micromanaged by another productivity system. The result is not just cleaner organization on paper, but more confidence in what to tackle next, less wasted energy on reorienting, and a stronger sense that the day is still under control even when priorities shift more than once.';
    const paragraphC =
        'Over time, the payoff feels practical rather than dramatic. You spend less energy remembering what was supposed to happen next, recover faster after interruptions, and build more trust in your own routine because the app keeps the important pieces within reach. That quiet reliability is what makes the experience stick: it helps people feel organized without demanding a perfect system, and it keeps progress visible even when the day refuses to stay predictable.';
    const draft = [paragraphA, paragraphB, paragraphC, 'Download the app today and get started in seconds.'].join('\n\n');

    const analysis = analyzeGeneratedDescription(draft);

    assert.ok(analysis.metrics.charCount > MIN_DESCRIPTION_LENGTH);
    assert.match(analysis.issues.join(','), /generic_cta/);
});

test('analyzeGeneratedDescription accepts long paragraph-first descriptions', () => {
    const validDescription = [
        'Turn scattered plans, half-finished notes, and last-minute decisions into a calmer daily rhythm. The app helps people move from mental clutter to clear action by keeping priorities visible, reducing the friction of getting started, and making it easier to pick back up after distractions. Instead of feeling like another system that demands perfect discipline, it feels approachable from the first session and stays useful on busy days when attention is already stretched thin.',
        'Everything is shaped around the moments when people usually lose momentum: the morning when they need a quick plan, the afternoon when priorities shift, and the evening when they want to understand what actually moved forward. The experience makes it easy to capture ideas before they disappear, organize them into something workable, and return to the right next step without digging through menus or rebuilding context from scratch. When routines change, the app adapts quickly enough to stay supportive instead of becoming another thing to manage.',
        'Over time, the value becomes more obvious in subtle ways. Plans feel less chaotic, progress feels more visible, and the small decisions that used to drain energy start taking less effort. The app gives people a sense of direction without becoming overbearing, which makes it easier to stay steady, confident, and realistic about what can get done in a day. That balance of clarity and flexibility is what makes the experience feel dependable long after the first impression.',
    ].join('\n\n');

    const analysis = analyzeGeneratedDescription(validDescription);

    assert.ok(validDescription.length > MIN_DESCRIPTION_LENGTH);
    assert.deepEqual(analysis.issues, []);
    assert.equal(analysis.metrics.paragraphCount, 3);
});

test('analyzeGeneratedAppstoreMetadata accepts 5 short subtitles and exact-length keywords', () => {
    const keywords = `focus,clarity,habits,routine,calm,coach,energy,journal,planner,wellness,mindset,reset,tracker,rhythm`;
    assert.equal(keywords.length, APPSTORE_KEYWORDS_LENGTH);

    const analysis = analyzeGeneratedAppstoreMetadata({
        subtitleOptions: ['Build calmer routines', 'Track habits clearly', 'Stay steady every day', 'Plan with less stress', 'Keep progress visible'],
        keywords,
    });

    assert.deepEqual(analysis.issues, []);
    assert.equal(analysis.subtitleOptions.length, APPSTORE_SUBTITLE_OPTION_COUNT);
    assert.ok(analysis.subtitleOptions.every((option) => option.length <= MAX_APPSTORE_SUBTITLE_LENGTH));
    assert.equal(analysis.keywords.length, APPSTORE_KEYWORDS_LENGTH);
});

test('analyzeGeneratedAppstoreMetadata rejects malformed subtitle and keyword payloads', () => {
    const analysis = analyzeGeneratedAppstoreMetadata({
        subtitleOptions: ['This subtitle is definitely more than thirty characters long', 'Repeat me', 'Repeat me'],
        keywords: 'Focus,clear wins,energy2,habits',
    });

    assert.match(analysis.issues.join(','), /subtitle_count/);
    assert.match(analysis.issues.join(','), /subtitle_length/);
    assert.match(analysis.issues.join(','), /keywords_length/);
});

test('repairGeneratedKeywords repacks long valid keyword sets to exact length', () => {
    const repaired = repairGeneratedKeywords(
        'focus,clarity,habits,routine,calm,coach,energy,journal,planner,wellness,mindset,reset,tracker,rhythm,breathing',
        ['Build calmer routines with a coach, planner, and journal that keep progress visible every day.']
    );
    const analysis = analyzeGeneratedKeywords(repaired);

    assert.equal(repaired.length, APPSTORE_KEYWORDS_LENGTH);
    assert.deepEqual(analysis.issues, []);
});

test('repairGeneratedKeywords can backfill short keyword lists from source context', () => {
    const repaired = repairGeneratedKeywords('focus,clarity,habits', [
        'routine calm coach energy journal planner wellness mindset reset tracker rhythm',
    ]);
    const analysis = analyzeGeneratedKeywords(repaired);

    assert.equal(repaired.length, APPSTORE_KEYWORDS_LENGTH);
    assert.deepEqual(analysis.issues, []);
});

test('repairGeneratedKeywords normalizes dirty inputs before packing to exact length', () => {
    const repaired = repairGeneratedKeywords(' Focus , clarity , energy2 , coach ,, reset ', [
        'planner journal routine wellness tracker mindset calm habits progress goals',
    ]);
    const analysis = analyzeGeneratedKeywords(repaired);

    assert.equal(repaired.length, APPSTORE_KEYWORDS_LENGTH);
    assert.deepEqual(analysis.issues, []);
});
