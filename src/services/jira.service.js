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

module.exports = { postCommentToJira };