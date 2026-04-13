require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    JIRA_EMAIL: process.env.JIRA_EMAIL,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
    JIRA_DOMAIN: process.env.JIRA_DOMAIN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_OWNER: process.env.GITHUB_OWNER,
    GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
    REPO_MAP: {
        'KAN': 'Tern-Frontend',
        'API': 'my-backend-node',   
        'MOB': 'foodly-react-native' 
    }
};