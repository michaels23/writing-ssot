const { BskyAgent } = require('@atproto/api');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// --- Configuration ---
const CONFIG = {
    handle: 'mikesteigerwald.bsky.social', // Your BlueSky handle
    appPassword: 'zrrh-cdma-64xv-4zjm', // The App Password you generated
    outputDir: './content/social/bluesky',
};

async function ingestBlueSky() {
    const agent = new BskyAgent({ service: 'https://bsky.social' });

    // 1. Authenticate
    console.log(`🔐 Logging into BlueSky as ${CONFIG.handle}...`);
    await agent.login({
        identifier: CONFIG.handle,
        password: CONFIG.appPassword,
    });

    // 2. Ensure directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    console.log('📡 Fetching posts...');
    let cursor;
    let totalPosts = 0;

    // 3. Paginate through all your posts
    do {
        const response = await agent.getAuthorFeed({
            actor: CONFIG.handle,
            cursor: cursor,
            limit: 50,
        });

        const feed = response.data.feed;
        cursor = response.data.cursor;

        for (const item of feed) {
            const post = item.post;
            
            // Only ingest your original posts (skipping pure reposts for a cleaner SSoT)
            if (post.author.handle !== CONFIG.handle) continue;

            const record = post.record;
            const dateObj = new Date(record.createdAt);
            const datePrefix = dateObj.toISOString().split('T')[0];
            const postId = post.uri.split('/').pop();

            // Prepare Frontmatter
            const frontmatter = {
                date: record.createdAt,
                platform: 'bluesky',
                uri: post.uri,
                cid: post.cid,
                reply_count: post.replyCount,
                repost_count: post.repostCount,
                like_count: post.likeCount
            };

            // Handle content and any embedded images (links only for now)
            let content = record.text;
            if (post.embed && post.embed.images) {
                post.embed.images.forEach(img => {
                    content += `\n\n![BlueSky Image](${img.fullsize})\n*Alt: ${img.alt || 'No alt text'}*`;
                });
            }

            const fileBody = matter.stringify(content, frontmatter);
            const fileName = `${datePrefix}-${postId}.md`;
            
            fs.writeFileSync(path.join(CONFIG.outputDir, fileName), fileBody);
            totalPosts++;
        }

    } while (cursor);

    console.log(`\n🎉 Success! ${totalPosts} BlueSky posts ingested to ${CONFIG.outputDir}`);
}

ingestBlueSky().catch(console.error);