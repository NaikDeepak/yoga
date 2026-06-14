const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const match = envContent.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
if (!match) {
  console.error("No API key found in .env");
  process.exit(1);
}
const apiKey = match[1].trim();

async function run() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    console.log("Status:", res.status);
    const data = await res.json();
    if (data.models) {
      console.log("Models:");
      data.models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
    } else {
      console.log("No models returned:", data);
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
