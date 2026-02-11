/* ============================================
   AD REVIEW TOOL - BACKEND SERVER
   Simple Express server to handle Claude API calls
   ============================================ */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Password Protection Middleware
// Set AUTH_PASSWORD environment variable in Railway
const authMiddleware = (req, res, next) => {
    // Skip auth in local development if no password is set
    if (!process.env.AUTH_PASSWORD) {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Ad Review Tool"');
        return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const username = auth[0];
    const password = auth[1];

    if (username === 'agency' && password === process.env.AUTH_PASSWORD) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Ad Review Tool"');
        return res.status(401).send('Invalid credentials');
    }
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large image uploads
app.use(authMiddleware); // Apply password protection to all routes
app.use(express.static('public')); // Serve static files from 'public' folder

/* ============================================
   API ENDPOINT - Review Ad
   This endpoint receives the image and text,
   calls Claude API, and returns the results
   ============================================ */
app.post('/api/review', async (req, res) => {
    try {
        const { apiKey, imageBase64, imageType, adCopy, brand, adFormat } = req.body;

        // Validate inputs
        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image is required' });
        }

        // Brand context
        const brandName = brand === 'marine-concepts' ? 'Marine Concepts' : 'Coastline Boat Lift Covers';
        const brandContext = brand === 'marine-concepts'
            ? 'Marine Concepts is an established marine brand focused on premium boat lift covers and marine accessories.'
            : 'Coastline Boat Lift Covers is an established marine brand specializing in high-quality boat lift covers.';

        // Format-specific guidance
        const formatGuidance = {
            'organic-social': 'This is organic social content (Instagram/Facebook feed). Focus on authentic engagement, storytelling, and community building. The goal is to build brand affinity and lifestyle association, not direct conversion.',
            'paid-social': 'This is paid social advertising (Facebook/Instagram ads). Optimize for stopping the scroll, clear value proposition, and strong CTA. Consider the 3-second rule - hook must land immediately.',
            'stories-reels': 'This is vertical short-form video (Stories/Reels). Fast-paced, attention-grabbing, mobile-first. First frame must hook instantly. Text overlays and captions critical for sound-off viewing.',
            'ppc': 'This is PPC search advertising (Google/Bing). The viewer is already searching with intent. Focus on relevance to search query, clear differentiation, and removing friction to click.',
            'display': 'This is display advertising (banner/native ads). Fight banner blindness with bold visuals and clear messaging. Limited space means hierarchy is critical.',
            'email': 'This is email marketing. Viewer has opted in - respect their inbox. Clear subject line relevance, scannable content, single clear CTA. Mobile optimization essential.',
            'website': 'This is website content (landing page/hero section). You have more space and time. Build the story, address objections, use social proof. Guide the visitor through a journey.',
            'offline': 'This is offline marketing (print/trade show/direct mail). No click tracking - messaging must be memorable. QR codes or memorable URLs for tracking. Tangibility is an advantage - use it.',
            'video': 'This is video advertising (YouTube/pre-roll). First 5 seconds are non-skippable gold - use them wisely. Tell a story, demonstrate value, make viewers want to keep watching.'
        };

        const formatContext = formatGuidance[adFormat] || formatGuidance['paid-social'];

        // Prepare the enhanced prompt for Claude
        const prompt = `You are an elite creative director and performance marketer with 20 years of experience building aftermarket enthusiast brands across marine, automotive, motorcycle, dirt bike, ATV, off-road/trucking, fishing, hunting, and outdoor lifestyle categories. You understand what makes enthusiast communities tick — the tribal identity, the gear obsession, the lifestyle aspiration — and you know how to translate that into ads that convert.

BRAND CONTEXT: You're analyzing an ad for ${brandName}. ${brandContext} This brand operates in the premium boating enthusiast space, competing alongside brands like YETI, Salt Life, AFTCO, Stanley, Fox Racing, and Truck Hero.

AD FORMAT: ${formatContext}

YOUR MISSION: Analyze this ad creative and provide brutally honest, specific, actionable feedback. Not scores alone - concrete changes with reasoning. Reference best-in-class brands to show what great looks like.

${adCopy ? 'AD COPY PROVIDED:\n' + adCopy + '\n\n' : ''}Analyze this ad image${adCopy ? ' and the ad copy above' : ''}.

CRITICAL INSTRUCTION: Every piece of feedback must be SPECIFIC and ACTIONABLE. Don't say "headline could be stronger" - give them the exact rewritten headline and explain why it works by referencing what YETI, Fox Racing, Rigid Industries, Salt Life, or other top enthusiast brands do. Provide actual rewrites, not just suggestions.

Provide a comprehensive analysis in the following JSON format (respond ONLY with valid JSON, no other text):

{
  "headline_effectiveness": {
    "score": <1-10>,
    "analysis": "<What's working or not working? Be specific - don't say 'weak hook', say exactly WHY it's weak. Does it speak to identity or just product? Does it stop the scroll? Compare to how YETI, Fox Racing, or Salt Life approach headlines.>",
    "suggested_headlines": [
      "<REWRITTEN headline option 1 - ready to use, not just advice. Example: 'Protect What You've Earned' not 'focus on value'>",
      "<REWRITTEN headline option 2 - different angle, complete and usable>",
      "<REWRITTEN headline option 3 - third distinct approach, ready to implement>"
    ],
    "rationale": "<Why these specific headlines work better. Reference exact examples: 'YETI doesn't say Buy Our Cooler - they say Built for the Wild because X. Salt Life makes every headline an identity declaration. Your headline should do the same by...'>"
  },
  "value_proposition_clarity": {
    "score": <1-10>,
    "analysis": "<What value is communicated? Is it about the product specs or the customer's life improvement? Can someone understand the value in 3 seconds? Be specific about what's missing.>",
    "suggested_value_props": [
      "<COMPLETE value proposition statement 1 - specific and usable>",
      "<COMPLETE value proposition statement 2 - alternative angle>"
    ],
    "benchmark": "<Reference SPECIFIC examples: 'YETI's Wildly Stronger Keeps Ice Longer speaks to extreme performance. Rigid Industries' Built to Destroy proves durability through destruction tests. Your value prop should...' Show them exactly what great looks like.>"
  },
  "body_copy": {
    "score": <1-10>,
    "analysis": "<Evaluate current copy with specifics. Does it make the customer the hero or the product the hero? Does it pass the 'campfire test' - would a boater tell this story to another boater? Does it sound authentic or corporate?>",
    "suggested_body_copy": "<COMPLETE rewritten body copy, ready to use. 2-4 sentences max. Make it sound like it came from an enthusiast, not a marketing department. Show, don't tell.>",
    "rationale": "<Why this copy works better. Example: 'Fox Racing never says our gear is good - they show pros winning in it. AFTCO explains technical features that matter to serious fishermen. This rewrite works because...>' Be specific about the psychology and strategy.>"
  },
  "cta_strength": {
    "score": <1-10>,
    "analysis": "<Current CTA evaluation. Does it speak to identity or transaction? 'Shop Now' vs 'Outfit Your Boat' - which one makes someone feel like a boater? Be specific about why it works or fails.>",
    "suggested_ctas": [
      "<EXACT CTA text option 1 - ready to implement>",
      "<EXACT CTA text option 2 - different approach>",
      "<EXACT CTA text option 3 - third angle>"
    ],
    "placement_advice": "<Specific design instruction. Not 'make it prominent' but 'move it above the fold, increase button size to 60px height, use contrasting color. Reference: Fox Racing places CTAs like X, YETI positions them like Y.'>"
  },
  "target_audience_alignment": {
    "score": <1-10>,
    "audience": "<Be specific: contractors, homeowners, serious boaters, weekend warriors, first-time boat buyers, or mixed?>",
    "analysis": "<Does the creative speak the language of this audience? Would they see themselves in it? Is the imagery authentic to their experience or stock-photo generic? Reference: Salt Life speaks to coastal lifestyle identity. AFTCO speaks to tournament fishermen. Who is this speaking to and how well?>",
    "suggestions": "<SPECIFIC changes to better target the audience. Not 'make it more relatable' but 'replace the staged product shot with a real customer using it at the dock in saltwater conditions. Show wear and tear - enthusiasts respect authenticity over perfection. YETI does this by...'>"
  },
  "visual_hierarchy": {
    "score": <1-10>,
    "analysis": "<What does the eye see first, second, third? Is that the right order? Does the visual feel authentic (real conditions, real people) or generic (stock photo, studio shot)? Does it match premium positioning? Be brutally specific about what's not working.>",
    "specific_improvements": [
      "<EXACT design fix 1: 'Increase headline font size from 24pt to 48pt, move it to upper third of frame, use high-contrast white text on dark background like Fox Racing does in their hero shots'>",
      "<EXACT design fix 2: 'Replace product-only shot with lifestyle context - show the cover ON a boat at a dock with water/sky visible. Rigid Industries never shows a light bar on white background - it's always mounted on a vehicle in real conditions'>",
      "<EXACT design fix 3: 'Add a human element - hand adjusting the cover, person in background. YETI always includes people USING the product, not just the product itself'>"
    ],
    "inspiration": "<SPECIFIC brand examples: 'Fox Racing uses high-contrast black/orange/white. Salty Crew uses bold typography over lifestyle imagery. Rigid Industries shows product durability through real-world punishment. For this ad, specifically steal X technique from Y brand because...'>"
  },
  "brand_positioning": {
    "score": <1-10>,
    "analysis": "<Does this ad make someone want to put the brand's sticker on their truck/boat? That's the test. Is it building a tribal identity or just selling a product? Would someone be PROUD to be associated with this brand based on this ad? Compare to how YETI, Salt Life, Fox Racing create belonging.>",
    "suggestions": "<SPECIFIC positioning changes. Example: 'Shift from product-benefit messaging (keeps your boat dry) to identity-lifestyle messaging (Built for Serious Boaters). YETI doesn't say our coolers work well - they say Built for the Wild. Stanley doesn't say durable - they show 100 years of heritage. The positioning shift needed here is...'>"
  },
  "lead_generation_potential": {
    "score": <1-10>,
    "analysis": "<Will this generate leads or just impressions? Is there a clear path to action? Does it overcome the main objection (price, trust, urgency)? Is there social proof? Be specific about conversion barriers.>",
    "conversion_improvements": [
      "<SPECIFIC tactic 1: 'Add customer photo gallery - 6 real customer boats with covers. K&N Filters increased conversions 34% by showing customer install photos. Enthusiasts trust other enthusiasts more than brand claims.'>",
      "<SPECIFIC tactic 2: 'Add lifetime warranty badge prominently in bottom right. Baja Designs' lifetime warranty is their #1 trust builder. Makes price objection disappear.'>",
      "<SPECIFIC tactic 3: 'Change offer from generic Shop Now to Free Fit Guide + Quote. Removes friction by helping them figure out which product fits their boat before committing. RTIC does this with their cooler size selector.'>"
    ]
  },
  "overall_impression": {
    "score": <1-10>,
    "summary": "<Overall assessment: Would YOU stop scrolling for this? Would you show this to a buddy at the marina? Does it make someone proud to be part of this brand community? Be direct and honest. Compare to best-in-class.>",
    "priority_fixes": [
      "<#1 HIGHEST IMPACT FIX - Lead with this. If the hook is broken, nothing else matters. Be EXACT: 'Replace the headline X with Y because Z. YETI does this by...' Give them the specific change and the brand example.>",
      "<#2 SECOND PRIORITY - What's the next biggest lever? Specific fix with reasoning and brand reference.>",
      "<#3 THIRD PRIORITY - Third most impactful change. Exact action with brand example.>"
    ]
  },
  "industry_benchmarks": {
    "similar_successful_ads": "<Describe SPECIFIC successful ads from YETI, Salt Life, Fox Racing, Rigid Industries, AFTCO, Salty Crew, Huk Gear, Hoonigan, or other enthusiast brands. Not vague references - actual campaigns or creative approaches. Example: 'YETI's Built for the Wild campaign shows...' or 'Rigid Industries' destruction test videos where they shoot their lights with rifles...' Give them concrete examples they can study.>",
    "key_takeaways": "<What makes those specific examples effective? Break down the psychology and strategy. Example: 'YETI makes the customer the hero, not the product. Fox Racing never shows gear alone - always on athletes performing. Rigid proves durability through destruction. The key takeaway for this ad is...' Be a teacher, not just a critic.>"
  }
}

REMEMBER: You are an elite creative director with 20 years in aftermarket enthusiast brands. Be direct, specific, and constructive. Every critique must include:
1. The EXACT fix (not just 'improve X' but 'change X to Y')
2. A brand reference showing what great looks like
3. The reasoning/psychology behind why it works

Think like an enthusiast, not a corporate marketer. Would this ad make someone proud to be part of the brand community? That's the ultimate test.`;

        // Call Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 6000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageType,
                                data: imageBase64
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        let resultText = data.content[0].text;

        // Strip markdown code fences if present (```json or ```)
        resultText = resultText.trim();
        if (resultText.startsWith('```')) {
            // Remove opening fence (```json or ```)
            resultText = resultText.replace(/^```(?:json)?\n?/, '');
            // Remove closing fence (```)
            resultText = resultText.replace(/\n?```$/, '');
            resultText = resultText.trim();
        }

        // Parse JSON response
        const review = JSON.parse(resultText);

        // Return the review
        res.json({ success: true, review });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🚤 Ad Creative Review Tool - Server Running!             ║
║                                                            ║
║  Open your browser and go to:                             ║
║  http://localhost:${PORT}                                      ║
║                                                            ║
║  Press Ctrl+C to stop the server                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});
