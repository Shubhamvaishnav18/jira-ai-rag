const aiService = require('../services/ai.service');
const jiraService = require('../services/jira.service');
const githubService = require('../services/github.service');
const config = require('../config');

async function handleJiraWebhook(req, res) {
    res.status(200).send('Webhook Received');

    const issue = req.body.issue;
    if (!issue) return;

    try {
        const ticketId = issue.key;
        const title = issue.fields.summary;
        const description = issue.fields.description || "No description provided";
        const targetRepo = config.REPO_MAP[ticketId.split('-')[0]];
        
        const assigneeName = issue.fields.assignee ? issue.fields.assignee.displayName : "Unassigned";

        if (assigneeName !== "Shubham") {
            console.log(`Skipping: Ticket [${ticketId}] is assigned to ${assigneeName}, not the AI.`);
            return;
        }

        console.log(`\n🤖 AI AGENT TRIGGERED: [${ticketId}]`);
        console.log("🚀 Starting AUTONOMOUS Flow (Code & PR Generation)...");

        await jiraService.transitionIssue(ticketId, process.env.JIRA_TRANSITION_IN_PROGRESS_ID);
        const codeContext = await aiService.searchVectorDB(title, description, targetRepo);
        
        const aiDecision = await aiService.analyzeTicketAndCode(title, description, codeContext);

        if (aiDecision.action === "doubt") {
            await jiraService.postCommentToJira(ticketId, `🤔 *Question from AI Developer:*\n${aiDecision.message_or_doubt}`);
            console.log(`❓ Doubt posted for [${ticketId}]`);
            return;
        }

        if (aiDecision.action === "code") {
            const prLink = await githubService.createPullRequest(
                process.env.GITHUB_OWNER, 
                targetRepo, 
                aiDecision.branch_name, 
                aiDecision.files_to_update, 
                title, 
                aiDecision.message_or_doubt
            );

            const finalComment = `*✅ Work Completed by AI!*\n*Branch:* \`${aiDecision.branch_name}\`\n*PR Link:* ${prLink}\n\n*Details:* ${aiDecision.message_or_doubt}`;
            await jiraService.postCommentToJira(ticketId, finalComment);
            
            await jiraService.transitionIssue(ticketId, process.env.JIRA_TRANSITION_DEV_COMPLETE_ID);
            
            console.log(`🎉 Autonomous Flow Complete! PR: ${prLink}`);
        }

    } catch (error) {
        console.error("❌ Webhook Processing Failed:", error);
    }
}

module.exports = { handleJiraWebhook };