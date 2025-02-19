require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/pdfs', express.static('pdfs')); 
if (!fs.existsSync('pdfs')) {
    fs.mkdirSync('pdfs');
}

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables');
    process.exit(1);
}

const PREPROCESSING_PROMPT = `You are the Preprocessing Agent in a depression case generator system. Your task is to transform raw client input into a structured JSON format.

The raw input includes details such as age, gender, occupation, a list of symptoms, and a key trigger event. You must output a JSON object with two keys:
- "client_profile": containing "age", "gender", and "occupation".
- "presenting_problem": containing "symptoms" (as an array) and "trigger_event".

Ensure that your output is valid JSON and only includes these specified keys. Do not add any extra information.`;

const CASE_GENERATION_PROMPT = `You are the Case Generator Agent in a depression-focused case generator system. Your task is to take the structured JSON (which includes "client_profile" and "presenting_problem") and add enrichment for a depression case.

Please add the following keys to the JSON:
- "cognitive_patterns": with two arrays: "automatic_thoughts" and "core_beliefs".
- "consequences": with two arrays: "emotional" and "behavioral".

Use clinical knowledge about depression to generate realistic values for these arrays. Your output must be valid JSON containing all these keys.`;

const NARRATIVE_PROMPT = `You are the Narrative Agent in a depression case generator system. Your task is to convert the enriched JSON (which includes "client_profile", "presenting_problem", "cognitive_patterns", and "consequences") into a cohesive, first-person narrative.

Your narrative should:
- Introduce the client using details from "client_profile".
- Describe the presenting problem, including symptoms and the trigger event.
- Reflect the client's internal dialogue by summarizing the automatic thoughts and core beliefs.
- Explain the emotional and behavioral consequences.

Output your result as a JSON object with a single key "client_narrative", whose value is the generated narrative text. Ensure that the narrative is engaging, natural, and accurately reflects the provided data.`;

const FINAL_REVIEW_PROMPT = `You are the Final Review Agent in the depression case generator system. Your task is to combine the outputs from the previous agents into one final JSON object that includes the client profile, presenting problem, cognitive patterns, consequences, and the client narrative.

Ensure that your final JSON includes the following keys: "client_profile", "presenting_problem", "cognitive_patterns", "consequences", and "client_narrative". Use the outputs from the previous agents without modifying the core data unless necessary for consistency.`;

const pdfTemplate = (data) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; padding: 20mm; }
        h1 { text-align: center; color: #2c3e50; }
        h2 { color: #2c3e50; margin-top: 20px; }
        .narrative-text { 
            background-color: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #3498db;
            margin: 10px 0;
        }
        ul { padding-left: 20px; }
        li { margin-bottom: 5px; }
    </style>
</head>
<body>
    <h1>Clinical Case Study: Depression Assessment</h1>
    
    <h2>Client Profile</h2>
    <p><strong>Age:</strong> ${data.client_profile.age}</p>
    <p><strong>Gender:</strong> ${data.client_profile.gender}</p>
    <p><strong>Occupation:</strong> ${data.client_profile.occupation}</p>

    <h2>Presenting Problem</h2>
    <h3>Symptoms:</h3>
    <ul>
        ${data.presenting_problem.symptoms.map(symptom => `<li>${symptom}</li>`).join('')}
    </ul>
    <h3>Trigger Event:</h3>
    <p>${data.presenting_problem.trigger_event}</p>

    <h2>Cognitive Patterns</h2>
    <h3>Automatic Thoughts:</h3>
    <ul>
        ${data.cognitive_patterns.automatic_thoughts.map(t => `<li>${t}</li>`).join('')}
    </ul>
    <h3>Core Beliefs:</h3>
    <ul>
        ${data.cognitive_patterns.core_beliefs.map(b => `<li>${b}</li>`).join('')}
    </ul>

    <h2>Consequences</h2>
    <h3>Emotional Consequences:</h3>
    <ul>
        ${data.consequences.emotional.map(e => `<li>${e}</li>`).join('')}
    </ul>
    <h3>Behavioral Consequences:</h3>
    <ul>
        ${data.consequences.behavioral.map(b => `<li>${b}</li>`).join('')}
    </ul>

    <h2>Client Narrative</h2>
    <div class="narrative-text">
        ${data.client_narrative}
    </div>

    <h2>Summary</h2>
                            <p>${data.summary || `${data.client_profile.gender === 'Male' ? 'A' : 'A'} ${data.client_profile.age}-year-old ${data.client_profile.gender.toLowerCase()} ${data.client_profile.occupation} presents with depression following ${data.presenting_problem.trigger_event.toLowerCase()}. The client exhibits ${data.presenting_problem.symptoms.slice(0, -1).join(', ')}, and ${data.presenting_problem.symptoms.slice(-1)}, with cognitive patterns revealing ${data.cognitive_patterns.automatic_thoughts[0].toLowerCase()}. Therapeutic intervention would focus on addressing these negative thought patterns while developing coping strategies for the identified emotional and behavioral consequences.`}</p>
</body>
</html>`;

async function generatePDF(data) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
        await page.setContent(pdfTemplate(data));
    
        const timestamp = Date.now();
    const filename = `case_study_${timestamp}.pdf`;
    const filepath = path.join('pdfs', filename);
    
        await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
        }
    });
    
    await browser.close();
    return { filename, filepath };
}

async function getCompletion(prompt, input) {
    try {
        const response = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 1000,
            temperature: 0.7,
            system: prompt + "\nIMPORTANT: Respond ONLY with a valid JSON object. No additional text, explanations, or formatting.",
            messages: [
                {
                    role: "user",
                    content: JSON.stringify(input)
                }
            ]
        });

        let content = response.content[0].text.trim();
        
                content = content.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
                        .replace(/\\n/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();

                const jsonMatch = content.match(/^\{.*\}$/s);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('Failed to parse matched JSON:', jsonMatch[0]);
                throw parseError;
            }
        }

                console.error('Invalid response format. Content:', content);
        throw new Error('Response is not a valid JSON object');
    } catch (error) {
        console.error('Anthropic API Error:', error);
        if (error.message.includes('JSON')) {
            throw new Error('Invalid JSON response from AI. Please try again.');
        }
        throw new Error('Failed to process the request');
    }
}

function validateInput(req, res, next) {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid request body' });
    }
    next();
}

app.post('/api/preprocess', validateInput, async (req, res) => {
    try {
        const result = await getCompletion(PREPROCESSING_PROMPT, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-case', validateInput, async (req, res) => {
    try {
        const result = await getCompletion(CASE_GENERATION_PROMPT, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-narrative', validateInput, async (req, res) => {
    try {
        const result = await getCompletion(NARRATIVE_PROMPT, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/finalize-case', validateInput, async (req, res) => {
    try {
        const result = await getCompletion(FINAL_REVIEW_PROMPT, req.body);
        
                const { filename } = await generatePDF(result);
        
                const pdfUrl = `${req.protocol}://${req.get('host')}/pdfs/${filename}`;
        res.json({
            ...result,
            pdfUrl
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/save-pdf', async (req, res) => {
    try {
        const { pdfBase64 } = req.body;
        const timestamp = Date.now();
        const filename = `case_study_${timestamp}.pdf`;
        const filepath = path.join('pdfs', filename);

                const pdfBuffer = Buffer.from(pdfBase64.split(',')[1], 'base64');
        fs.writeFileSync(filepath, pdfBuffer);

                const shareUrl = `${req.protocol}://${req.get('host')}/pdfs/${filename}`;
        
        res.json({
            success: true,
            filename,
            shareUrl
        });
    } catch (error) {
        console.error('Error saving PDF:', error);
        res.status(500).json({ error: 'Failed to save PDF' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 