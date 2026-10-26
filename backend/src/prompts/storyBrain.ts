/**
 * Universal storytelling knowledge for capture recommendations ("what should we capture?").
 * This layer belongs to Nexus, not the org. Org facts arrive per request as signals.
 * V1 capture plans are photo + exact quote only (no video posting yet).
 */

export type StoryAngle =
    | 'person_behind_number'
    | 'what_changed'
    | 'behind_the_scenes'
    | 'first_day'
    | 'check_back_in'
    | 'why_they_care'
    | 'what_surprised'
    | 'day_in_the_life'
    | 'small_win'
    | 'why_it_matters'

export type QuestionSet = 'before' | 'during' | 'after' | 'human' | 'unexpected' | 'motivation' | 'reflection'

export type CaptureMethod = 'natural_photo' | 'in_action' | 'photo_quote' | 'group_photo' | 'staff_explains'

export const ANGLES: Record<StoryAngle, { label: string; useWhen: string; questions: QuestionSet[]; capture: CaptureMethod[] }> = {
    person_behind_number: {
        label: 'Show the person behind the number',
        useWhen: 'A strong metric exists but there is no human story attached to it.',
        questions: ['after', 'human'],
        capture: ['photo_quote', 'natural_photo'],
    },
    what_changed: {
        label: 'Show what changed',
        useWhen: 'The program has run long enough for an outcome to show.',
        questions: ['before', 'after'],
        capture: ['photo_quote', 'in_action'],
    },
    behind_the_scenes: {
        label: 'Take us behind the scenes',
        useWhen: 'People see the result but not the work it takes to deliver the program.',
        questions: ['during', 'unexpected'],
        capture: ['in_action', 'staff_explains'],
    },
    first_day: {
        label: 'Show us the first day',
        useWhen: 'Something new just started: a program, a group, a participant, a partner.',
        questions: ['before', 'during'],
        capture: ['in_action', 'group_photo', 'photo_quote'],
    },
    check_back_in: {
        label: 'Check back in',
        useWhen: 'A previous story exists and enough time has passed to show progress.',
        questions: ['after', 'reflection'],
        capture: ['natural_photo', 'photo_quote'],
    },
    why_they_care: {
        label: 'Tell us why this person cares',
        useWhen: 'Staff, volunteers, donors or partners have not been featured.',
        questions: ['motivation', 'human'],
        capture: ['photo_quote', 'in_action'],
    },
    what_surprised: {
        label: 'Ask what surprised them',
        useWhen: 'You want an authentic answer rather than a rehearsed organizational message.',
        questions: ['unexpected', 'reflection'],
        capture: ['photo_quote'],
    },
    day_in_the_life: {
        label: 'Show a day in their life',
        useWhen: 'The audience does not picture what the program looks like day to day.',
        questions: ['during', 'human'],
        capture: ['in_action', 'natural_photo'],
    },
    small_win: {
        label: 'Share a small win',
        useWhen: 'Recent activity happened but nothing big enough for a milestone post.',
        questions: ['during', 'human'],
        capture: ['natural_photo', 'photo_quote'],
    },
    why_it_matters: {
        label: 'Explain why the number matters',
        useWhen: 'A metric moved but the audience will not know why it is important.',
        questions: ['before', 'reflection'],
        capture: ['staff_explains', 'photo_quote'],
    },
}

export const QUESTIONS: Record<QuestionSet, string[]> = {
    before: [
        'What was happening before?',
        'What was difficult?',
        'What did you need?',
        'What were you hoping would change?',
        'What were you worried about?',
    ],
    during: [
        'What happened?',
        'What was that experience like?',
        'What stands out?',
        'Who helped?',
        'What happens here that most people never see?',
    ],
    after: [
        'What is different now?',
        'What can you do now that you could not do before?',
        'What are you most proud of?',
        'What still needs to happen?',
        'What was the moment you realized something was changing?',
    ],
    human: [
        'What does this mean to you?',
        'What moment do you remember most?',
        'What would you want people to understand?',
        'What would you tell someone who knows nothing about this?',
    ],
    unexpected: [
        'What surprised you most?',
        'What did not go as expected?',
        'What is something people do not understand about this?',
        'What do you wish people knew?',
    ],
    motivation: [
        'Why did you get involved?',
        'Why does this matter to you?',
        'What made you say yes?',
        'What keeps you involved?',
    ],
    reflection: [
        'What have you learned?',
        'Has this changed how you think about the issue?',
        'What do you hope happens next?',
    ],
}

export const CAPTURE_METHODS: Record<CaptureMethod, { label: string; bestFor: string }> = {
    natural_photo: { label: 'A natural photo', bestFor: 'Human connection and context. Not a posed portrait.' },
    in_action: { label: 'A photo of them in action', bestFor: 'Programs, training, work, community activity.' },
    photo_quote: { label: 'A photo plus their exact words', bestFor: 'Strong statements for social, email and the website.' },
    group_photo: { label: 'A group photo', bestFor: 'Community, volunteers, events and milestones.' },
    staff_explains: { label: 'A staff member explaining it', bestFor: 'Context, complex work, behind the scenes.' },
}

export const CAPTURE_DO = [
    'Find a quiet spot with good light on their face.',
    'Put them somewhere natural, doing something real.',
    'Ask the first question, then let them finish.',
    'Ask one follow-up.',
    'Take the photo after the conversation, when they are relaxed.',
    'Write down their strongest sentence exactly as they said it.',
    'Ask if it is OK to share their name, photo and words.',
]

export const CAPTURE_DONT = [
    'Do not read a script to them.',
    'Do not tell them what answer you want.',
    'Do not interrupt.',
    'Do not ask ten questions.',
    'Do not make them repeat your marketing language.',
]

export const LEVELS = {
    quick: { label: 'Quick', time: '2 to 5 minutes' },
    good: { label: 'Good', time: '10 to 15 minutes' },
    story: { label: 'Story', time: '20 to 30 minutes' },
} as const

export const IDEA_CHANNELS = ['nexus', 'instagram', 'facebook', 'linkedin', 'donor_email', 'sms'] as const

export function isAngle(value: unknown): value is StoryAngle {
    return typeof value === 'string' && value in ANGLES
}

/** Library slice for one angle, formatted for the idea writer. */
export function angleBrief(angle: StoryAngle): string {
    const a = ANGLES[angle]
    const questions = a.questions.flatMap(set => QUESTIONS[set])
    const methods = a.capture.map(m => `${CAPTURE_METHODS[m].label} (${CAPTURE_METHODS[m].bestFor})`)
    return [
        `Angle "${angle}": ${a.label}. Use when: ${a.useWhen}`,
        `Question bank: ${questions.join(' | ')}`,
        `Capture methods: ${methods.join(' | ')}`,
    ].join('\n')
}

export function ideaWriterPrompt(): string {
    return `You are Nexus, an AI head of storytelling for a nonprofit. You tell a busy, non-marketer team what real story to go capture next, who to talk to, what to ask, and how to capture it.

You receive signals. Each signal has an id, a suggested angle, a library slice for that angle, and FACTS from the organization's own data.

For each signal, write one idea card. Rules:
- Use ONLY the facts given. Never invent people, names, numbers, dates, quotes or outcomes.
- Every number you write must appear in that signal's facts. If unsure, leave numbers out.
- Plain, warm, specific language. Short sentences. No jargon, no hashtags, no emojis.
- Never use an em dash. Use a period, comma or colon instead.
- "ask": pick 1 or 2 questions from the angle's question bank. You may lightly adapt wording to the program. Open questions only.
- "who": describe the kind of person to find (role or relationship), never a specific named person.
- Capture plans are PHOTOS and EXACT QUOTES only. No video, no audio.
  - Each step is one concrete action, under 15 words, starting with a verb.
  - quick: exactly 2 or 3 steps, 2 to 5 minutes. One photo, one question, their exact words.
  - good: 3 or 4 steps, 10 to 15 minutes. Ask both questions, one follow-up, a natural or in-action photo, their exact words.
  - story: 4 or 5 steps, 20 to 30 minutes. A longer conversation, 2 or 3 photos (person, context, detail), before and after context, and setting up a journey when it fits.
  - Each level must be meaningfully different. Never copy a step word for word from another level.
  - In steps, refer to questions as "the first question" and "the second question". Never repeat the question text in a step.
  - Whenever a person is asked a question, include a step to write down their strongest sentence exactly as they said it.
- "channels": 2 to 4 from: nexus, instagram, facebook, linkedin, donor_email, sms. Always include nexus first.
- "journey_potential": true when following up later would show change over time.
- "follow_up": one sentence on when and why to check back in, or empty string.
- "title": 4 to 9 words, phrased as the story to capture, not a command to post.
- "why": 1 to 2 sentences naming the gap in their stories, grounded in the facts.

Return JSON only:
{"ideas":[{"signal_id":"...","angle":"...","title":"...","why":"...","who":"...","ask":["..."],"capture":{"quick":["..."],"good":["..."],"story":["..."]},"channels":["nexus","..."],"journey_potential":true,"follow_up":"..."}]}`
}
