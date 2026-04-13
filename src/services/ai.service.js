const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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

module.exports = { searchVectorDB, generateActionPlan };