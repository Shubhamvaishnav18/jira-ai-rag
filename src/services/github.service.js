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

async function createPullRequest(repoOwner, repoName, branchName, filesToUpdate, prTitle, prBody) {
    console.log(`🚀 Creating PR for ${branchName}...`);
    
    try {
        const { data: refData } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
            owner: repoOwner,
            repo: repoName,
            ref: "heads/main"
        });
        const baseSha = refData.object.sha;

        await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
            owner: repoOwner,
            repo: repoName,
            ref: `refs/heads/${branchName}`,
            sha: baseSha
        });

        const tree = filesToUpdate.map(file => ({
            path: file.path,
            mode: "100644", 
            type: "blob",
            content: file.new_content
        }));

        const { data: treeData } = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
            owner: repoOwner,
            repo: repoName,
            base_tree: baseSha,
            tree: tree
        });

        const { data: commitData } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
            owner: repoOwner,
            repo: repoName,
            message: prTitle,
            tree: treeData.sha,
            parents: [baseSha]
        });

        await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
            owner: repoOwner,
            repo: repoName,
            ref: `heads/${branchName}`,
            sha: commitData.sha
        });

        const { data: prData } = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
            owner: repoOwner,
            repo: repoName,
            title: prTitle,
            head: branchName,
            base: "main",
            body: prBody
        });

        return prData.html_url; 
        
    } catch (error) {
        console.error("❌ GitHub API Error:", error.message);
        throw error;
    }
}

module.exports = { getRepoTree, getFileContent, createPullRequest };