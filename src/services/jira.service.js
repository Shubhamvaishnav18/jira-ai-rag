const axios = require('axios');
const config = require('../config');

async function postCommentToJira(ticketId, comment) {
    const url = `https://${config.JIRA_DOMAIN}/rest/api/2/issue/${ticketId}/comment`;
    const token = Buffer.from(`${config.JIRA_EMAIL}:${config.JIRA_API_TOKEN}`).toString('base64');
    
    try {
        await axios.post(url, 
            { body: comment }, 
            { headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' }}
        );
        console.log(`✅ AI Action Plan posted to Jira Ticket -> ${ticketId}`);
    } catch (error) {
        console.error("❌ Jira Comment failed:", error.response?.data || error.message);
    }
}

async function transitionIssue(issueKey, transitionId) {
    const domain = process.env.JIRA_URL;
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN;

    const auth = Buffer.from(`${email}:${token}`).toString('base64');

    const response = await fetch(`${domain}/rest/api/2/issue/${issueKey}/transitions`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            transition: {
                id: transitionId
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to transition Jira ticket: ${response.status} - ${errorText}`);
    }

    return true;
}

module.exports = { postCommentToJira, transitionIssue };