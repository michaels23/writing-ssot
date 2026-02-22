const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

/**
 * CONFIGURATION
 * Update FB_JSON_PATH to point to the file from your Facebook export.
 */
const CONFIG = {
    fbJsonPath: './posts/your_posts_1.json', 
    outputDir: './content/social/facebook',
};

function parseFacebookJson() {
    // 1. Ensure output directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    console.log(`📖 Reading Facebook export from ${CONFIG.fbJsonPath}...`);

    try {
        const rawData = fs.readFileSync(CONFIG.fbJsonPath, 'utf8');
        const posts = JSON.parse(rawData);

        let count = 0;

        posts.forEach((entry, index) => {
            // Facebook JSON structure stores the text in data[0].post
            const postText = entry.data?.[0]?.post || entry.title || "";
            const timestamp = entry.timestamp;
            
            // Skip entries that have no text (like just changing a profile picture)
            if (!postText || postText.trim() === "") return;

            const dateObj = new Date(timestamp * 1000);
            const isoDate = dateObj.toISOString();
            const datePrefix = isoDate.split('T')[0];
            
            // Create a unique slug using the date and index
            const fileName = `${datePrefix}-fb-post-${index}.md`;

            // 2. Prepare Metadata (Frontmatter)
            const frontmatter = {
                date: isoDate,
                platform: 'facebook',
                type: 'social_post',
                fb_timestamp: timestamp
            };

            // 3. Construct File Body
            const fileBody = matter.stringify(postText, frontmatter);

            // 4. Write to SSoT
            fs.writeFileSync(path.join(CONFIG.outputDir, fileName), fileBody);
            count++;
        });

        console.log(`\n✅ Successfully converted ${count} Facebook posts to Markdown.`);
        console.log(`📂 Location: ${CONFIG.outputDir}`);

    } catch (err) {
        console.error('❌ Error parsing JSON:', err.message);
        console.log('Ensure you unzipped the Facebook export and pointed to the correct JSON file.');
    }
}

parseFacebookJson();