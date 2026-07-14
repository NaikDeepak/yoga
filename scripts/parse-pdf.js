#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load .env file manually if GEMINI_API_KEY not in process.env
if (!process.env.GEMINI_API_KEY) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)$/);
      if (match) {
        process.env.GEMINI_API_KEY = match[1].trim().replace(/^['"]|['"]$/g, '');
        break;
      }
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

// Get arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node scripts/parse-pdf.js <path-to-pdf> [output-json-path]');
  process.exit(1);
}

const pdfPath = path.resolve(args[0]);
if (!fs.existsSync(pdfPath)) {
  console.error(`Error: File not found at ${pdfPath}`);
  process.exit(1);
}

const outputPath = args[1] ? path.resolve(args[1]) : path.join(path.dirname(pdfPath), `${path.basename(pdfPath, '.pdf')}-exercises.json`);

console.log(`Reading PDF from: ${pdfPath}`);
const pdfData = fs.readFileSync(pdfPath);
const base64Data = pdfData.toString('base64');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `You are a clinical and medical translator specializing in physical rehabilitation, orthopedics, and yoga therapy.
Your task is to analyze the provided PDF of a conditioning program and extract all exercises.

For each exercise, extract the following details:
1. English Name: The official name in the PDF.
2. Marathi Name: A natural Marathi translation of the name. Keep the English name in parentheses after the Marathi name, e.g., 'मान फिरवणे (Head Rolls)' or 'फळी पोझ (Plank)'.
3. Category: The main body part targeted. Choose exactly one of: 'neck', 'back', 'core', 'lower_body'.
4. English Description: The target muscles worked or the general description of the stretch.
5. Marathi Description: An accurate Marathi translation of the description.
6. English Repetitions: The set/reps guidelines (e.g. '3 sets of 3' or '10 repetitions').
7. Marathi Repetitions: The translation of sets/reps in Marathi (e.g. '३ चे ३ संच' or '१० वेळा').
8. English Days Per Week: The frequency (e.g. 'Daily' or '3 days per week').
9. Marathi Days Per Week: The translation of the frequency (e.g. 'दररोज' or 'आठवड्यातून ३ दिवस').
10. English Steps: An array of step-by-step directions for the exercise.
11. Marathi Steps: An array of step-by-step directions translated accurately to Marathi.
12. English Tip: The tips/safety warnings provided.
13. Marathi Tip: The translation of the tips/safety warnings.

Ensure the Marathi translations are professional, natural, grammatically correct, and use appropriate Marathi medical/yoga terminology.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: "English name of the exercise (e.g., 'Head Rolls')" },
          nameMr: { type: 'STRING', description: "Marathi name of the exercise (e.g., 'मान फिरवणे (Head Rolls)')" },
          category: { type: 'STRING', description: "Body category, choose exactly one from: 'neck', 'back', 'core', 'lower_body'" },
          description: { type: 'STRING', description: "Brief description of main muscles worked or stretch feelings in English" },
          descriptionMr: { type: 'STRING', description: "Brief description of main muscles worked or stretch feelings in Marathi" },
          repetitions: { type: 'STRING', description: "Repetitions and sets in English (e.g., '3 sets of 3')" },
          repetitionsMr: { type: 'STRING', description: "Repetitions and sets in Marathi (e.g., '३ चे ३ संच')" },
          daysPerWeek: { type: 'STRING', description: "Frequency per week in English (e.g., 'Daily')" },
          daysPerWeekMr: { type: 'STRING', description: "Frequency per week in Marathi (e.g., 'दररोज')" },
          steps: { 
            type: 'ARRAY', 
            items: { type: 'STRING' },
            description: "Step-by-step directions in English" 
          },
          stepsMr: { 
            type: 'ARRAY', 
            items: { type: 'STRING' },
            description: "Step-by-step directions in Marathi" 
          },
          tip: { type: 'STRING', description: "Tip or safety instruction in English. Put empty string if none." },
          tipMr: { type: 'STRING', description: "Tip or safety instruction in Marathi. Put empty string if none." }
        },
        required: ["name", "nameMr", "category", "repetitions", "repetitionsMr", "daysPerWeek", "daysPerWeekMr", "steps", "stepsMr"]
      }
    }
  },
  required: ["exercises"]
};

async function run() {
  console.log('Sending request to Gemini API...');
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data
                }
              },
              {
                text: 'Extract all the exercises from this PDF. Translate descriptions, repetitions, steps, and tips to Marathi. Make sure the output strictly follows the schema.'
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Gemini API Error (HTTP ${res.status}):`, errText);
      process.exit(1);
    }

    const json = await res.json();
    const resultText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      console.error('Error: Empty response from Gemini API.');
      process.exit(1);
    }

    // Pretty-print and save
    const parsedData = JSON.parse(resultText);
    fs.writeFileSync(outputPath, JSON.stringify(parsedData, null, 2), 'utf-8');
    console.log(`\nSuccess! Extracted ${parsedData.exercises.length} exercises.`);
    console.log(`Structured JSON saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error during execution:', error);
    process.exit(1);
  }
}

run();
