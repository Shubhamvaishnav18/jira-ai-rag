const express = require('express');
const config = require('./src/config');
const webhookController = require('./src/controllers/webhook.controller');

const app = express();
app.use(express.json());

app.post('/webhook/jira', webhookController.handleJiraWebhook);

app.listen(config.PORT, () => {
    console.log(`Server is running on http://localhost:${config.PORT}`);
});