const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('../config');

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2-preview" });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);

async function getEmbedding(text) {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

async function searchVectorDB(title, description, repoName) {
    console.log(`🔍 Searching Pinecone for ${repoName}...`);

    try {
        const queryText = `Ticket: ${title}. Description: ${description}`;
        const queryVector = await getEmbedding(queryText);

        const searchResults = await index.query({
            vector: queryVector,
            topK: 1,
            includeMetadata: true,
            filter: { repo: repoName }
        });

        let codeContext = "";
        searchResults.matches.forEach(match => {
            codeContext += `\n\n--- File: ${match.metadata.filePath} ---\n${match.metadata.codeContent}`;
        });

        return codeContext || "No files found in Pinecone.";

    } catch (error) {
        if (error.status === 429) {
            console.log("⚠️ Google API Limit Hit! Using Mock Vector DB Data for testing.");
            return `
--- File: src/mock-file.js ---
// This is a mocked code context because Google API Free Tier is exhausted right now.
function mockFunction() { console.log("System is working perfectly!"); }
            `;
        }
        throw error;
    }
}

async function generateActionPlan(title, description, branchName, codeContext) {
    console.log("🛠️ Generating Action Plan...");

    const prompt = `
        Context: You are a Senior Developer.
        Jira Ticket: ${title} (${description})
        Branch: ${branchName}
        Relevant Code: ${codeContext}

        Provide a concise Action Plan with "Files to Modify" and a "Logic Hint".
    `;

    try {
        const response = await model.generateContent(prompt);
        return response.response.text();
    } catch (error) {
        if (error.status === 429) {
            console.log("⚠️ Google API Limit Hit! Generating Mock Action Plan for Jira.");
            return `
*🚀 Branch Details:*
Create and work on this branch: \`${branchName}\`

*📂 Files to Modify:*
(Mocked files - API Limit Exceeded)

*💡 Logic Hint:*
[SYSTEM TEST SUCCESSFUL] 🎉 
            `;
        }
        throw error;
    }
}

async function analyzeTicketAndCode(title, description, codeContext) {
    console.log("🧠 Claude AI is analyzing the ticket and codebase...");

    const systemPrompt = `
        You are an Expert Software Developer. 
        Your task is to act like a human engineer. 
        1. If requirements are unclear, ask a doubt.
        2. If clear, write EXACT modified code.

        IMPORTANT: Your entire response MUST be a single JSON object. 
        Do not include any conversational text before or after the JSON.
        
        Format:
        {
            "action": "doubt" | "code",
            "message_or_doubt": "brief summary",
            "branch_name": "feat/description",
            "files_to_update": [{"path": "string", "new_content": "string"}]
        }
    `;

    const userMessage = `Jira Ticket: ${title}\nDescription: ${description}\nRetrieved Codebase Context: ${codeContext}`;

    try {
        const response = await anthropic.messages.create({
            model: "claude-opus-4-6",
            max_tokens: 4000,
            temperature: 0, 
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }]
        });

        const responseText = response.content[0].text;
        console.log("📝 Raw AI Response Received.");

        try {
            const startIdx = responseText.indexOf('{');
            const endIdx = responseText.lastIndexOf('}');

            if (startIdx === -1 || endIdx === -1) {
                throw new Error("AI response did not contain any JSON object.");
            }

            const jsonString = responseText.substring(startIdx, endIdx + 1);
            return JSON.parse(jsonString);

        } catch (parseError) {
            console.error("❌ JSON Parse Failed. Raw Text:", responseText);
            throw new Error("AI response was not in a valid JSON format.");
        }

    } catch (error) {
        console.error("❌ Claude AI API Error:", error.message);
        throw error;
    }
}

module.exports = { searchVectorDB, generateActionPlan, analyzeTicketAndCode };