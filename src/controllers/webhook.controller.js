const githubService = require('../services/github.service');
const jiraService = require('../services/jira.service');
const aiService = require('../services/ai.service');
const config = require('../config');

async function handleJiraWebhook(req, res) {
    res.status(200).send('Webhook Received');

    try {
        const issue = req.body.issue;
        if (!issue) return;

        const ticketId = issue.key; 
        const title = issue.fields.summary;
        const description = issue.fields.description || 'No description';
        
        const projectKey = ticketId.split('-')[0]; 
        const targetRepo = config.REPO_MAP[projectKey]; 

        if (!targetRepo) return;

        const issueType = issue.fields.issuetype.name.toLowerCase();
        const prefix = (issueType === 'bug') ? 'fix' : 'feat';
        const ticketNumber = ticketId.split('-')[1]; 
        const requiredBranchName = `${prefix}/jira-${ticketNumber}`; 

        console.log(`\n🔔 Processing Ticket: [${ticketId}] -> Repo: [${targetRepo}]`);

        const codeContext = await aiService.searchVectorDB(title, description, targetRepo);
        console.log("🛠️ Generating Action Plan...");
        const finalCommentText = await aiService.generateActionPlan(title, description, requiredBranchName, codeContext);
        await jiraService.postCommentToJira(ticketId, finalCommentText);

    } catch (error) {
        console.error("❌ Controller Error:", error);
    }
}

module.exports = { handleJiraWebhook };