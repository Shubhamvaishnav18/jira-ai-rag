const { Octokit } = require('octokit');
const config = require('../config');

const octokit = new Octokit({ auth: config.GITHUB_TOKEN });
const { GITHUB_OWNER, GITHUB_BRANCH } = config;

async function getRepoTree(targetRepo) {
    try {
        const { data: refData } = await octokit.rest.git.getRef({
            owner: GITHUB_OWNER,
            repo: targetRepo, 
            ref: `heads/${GITHUB_BRANCH}`,
        });
        const commitSha = refData.object.sha;

        const { data: treeData } = await octokit.rest.git.getTree({
            owner: GITHUB_OWNER,
            repo: targetRepo,
            tree_sha: commitSha,
            recursive: 'true',
        });

        return treeData.tree
            .filter(item => item.type === 'blob' && !item.path.includes('node_modules') && !item.path.includes('build'))
            .map(item => item.path);
    } catch (error) {
        console.error(`❌ GitHub Tree Error for ${targetRepo}:`, error.message);
        return [];
    }
}

async function getFileContent(targetRepo, filePath) {
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: GITHUB_OWNER,
            repo: targetRepo,
            path: filePath,
            ref: GITHUB_BRANCH,
        });
        return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
        console.error(`❌ Failed to fetch ${filePath}:`, error.message);
        return null;
    }
}

module.exports = { getRepoTree, getFileContent };