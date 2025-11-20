import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { ReportService } from '../services/reportService';
import { openai, isOpenAIConfigured } from '../utils/openai';

const router = Router();

// Get filtered report data for preview
router.post('/report-data', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiativeId, dateStart, dateEnd, kpiIds, locationIds, beneficiaryGroupIds } = req.body;

        if (!initiativeId) {
            res.status(400).json({ error: 'initiativeId is required' });
            return;
        }

        const reportData = await ReportService.getReportData({
            initiativeId,
            userId: req.user!.id,
            dateStart,
            dateEnd,
            kpiIds: Array.isArray(kpiIds) ? kpiIds : undefined,
            locationIds: Array.isArray(locationIds) ? locationIds : undefined,
            beneficiaryGroupIds: Array.isArray(beneficiaryGroupIds) ? beneficiaryGroupIds : undefined
        });

        res.json(reportData);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Generate AI report
router.post('/generate-report', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!isOpenAIConfigured()) {
            res.status(500).json({ error: 'OpenAI API key not configured' });
            return;
        }

        const {
            initiativeId,
            initiativeTitle,
            dateRange: dateRangeInput,
            totals,
            rawMetrics,
            selectedStory,
            locations,
            beneficiaryGroups,
            deepLink
        } = req.body;

        // Validate required fields (selectedStory is now optional)
        if (!initiativeId || !initiativeTitle) {
            console.error('Missing required fields:', {
                initiativeId: !!initiativeId,
                initiativeTitle: !!initiativeTitle,
                dateRange: !!dateRangeInput,
                selectedStory: !!selectedStory
            });
            res.status(400).json({ error: 'Missing required fields: initiativeId and initiativeTitle are required' });
            return;
        }

        // Ensure dateRange has at least one date
        const dateRange = dateRangeInput && (dateRangeInput.start || dateRangeInput.end)
            ? dateRangeInput
            : { start: '', end: '' };

        // Build system prompt
        const systemPrompt = `You are an expert at writing humanitarian and charity impact reports. 
You receive metrics, descriptions, locations, and a chosen story. 
Your job is to create a professional impact report. 
Keep it factual and follow the structure given.
Write in a clear, professional tone suitable for stakeholders, donors, and partners.
Use specific numbers and data points from the metrics provided.
Make the report engaging but factual.`;

        // Build user prompt with all data
        const dateRangeText = dateRange.start && dateRange.end 
            ? `${dateRange.start} to ${dateRange.end}`
            : dateRange.start || dateRange.end || 'Not specified';
        
        const totalsText = totals && totals.length > 0
            ? totals.map((t: any) => 
                `- ${t.kpi_title}: ${t.total_value} ${t.unit_of_measurement}${t.kpi_description ? ` (${t.kpi_description})` : ''}`
            ).join('\n')
            : 'No metrics available';

        const metricsText = rawMetrics && rawMetrics.length > 0
            ? rawMetrics.slice(0, 20).map((m: any) => 
                `- ${m.kpi_title}: ${m.value} ${m.unit_of_measurement} on ${m.date_represented}${m.location_name ? ` at ${m.location_name}` : ''}`
            ).join('\n')
            : 'No individual metrics available';

        const locationsText = locations && locations.length > 0
            ? locations.map((l: any) => 
                `- ${l.name}${l.description ? `: ${l.description}` : ''}`
            ).join('\n')
            : 'No locations specified';

        const beneficiaryGroupsText = beneficiaryGroups && beneficiaryGroups.length > 0
            ? beneficiaryGroups.map((bg: any) => 
                `- ${bg.name}${bg.description ? `: ${bg.description}` : ''}`
            ).join('\n')
            : 'No beneficiary groups specified';

        const storyText = selectedStory
            ? `**Selected Story:**
Title: ${selectedStory.title}
Description: ${selectedStory.description || 'No description provided'}
Location: ${selectedStory.location_name || 'Not specified'}
Date: ${selectedStory.date_represented}`
            : '**Selected Story:** None selected - create a report focused on metrics and impact data without a specific story narrative.';

        const userPrompt = `Create a detailed initiative impact report using the following inputs.

**Initiative:** ${initiativeTitle}
**Date Range:** ${dateRangeText}

${storyText}

**Metrics Summary (Totals):**
${totalsText}

**Individual Metrics:**
${metricsText}

**Locations Involved:**
${locationsText}

**Beneficiary Groups:**
${beneficiaryGroupsText}

${deepLink ? `**Deep Link:** ${deepLink}` : ''}

Please structure the report with the following sections. Use EXACT section headers as shown:

1. **## Overview Summary** - A single paragraph (4-5 sentences) highlighting key achievements and impact
2. **## Total Metrics with Descriptions** - Present the totals in a clear, narrative format explaining what each metric means (2-3 paragraphs). This section will appear right after the date range.
3. **## Beneficiary Breakdown** - Explain who was served and how (1-2 paragraphs)
4. **## Visual Metrics Description** - ONE SENTENCE describing what the bar chart shows (e.g., "The bar chart below illustrates the total values for each metric tracked during this reporting period.")
5. **## Location Information** - ONE SENTENCE describing the geographic reach (e.g., "The map below shows the geographic distribution of impact across [X] locations.")
6. **## Map Section Text** - ONE SENTENCE describing the geographic distribution (e.g., "Impact was delivered across [X] locations, with activities concentrated in [region/area].")
7. **## Evidence and More Information**${deepLink ? ` - ONE SENTENCE: For evidence and more info, apply these filters at this link: ${deepLink}` : ' - ONE SENTENCE: Additional evidence and detailed information is available in the system'}
8. **## Footer** - End with: "Nexus Impacts | Know Your Mark On The World"

IMPORTANT: 
${selectedStory ? '- DO NOT include a Story Section - the actual story will be inserted separately' : '- Since no story was selected, focus the report on metrics, impact data, and achievements without a narrative story section'}
- Use EXACTLY the section headers shown above (e.g., "## Visual Metrics Description", "## Location Information")
- Sections 4, 5, 6, and 7 must be EXACTLY ONE SENTENCE each
- The Overview Summary must be exactly ONE paragraph (4-5 sentences)
- Make the report professional, engaging, and data-driven
- Use specific numbers throughout`;

        // Call OpenAI
        console.log('Calling OpenAI API...');
        console.log('Request data:', {
            initiativeId,
            initiativeTitle,
            dateRange,
            totalsCount: totals?.length || 0,
            metricsCount: rawMetrics?.length || 0,
            locationsCount: locations?.length || 0,
            beneficiaryGroupsCount: beneficiaryGroups?.length || 0,
            selectedStory: selectedStory?.title
        });

        const completion = await openai!.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const reportText = completion.choices[0]?.message?.content || 'Failed to generate report';

        console.log('OpenAI API success, report length:', reportText.length);
        res.json({ reportText });
    } catch (error: any) {
        console.error('OpenAI API error:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
            code: error?.code,
            type: error?.type
        });

        // Handle specific OpenAI errors
        if (error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota') {
            res.status(402).json({ 
                error: 'OpenAI Quota Exceeded', 
                message: 'Your OpenAI API quota has been exceeded. Please check your OpenAI account billing and add credits.',
                code: 'insufficient_quota'
            });
            return;
        }

        if (error?.status === 429) {
            res.status(429).json({ 
                error: 'Rate Limit Exceeded', 
                message: 'OpenAI API rate limit exceeded. Please try again in a moment.',
                code: 'rate_limit'
            });
            return;
        }

        res.status(500).json({ 
            error: 'Failed to generate report', 
            message: error instanceof Error ? error.message : 'Unknown error',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
        });
    }
});

export default router;

