const axios = require('axios');
const TurndownService = require('turndown');
const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');

// --- Configuration for MikeSteigerwald.com ---
const CONFIG = {
    wpBaseUrl: 'https://mikesteigerwald.com/wp-json/wp/v2',
    outputDir: './content/published',
    assetsDir: './content/assets'
};

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

/**
 * Downloads images from WordPress to local assets to ensure SSoT portability.
 */
async function downloadImage(url) {
    try {
        const urlObj = new URL(url);
        const filename = path.basename(urlObj.pathname);
        const localPath = path.join(CONFIG.assetsDir, filename);

        // Idempotency check: don't redownload if we have it
        if (fs.existsSync(localPath)) {
            return `../assets/${filename}`;
        }

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(localPath);
            response.data.pipe(writer);
            writer.on('finish', () => resolve(`../assets/${filename}`));
            writer.on('error', reject);
        });
    } catch (err) {
        // If image download fails, we fall back to the remote URL 
        // to avoid breaking the markdown file entirely.
        return url; 
    }
}

async function startMigration() {
    // Ensure the directory structure exists
    if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    if (!fs.existsSync(CONFIG.assetsDir)) fs.mkdirSync(CONFIG.assetsDir, { recursive: true });

    console.log(`\n📡 Connecting to ${CONFIG.wpBaseUrl}...`);

    let page = 1;
    let totalPosts = 0;
    let keepFetching = true;

    while (keepFetching) {
        try {
            const response = await axios.get(`${CONFIG.wpBaseUrl}/posts`, {
                params: { page, per_page: 10, status: 'publish' }
            });

            const posts = response.data;
            if (posts.length === 0) break;

            for (const post of posts) {
                console.log(`📥 Ingesting: "${post.title.rendered}"`);
                
                let htmlContent = post.content.rendered;

                // Extract and download images referenced in the post
                const imgRegex = /<img[^>]+src="([^">]+)"/g;
                let match;
                while ((match = imgRegex.exec(post.content.rendered)) !== null) {
                    const remoteUrl = match[1];
                    const localPath = await downloadImage(remoteUrl);
                    htmlContent = htmlContent.split(remoteUrl).join(localPath);
                }

                const markdown = turndownService.turndown(htmlContent);
                
                // Construct the SSoT file with metadata
                const fileData = matter.stringify(markdown, {
                    title: post.title.rendered,
                    date: post.date,
                    slug: post.slug,
                    wp_id: post.id,
                    status: 'published',
                    original_link: post.link
                });

                const fileName = `${post.date.split('T')[0]}-${post.slug}.md`;
                fs.writeFileSync(path.join(CONFIG.outputDir, fileName), fileData);
                totalPosts++;
            }
            
            console.log(`--- Page ${page} complete ---`);
            page++;
        } catch (error) {
            // WordPress returns a 400 when you request a page beyond the total count
            keepFetching = false; 
        }
    }
    
    console.log(`\n🎉 Success! ${totalPosts} posts from mikesteigerwald.com migrated to SSoT.`);
}

startMigration();