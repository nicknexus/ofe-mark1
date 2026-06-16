import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { openai, isOpenAIConfigured } from '../utils/openai';

const router = Router();

/**
 * WorldSee AI onboarding chat — guided, one section at a time.
 *
 * The frontend drives a stage machine (description → locations → initiatives →
 * metrics → groups). Each request carries the current `stage` (+ light context
 * like the initiative being set up). The model only ever proposes items for the
 * current stage, returning them via a stage-specific tool so the UI can render
 * editable review cards. Nothing is persisted server-side here.
 */

type Stage = 'description' | 'locations' | 'initiatives' | 'metrics' | 'groups';

const BASE_PERSONA = `You are WorldSee AI, a warm, concise onboarding guide for an impact-tracking platform used by charities and non-profits. You help one small step at a time. Keep replies to 1-2 short sentences. Never invent specific result numbers, dates, or counts the user didn't give.`;

function systemPrompt(stage: Stage, ctx: { orgName?: string; initiativeTitle?: string }): string {
  const org = ctx.orgName ? ` The organization is "${ctx.orgName}".` : '';
  switch (stage) {
    case 'description':
      return `${BASE_PERSONA}${org}
You are on the ORGANIZATION step. Help the user articulate what their organization does. Ask at most one short question if you need more, otherwise call propose_description with a one-line mission statement (max 150 chars) and a short description paragraph. If the user gives enough in one message, propose immediately.`;
    case 'locations':
      return `${BASE_PERSONA}${org}
You are on the LOCATIONS step. Ask where the organization operates and creates impact (cities, regions, countries). When you know, call propose_locations with the place names (city, country). Don't invent places the user didn't mention.`;
    case 'initiatives':
      return `${BASE_PERSONA}${org}
You are on the INITIATIVES step. Initiatives are top-level programs/projects. Help name the user's main programs, then call propose_initiatives with a title and one-line description for each. Suggest 1-3 sensible initiatives based on what they do — keep it tight, they can add more later.`;
    case 'metrics':
      return `${BASE_PERSONA}${org}
You are on the METRICS step for the initiative "${ctx.initiativeTitle || ''}". Metrics are measurable indicators. Each needs: a title, a unit (e.g. People, Hours, Meals), a metric_type ("number" or "percentage"), and a category — "input" (resources in), "output" (direct results), or "impact" (long-term effects). Suggest 2-4 strong, measurable metrics for THIS initiative, then call propose_metrics. Describe WHAT is measured, not values.`;
    case 'groups':
      return `${BASE_PERSONA}${org}
You are on the BENEFICIARY GROUPS step for the initiative "${ctx.initiativeTitle || ''}". Groups describe who is served (e.g. "Children 5-12"). This is optional. If the user names groups, call propose_groups; otherwise ask one short question. Don't invent total numbers.`;
  }
}

function tool(stage: Stage): any {
  const t = (name: string, properties: any, required: string[]) => ({
    type: 'function',
    function: { name, description: `Propose items for the current step for the user to review and edit before adding.`, parameters: { type: 'object', properties, required } },
  });

  switch (stage) {
    case 'description':
      return t('propose_description', {
        statement: { type: 'string', description: 'Mission statement, max 150 chars' },
        description: { type: 'string', description: 'Short description paragraph' },
      }, []);
    case 'locations':
      return t('propose_locations', {
        locations: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, country: { type: 'string' } }, required: ['name'] } },
      }, ['locations']);
    case 'initiatives':
      return t('propose_initiatives', {
        initiatives: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, region: { type: 'string' } }, required: ['title'] } },
      }, ['initiatives']);
    case 'metrics':
      return t('propose_metrics', {
        metrics: { type: 'array', items: { type: 'object', properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          unit_of_measurement: { type: 'string' },
          metric_type: { type: 'string', enum: ['number', 'percentage'] },
          category: { type: 'string', enum: ['input', 'output', 'impact'] },
          tags: { type: 'array', items: { type: 'string' } },
        }, required: ['title', 'unit_of_measurement', 'metric_type', 'category'] } },
      }, ['metrics']);
    case 'groups':
      return t('propose_groups', {
        groups: { type: 'array', items: { type: 'object', properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          total_number: { type: 'number' },
          age_range_start: { type: 'number' },
          age_range_end: { type: 'number' },
        }, required: ['name'] } },
      }, ['groups']);
  }
}

/** Map the tool args to the flat `items` array the frontend renders. */
function itemsFromArgs(stage: Stage, args: any): any[] {
  switch (stage) {
    case 'description': return [{ statement: args.statement || '', description: args.description || '' }];
    case 'locations': return Array.isArray(args.locations) ? args.locations : [];
    case 'initiatives': return Array.isArray(args.initiatives) ? args.initiatives : [];
    case 'metrics': return Array.isArray(args.metrics) ? args.metrics : [];
    case 'groups': return Array.isArray(args.groups) ? args.groups : [];
  }
}

router.post('/chat', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isOpenAIConfigured() || !openai) {
      res.status(503).json({ error: 'AI assistant is not configured' });
      return;
    }

    const { messages, stage, context } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      stage: Stage;
      context?: { orgName?: string; initiativeTitle?: string };
    };

    const validStages: Stage[] = ['description', 'locations', 'initiatives', 'metrics', 'groups'];
    if (!validStages.includes(stage)) {
      res.status(400).json({ error: 'invalid stage' });
      return;
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages is required' });
      return;
    }

    const trimmed = messages.slice(-16).map(m => ({ role: m.role, content: String(m.content || '').slice(0, 4000) }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 1200,
      tools: [tool(stage)],
      tool_choice: 'auto',
      messages: [{ role: 'system', content: systemPrompt(stage, context || {}) }, ...trimmed],
    });

    const choice = completion.choices[0]?.message;
    const toolCalls = (choice?.tool_calls || []) as any[];
    const toolCall = toolCalls.find(t => t.type === 'function');

    if (toolCall) {
      let args: any = {};
      try { args = JSON.parse(toolCall.function.arguments || '{}'); }
      catch { res.json({ type: 'message', stage, content: 'Sorry — could you say a bit more?' }); return; }
      res.json({
        type: 'proposal',
        stage,
        items: itemsFromArgs(stage, args),
        content: choice?.content || 'Here’s what I’ve got — edit anything, then add it.',
      });
      return;
    }

    res.json({ type: 'message', stage, content: choice?.content || '...' });
  } catch (error: any) {
    console.error('Onboarding chat error:', error);
    if (error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota') {
      res.status(402).json({ error: 'OpenAI Quota Exceeded', code: 'insufficient_quota' });
      return;
    }
    if (error?.status === 429) {
      res.status(429).json({ error: 'Rate Limit Exceeded', code: 'rate_limit' });
      return;
    }
    res.status(500).json({ error: 'Failed to reach the AI assistant' });
  }
});

export default router;
