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


/* ------------------------------------------------------------------ *
 * Stakeholders, lenses and filming. The Impact Web layer.
 * One node per stakeholder. Every card is written from one stance.
 * ------------------------------------------------------------------ */

export type Stakeholder = 'people_served' | 'staff' | 'volunteers' | 'community' | 'donors'

export const STAKEHOLDER_ORDER: Stakeholder[] = ['people_served', 'staff', 'volunteers', 'community', 'donors']

export const STAKEHOLDERS: Record<Stakeholder, {
    label: string
    short: string
    stance: string
    coreWhy: string
    gives: string
    voice: string
    angles: StoryAngle[]
}> = {
    people_served: {
        label: 'People We Support',
        short: 'Families and individuals',
        stance: 'Faced the problem and chose to take part. They are the actor, never someone rescued.',
        coreWhy: 'What made you take that step?',
        gives: 'The change itself, and empathy',
        voice: 'Say "since you started the program", never "since we helped you". Ask what the problem cost them, never private details.',
        angles: ['person_behind_number', 'what_changed', 'first_day', 'check_back_in', 'small_win', 'what_surprised'],
    },
    staff: {
        label: 'Staff',
        short: 'The people behind the work',
        stance: 'Chose this work and sees it up close every day.',
        coreWhy: 'Why this work over any other job?',
        gives: 'An inside view and credibility',
        voice: 'Ask about the work, not the organization. Let them describe what a normal day actually looks like.',
        angles: ['behind_the_scenes', 'day_in_the_life', 'why_they_care', 'what_surprised', 'why_it_matters'],
    },
    volunteers: {
        label: 'Volunteers',
        short: 'Give time. Create change.',
        stance: 'Saw a problem that is not theirs and chose to give time.',
        coreWhy: 'Why give your time to this?',
        gives: 'Belonging: people like me help',
        voice: 'Ask what keeps them coming back, not what the charity does for them. Never thank them inside the question.',
        angles: ['why_they_care', 'behind_the_scenes', 'day_in_the_life', 'what_surprised', 'small_win'],
    },
    community: {
        label: 'Community',
        short: 'Local voices. Local leaders.',
        stance: 'Lives alongside the problem and the change, and often helps without being asked.',
        coreWhy: 'What have you noticed change around here?',
        gives: 'Outside proof that it is real',
        voice: 'They are a neighbour, not a beneficiary. Ask what they have seen and what they did, never whether the program works.',
        angles: ['why_they_care', 'what_changed', 'what_surprised', 'small_win', 'why_it_matters'],
    },
    donors: {
        label: 'Donors',
        short: 'Supporters of the mission',
        stance: 'Chooses to fund this cause and this charity, and keeps choosing to.',
        coreWhy: 'Why this cause, and why keep giving?',
        gives: 'Trust, and proof for other donors',
        voice: 'Ask why it matters to them, never how much they gave. Never make the question a request for more.',
        angles: ['why_they_care', 'why_it_matters', 'check_back_in', 'what_surprised'],
    },
}

export type Lens = 'back' | 'now' | 'surprise' | 'ahead'

export const LENSES: Record<Lens, { label: string; purpose: string; questions: QuestionSet[] }> = {
    back: {
        label: 'Looking back',
        purpose: 'What life was like, and what made them act. Asked in hindsight, never to relive the worst moment.',
        questions: ['before', 'motivation'],
    },
    now: {
        label: 'Right now',
        purpose: 'What is happening and changing today. Works even before any outcome exists.',
        questions: ['during', 'human'],
    },
    surprise: {
        label: 'The surprise',
        purpose: 'A change nobody planned for, even a small one. Often the best material.',
        questions: ['unexpected'],
    },
    ahead: {
        label: 'Looking ahead',
        purpose: 'Hopes and excitement. Shown as hopes, never as results already achieved.',
        questions: ['after', 'reflection'],
    },
}

export const LENS_ORDER: Lens[] = ['back', 'now', 'surprise', 'ahead']

export type FilmingCategory = 'in_action' | 'sit_down' | 'on_location' | 'photo_quote'

export const FILMING: Record<FilmingCategory, { label: string; kind: string; bestFor: string }> = {
    in_action: { label: 'In action', kind: 'Video', bestFor: 'Film them while they work. People relax when their hands are busy.' },
    sit_down: { label: 'Sit-down chat', kind: 'Video', bestFor: 'Sit with them and talk. This gets the longest, most personal answers.' },
    on_location: { label: 'On location', kind: 'Video', bestFor: 'A place that is part of the story. The place says something before they do.' },
    photo_quote: { label: 'Photo and quote', kind: 'No video', bestFor: 'A photo plus their words, written down. Quick and low pressure.' },
}

export const FILMING_ORDER: FilmingCategory[] = ['in_action', 'sit_down', 'on_location', 'photo_quote']

export function isStakeholder(value: unknown): value is Stakeholder {
    return typeof value === 'string' && value in STAKEHOLDERS
}

export function isLens(value: unknown): value is Lens {
    return typeof value === 'string' && value in LENSES
}

export function isFilmingCategory(value: unknown): value is FilmingCategory {
    return typeof value === 'string' && value in FILMING
}

/**
 * Words that mean a stakeholder shows up in an organization's own records.
 * Matched on whole words against record text (log titles, descriptions, metric names),
 * never against the mission statement, which mentions "community" almost everywhere.
 */
export const STAKEHOLDER_LEXICON: Record<Stakeholder, string[]> = {
    people_served: ['participant', 'student', 'client', 'patient', 'family', 'families', 'girl', 'girls', 'boy', 'boys', 'youth', 'member', 'graduate', 'attendee'],
    staff: ['staff', 'team', 'teacher', 'teachers', 'nurse', 'nurses', 'officer', 'coordinator', 'trainer', 'facilitator', 'social worker', 'counsellor', 'counselor', 'manager'],
    volunteers: ['volunteer', 'volunteers', 'volunteering', 'helper', 'helpers', 'mentor', 'mentors', 'coach', 'coaches', 'session leader', 'gave their time', 'gives their time'],
    community: ['community', 'neighbour', 'neighbours', 'neighbor', 'neighbors', 'local', 'locals', 'village', 'resident', 'residents', 'parent', 'parents', 'elder', 'elders', 'chief', 'church', 'mosque', 'turned out', 'showed up'],
    donors: ['donor', 'donors', 'donation', 'donations', 'sponsor', 'sponsors', 'funder', 'funders', 'gift', 'giving', 'supporter', 'supporters', 'campaign', 'fundraiser'],
}

/** Program shapes that imply a stakeholder exists even when nothing names them. */
export const STAKEHOLDER_IMPLIED: Record<Stakeholder, string[]> = {
    people_served: ['served', 'reached', 'enrolled', 'supported', 'attended', 'trained', 'graduated'],
    staff: ['session', 'sessions', 'workshop', 'workshops', 'class', 'classes', 'training', 'visit', 'visits', 'delivered', 'hours'],
    volunteers: ['session', 'sessions', 'workshop', 'workshops', 'distribution', 'distributions', 'event', 'events', 'clean', 'drive', 'hours', 'kits'],
    community: ['village', 'school', 'schools', 'clinic', 'centre', 'center', 'ward', 'district', 'outreach', 'awareness'],
    donors: ['raised', 'funded', 'funding', 'grant', 'grants', 'cost', 'budget', 'sponsored'],
}

/** Library slice for one stakeholder, formatted for the idea writer. */
export function stakeholderBrief(stakeholder: Stakeholder): string {
    const s = STAKEHOLDERS[stakeholder]
    return [
        `Stakeholder "${stakeholder}": ${s.label}. Stance: ${s.stance}`,
        `Their core why: ${s.coreWhy}`,
        `What their story gives the charity: ${s.gives}`,
        `Voice rules: ${s.voice}`,
    ].join('\n')
}

/** The four lenses with the question bank behind each, formatted for the idea writer. */
export function lensBrief(): string {
    return LENS_ORDER.map(lens => {
        const l = LENSES[lens]
        const bank = l.questions.flatMap(set => QUESTIONS[set])
        return `- ${lens} (${l.label}): ${l.purpose}\n  Question bank: ${bank.join(' | ')}`
    }).join('\n')
}

/** The four filming categories, formatted for the idea writer. */
export function filmingBrief(): string {
    return FILMING_ORDER.map(c => `- ${c} (${FILMING[c].label}, ${FILMING[c].kind}): ${FILMING[c].bestFor}`).join('\n')
}

export function ideaWriterPrompt(): string {
    return `You write story capture cards for Nexus, a platform for charities. Each card tells a charity team exactly which story to capture, what to ask, and how to film it. The people using it have never done storytelling. Make it effortless.

You receive signals. Each signal has an id, a stakeholder, a suggested angle, a library slice, and FACTS from the organization's own data. Write one card per signal.

THE STORY
Every charity exists to create one core change. Every story branches off it, but the story itself is about the person: their position, their reasons, what it means to them.
Questions come through four lenses:
- back (Looking back): what life was like, and what made them act
- now (Right now): what is happening and changing today
- surprise (The surprise): an unexpected change, even a small one
- ahead (Looking ahead): hopes and what they are excited for

FACTS
- Use ONLY the facts given. Never invent people, names, numbers, dates, quotes or outcomes.
- Every number you write must appear in that signal's facts. If unsure, leave numbers out.
- Some signals say a stakeholder is implied rather than recorded. There, never state that these people exist as a fact. Write the card as a story worth going to get.

WHAT TO WRITE
1. "title": the story as a short headline, 4 to 9 words. Not a task, not a command to post.
2. "why": 1 or 2 sentences naming the gap in their stories, grounded in the facts.
3. "who": the kind of person to find, by role or relationship. Never a specific named person.
4. "questions": exactly 4, each tagged with one lens, covering at least 2 different lenses. Adapt the question bank to the program.
5. "filming": one entry for each of in_action, sit_down, on_location and photo_quote. Each has a "fit" sentence saying how that way of filming suits this story, and exactly 2 ideas. Each idea has a short "name", usually a place or a moment, and exactly 3 "steps".
6. "suggested": one filming category and a one-line reason. Prefer video. Use photo_quote only when video would not work for this story.

QUESTION RULES
- Open questions only. Start with What, How, Tell me about, or Walk me through. Never yes or no.
- One thing per question.
- Point at something they can picture: a moment, a day, a person, a thing they do.
- On sensitive topics, ask what the problem cost them (school, work, family, confidence), never private details.
- Tie feelings to a moment. Never write a bare "How did that feel?"
- Make them the actor. Say "since you started the program", never "since we helped you".
- Specific about the situation, neutral about the answer. Never lead.

FILMING RULES
- Every idea is one continuous shot a first-timer can get on a phone. No editing.
- Each step is one concrete action, verb first, under 12 words.
- Steps are short enough to read while holding a phone.
- Steps describe camera and moment only. Never repeat the question text in a step.
- For photo_quote, steps cover the photo and writing their answers down word for word.

LANGUAGE
Sound like a friend asking, not a form. Short words a 12-year-old understands. No jargon, no hashtags, no emojis. Never say beneficiary, intervention, outcome, impact or stakeholder to the person. Use the program's own name. Never use an em dash. Use a period, comma or colon instead.

OTHER FIELDS
- "channels": 2 to 4 from: nexus, instagram, facebook, linkedin, donor_email, sms. Always include nexus first.
- "journey_potential": true when following up later would show change over time.
- "follow_up": one sentence on when and why to check back in, or empty string.

CHECK BEFORE RETURNING
- One clear person or group at the centre
- Every question open, single, picturable and neutral
- Every fact traceable to the facts given
- Every filming idea doable in one shot by a first-timer
If any check fails, rewrite before returning.

Return JSON only:
{"ideas":[{"signal_id":"s1","angle":"...","stakeholder":"...","title":"...","why":"...","who":"...","questions":[{"text":"...","lens":"back"}],"filming":[{"category":"in_action","fit":"...","ideas":[{"name":"...","steps":["...","...","..."]}]}],"suggested":{"category":"in_action","reason":"..."},"channels":["nexus"],"journey_potential":true,"follow_up":"..."}]}`
}

/* ------------------------------------------------------------------ *
 * Fallback cards. Used when no AI key is configured, or when the writer
 * returns nothing usable. Written so a node is never empty.
 * {program} is replaced with the program name, or "your work".
 * ------------------------------------------------------------------ */

export type WrittenCard = {
    title: string
    why: string
    who: string
    questions: { text: string; lens: Lens }[]
    filming: { category: FilmingCategory; fit: string; ideas: { name: string; steps: string[] }[] }[]
    suggested: { category: FilmingCategory; reason: string }
    channels: string[]
    journey_potential: boolean
    follow_up: string
}

const FALLBACK_CARDS: Record<Stakeholder, WrittenCard> = {
    people_served: {
        title: 'What changed since they started',
        why: 'You have logged what {program} delivers, but nobody has heard from the people behind the numbers in their own words.',
        who: 'Someone taking part in {program} who is happy to share.',
        questions: [
            { text: 'Before you started, what was the hardest part of your week?', lens: 'back' },
            { text: 'What is one thing you do now that you did not do before?', lens: 'now' },
            { text: 'Tell me about a moment here that you did not expect.', lens: 'surprise' },
            { text: 'What are you looking forward to now?', lens: 'ahead' },
        ],
        filming: [
            {
                category: 'in_action',
                fit: 'Film them doing the thing they learned. Busy hands settle nerves, and viewers see the change instead of hearing about it.',
                ideas: [
                    { name: 'Mid-activity', steps: ['Film their hands first', 'Ask while they keep working', 'Keep rolling after they answer'] },
                    { name: 'Showing someone else', steps: ['Film them helping another person', 'Ask what it is like to show someone', 'End on the two of them'] },
                ],
            },
            {
                category: 'sit_down',
                fit: 'Sit with them somewhere quiet. This gets the longest and most personal answers.',
                ideas: [
                    { name: 'A quiet room', steps: ['Sit near a window for soft light', 'Hold the phone at their eye level', 'Ask, then let the silence sit'] },
                    { name: 'Outside in the shade', steps: ['Find shade and face the light', 'Sit side by side, not across', 'Wait three seconds after each answer'] },
                ],
            },
            {
                category: 'on_location',
                fit: 'Film them where the story happened. The place explains half of it before they speak.',
                ideas: [
                    { name: 'Walking in', steps: ['Start on the door or gate', 'Let them walk into the frame', 'Ask them right there'] },
                    { name: 'Where they started', steps: ['Film the spot they began', 'Bring them into frame', 'Ask what it was like then'] },
                ],
            },
            {
                category: 'photo_quote',
                fit: 'A photo plus their exact words. Quick and low pressure when video feels like too much.',
                ideas: [
                    { name: 'Portrait in good light', steps: ['Take the photo near a window', 'Write their answers word for word', 'Read them back to check'] },
                    { name: 'With what they made', steps: ['Photo of them holding it', 'Write their strongest sentence exactly', 'Ask if you can share it'] },
                ],
            },
        ],
        suggested: { category: 'in_action', reason: 'The work shows the change better than words do.' },
        channels: ['nexus', 'instagram', 'facebook'],
        journey_potential: true,
        follow_up: 'Check back in a few months and ask the same last question again.',
    },
    staff: {
        title: 'The part of the job nobody sees',
        why: 'Your updates show what {program} delivers. They do not show the people who deliver it, or what the work actually takes.',
        who: 'Someone on your team who runs {program} week to week.',
        questions: [
            { text: 'What made you choose this work over any other job?', lens: 'back' },
            { text: 'Walk me through what a normal day here actually looks like.', lens: 'now' },
            { text: 'What is something people get wrong about this work?', lens: 'surprise' },
            { text: 'What do you hope is different here in a year?', lens: 'ahead' },
        ],
        filming: [
            {
                category: 'in_action',
                fit: 'Film them mid-task. The work answers the question before they do.',
                ideas: [
                    { name: 'Setting up for the day', steps: ['Film them getting things ready', 'Ask while they work', 'End when the first person arrives'] },
                    { name: 'In the middle of it', steps: ['Film from a few steps back', 'Ask between tasks', 'Keep rolling through the pause'] },
                ],
            },
            {
                category: 'sit_down',
                fit: 'Sit with them after a session, when the day is fresh and they are still thinking about it.',
                ideas: [
                    { name: 'The room after everyone leaves', steps: ['Sit once it is quiet', 'Phone at their eye level', 'Ask, then wait'] },
                    { name: 'At their desk', steps: ['Frame them with their work behind', 'Ask the first question', 'Let them talk themselves out'] },
                ],
            },
            {
                category: 'on_location',
                fit: 'Film them in the place they spend their days. It gives the audience a picture of the work.',
                ideas: [
                    { name: 'Arriving in the morning', steps: ['Film the entrance', 'They walk in', 'Ask them on the way'] },
                    { name: 'The spot they know best', steps: ['Let them pick the place', 'Ask why they chose it', 'Keep the camera still'] },
                ],
            },
            {
                category: 'photo_quote',
                fit: 'A photo at work plus their words. Easiest to get on a busy day.',
                ideas: [
                    { name: 'At work, not posed', steps: ['Photo while they are working', 'Write their answers word for word', 'Read them back to check'] },
                    { name: 'With the team', steps: ['Photo of the team together', 'Write one sentence from each', 'Ask before you share names'] },
                ],
            },
        ],
        suggested: { category: 'sit_down', reason: 'Staff give their best answers when they can sit and think.' },
        channels: ['nexus', 'linkedin', 'facebook'],
        journey_potential: false,
        follow_up: 'Ask again at the end of the season and compare what changed.',
    },
    volunteers: {
        title: 'Why they keep showing up',
        why: 'Volunteers help make {program} happen, but you have never shared a volunteer story.',
        who: 'A volunteer who has been around long enough to have a favourite day.',
        questions: [
            { text: 'What made you decide to give your time to this?', lens: 'back' },
            { text: 'Tell me about a moment here that stuck with you.', lens: 'now' },
            { text: 'How has volunteering changed you in a way you did not expect?', lens: 'surprise' },
            { text: 'What would you tell someone thinking about volunteering?', lens: 'ahead' },
        ],
        filming: [
            {
                category: 'in_action',
                fit: 'Film them while they are helping. Viewers see them doing it, not just talking about it.',
                ideas: [
                    { name: 'Mid-session', steps: ['Film them helping someone', 'Ask as they work', 'Keep rolling'] },
                    { name: 'Setting up before it starts', steps: ['Film them laying things out', 'Ask while they set up', 'End as the doors open'] },
                ],
            },
            {
                category: 'sit_down',
                fit: 'Sit with them once the session ends. They are warmed up and full of it.',
                ideas: [
                    { name: 'The empty room afterwards', steps: ['Sit after everyone leaves', 'Phone at their eye level', 'Ask, then let the silence sit'] },
                    { name: 'A bench outside', steps: ['Find soft light', 'Sit side by side', 'Keep rolling after they answer'] },
                ],
            },
            {
                category: 'on_location',
                fit: 'Film them arriving or in the space they give their time to.',
                ideas: [
                    { name: 'Arriving for a session', steps: ['Film the entrance', 'They walk in', 'Ask them right there'] },
                    { name: 'The supply corner', steps: ['Start on the shelves or kit', 'They step into frame', 'Ask them there'] },
                ],
            },
            {
                category: 'photo_quote',
                fit: 'A photo mid-help plus their words. Takes two minutes at the end of a session.',
                ideas: [
                    { name: 'While they help', steps: ['Photo of them helping', 'Write their answers word for word', 'Read them back to check'] },
                    { name: 'With what they prepared', steps: ['Photo with the things they packed', 'Write their strongest sentence exactly', 'Ask if you can share it'] },
                ],
            },
        ],
        suggested: { category: 'in_action', reason: 'The work shows why they come back.' },
        channels: ['nexus', 'instagram', 'facebook'],
        journey_potential: false,
        follow_up: 'Ask again after a year and see what keeps them.',
    },
    community: {
        title: 'What the neighbourhood noticed',
        why: 'Everything you share comes from inside {program}. Nobody from the surrounding community has said what they have seen change.',
        who: 'Someone who lives or works nearby and sees the program from the outside.',
        questions: [
            { text: 'What was this place like before any of this started?', lens: 'back' },
            { text: 'What have you noticed change around here?', lens: 'now' },
            { text: 'What surprised you about how people responded?', lens: 'surprise' },
            { text: 'What would you like to see happen here next?', lens: 'ahead' },
        ],
        filming: [
            {
                category: 'in_action',
                fit: 'Film them doing their own thing nearby. A neighbour at their stall or gate reads as real.',
                ideas: [
                    { name: 'Where they work', steps: ['Film them at their own work', 'Ask without stopping them', 'Keep rolling through the answer'] },
                    { name: 'Lending a hand', steps: ['Film them helping out', 'Ask what made them pitch in', 'End on the people around them'] },
                ],
            },
            {
                category: 'sit_down',
                fit: 'Sit with a long-time local. They remember what the place was like before.',
                ideas: [
                    { name: 'Outside their home', steps: ['Sit where they are comfortable', 'Phone at their eye level', 'Ask, then wait'] },
                    { name: 'A spot they choose', steps: ['Let them pick the place', 'Ask why they picked it', 'Keep the camera still'] },
                ],
            },
            {
                category: 'on_location',
                fit: 'Film in the shared space itself. The street or the yard is the point of the story.',
                ideas: [
                    { name: 'The shared space', steps: ['Film the street or yard', 'Bring them into frame', 'Ask what it looked like before'] },
                    { name: 'Walk and talk', steps: ['Walk with them, phone at chest height', 'Ask as you go', 'Stop where the change shows'] },
                ],
            },
            {
                category: 'photo_quote',
                fit: 'A photo in their own setting plus their words. Good when people are busy.',
                ideas: [
                    { name: 'In their own setting', steps: ['Photo where you found them', 'Write their answers word for word', 'Read them back to check'] },
                    { name: 'A few voices together', steps: ['Photo of the group', 'Write one sentence from each person', 'Ask before you share names'] },
                ],
            },
        ],
        suggested: { category: 'on_location', reason: 'The place itself is the proof that something changed.' },
        channels: ['nexus', 'facebook', 'instagram'],
        journey_potential: false,
        follow_up: 'Come back in a year and ask the same question again.',
    },
    donors: {
        title: 'Why they keep giving',
        why: 'People fund this work, but their reasons have never been shared. Other supporters trust a donor voice more than yours.',
        who: 'A supporter who has given more than once and will talk about why.',
        questions: [
            { text: 'When did this cause first start to matter to you?', lens: 'back' },
            { text: 'What keeps you giving to this one?', lens: 'now' },
            { text: 'What surprised you once you knew more about the work?', lens: 'surprise' },
            { text: 'What do you hope your support makes possible?', lens: 'ahead' },
        ],
        filming: [
            {
                category: 'in_action',
                fit: 'Film them on a visit, seeing the work they fund. Their reaction is the story.',
                ideas: [
                    { name: 'On a visit', steps: ['Film them meeting the team', 'Ask what they are seeing', 'Keep rolling as they watch'] },
                    { name: 'Helping for a day', steps: ['Film them joining in', 'Ask why they came', 'End on the room around them'] },
                ],
            },
            {
                category: 'sit_down',
                fit: 'Sit with them somewhere they feel at ease. Giving is personal and this is where they say why.',
                ideas: [
                    { name: 'Somewhere they choose', steps: ['Let them pick the place', 'Phone at their eye level', 'Ask, then let the silence sit'] },
                    { name: 'A short call recording', steps: ['Record the call with permission', 'Ask the first question early', 'Write their strongest sentence exactly'] },
                ],
            },
            {
                category: 'on_location',
                fit: 'Film them at the place their money changed. It connects the giving to something they can see.',
                ideas: [
                    { name: 'The thing they funded', steps: ['Film what their giving paid for', 'Bring them into frame', 'Ask what they hoped it would do'] },
                    { name: 'Where it started', steps: ['Film the place they first visited', 'Ask what they remember', 'Keep the camera still'] },
                ],
            },
            {
                category: 'photo_quote',
                fit: 'A photo and their words. Many supporters prefer this to being on camera.',
                ideas: [
                    { name: 'Portrait in good light', steps: ['Photo near a window', 'Write their answers word for word', 'Read them back to check'] },
                    { name: 'Words only', steps: ['Skip the photo if they prefer', 'Write their strongest sentence exactly', 'Ask how they want to be named'] },
                ],
            },
        ],
        suggested: { category: 'sit_down', reason: 'Supporters open up most when they can sit and talk.' },
        channels: ['nexus', 'donor_email', 'linkedin'],
        journey_potential: false,
        follow_up: 'Ask again after their next gift and see what has changed for them.',
    },
}

/** A complete, written card for a stakeholder when the AI writer is unavailable. */
export function fallbackCard(stakeholder: Stakeholder, program?: string | null): WrittenCard {
    const name = (program || '').trim() || 'your work'
    const fill = (text: string) => text.replace(/\{program\}/g, name)
    const base = FALLBACK_CARDS[stakeholder]
    return {
        ...base,
        title: fill(base.title),
        why: fill(base.why),
        who: fill(base.who),
        questions: base.questions.map(q => ({ ...q })),
        filming: base.filming.map(f => ({ ...f, ideas: f.ideas.map(i => ({ ...i, steps: [...i.steps] })) })),
        suggested: { ...base.suggested },
        channels: [...base.channels],
    }
}
