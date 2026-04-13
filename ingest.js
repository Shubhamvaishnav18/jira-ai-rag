require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const githubService = require('./src/services/github.service');
const config = require('./src/config');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2-preview" });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);

async function pushDataToPinecone() {
    console.log("🚀 Starting Code Ingestion to Pinecone Vector DB...\n");

    const projectKey = Object.keys(config.REPO_MAP)[0]; 
    const targetRepo = config.REPO_MAP[projectKey];

    console.log(`📂 Fetching files for repo: [${targetRepo}]`);
    const allFiles = await githubService.getRepoTree(targetRepo);
    
    const filesToIngest = allFiles.slice(0, 3); 

    for (const filePath of filesToIngest) {
        try {
            console.log(`\n⏳ Processing: ${filePath}...`);
            const codeContent = await githubService.getFileContent(targetRepo, filePath);
            
            if (!codeContent) {
                console.log(`⏩ Skipping empty file: ${filePath}`);
                continue;
            }

            const textToEmbed = `File: ${filePath}\nCode:\n${codeContext}`;
            const result = await embeddingModel.embedContent(textToEmbed);
            const vectors = result.embedding.values;

            await index.upsert([{
                id: `${targetRepo}-${filePath.replace(/\//g, '-')}`,
                values: vectors,
                metadata: { 
                    repo: targetRepo, 
                    filePath: filePath, 
                    codeContent: codeContent.substring(0, 30000) 
                }
            }]);

            console.log(`✅ Uploaded to Pinecone: ${filePath}`);
            
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`❌ Failed to process ${filePath}:`, error.message);
        }
    }

    console.log("\n🎉 Ingestion Complete! Vector DB is now populated.");
}

pushDataToPinecone();