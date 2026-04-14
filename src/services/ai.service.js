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
        Your task is to act like a human. 
        1. If the requirement is unclear or you need more info, ask a doubt.
        2. If the requirement is clear, write the EXACT modified code for the files.

        You MUST respond ONLY in valid JSON format matching this structure perfectly. Do not include any markdown formatting like \`\`\`json or regular text outside the JSON:
        {
            "action": "doubt" | "code",
            "message_or_doubt": "Write your doubt here, or a brief description of what you fixed",
            "branch_name": "feat/jira-123",
            "files_to_update": [
                {
                    "path": "src/components/Header.js",
                    "new_content": "// The complete modified code here"
                }
            ]
        }
    `;

    const userMessage = `Jira Ticket: ${title}\nDescription: ${description}\nRetrieved Codebase Context: ${codeContext}`;

    try {
        const response = await anthropic.messages.create({
            model: "anthropic/claude-opus-4.5", 
            max_tokens: 4000,
            temperature: 0.2, 
            system: systemPrompt,
            messages: [
                { role: "user", content: userMessage }
            ]
        });

        const responseText = response.content[0].text;
        const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(cleanJsonString);

    } catch (error) {
        console.error("❌ Claude AI API Error:", error.message);
        throw error;
    }
}

module.exports = { searchVectorDB, generateActionPlan, analyzeTicketAndCode };