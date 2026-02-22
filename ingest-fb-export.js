const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// --- Configuration ---
const CONFIG = {
    // Point this to where you unzipped the Facebook "posts" folder
    fbExportDir: './fb-export/posts', 
    outputDir: './content/social/facebook',
    assetsDir: './content/assets/facebook',
    // We'll process both pertinent files you identified
    targetFiles: [
        'your_posts__check_ins__photos_and_videos_1.json',
        'posts_on_other_pages_and_profiles.json'
    ]
};

function ensureDirs() {
    [CONFIG.outputDir, CONFIG.assetsDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
}

function processFile(fileName) {
    const filePath = path.join(CONFIG.fbExportDir, fileName);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Skipping ${fileName}: File not found.`);
        return;
    }

    console.log(`📖 Processing ${fileName}...`);
    const rawData = fs.readFileSync(filePath, 'utf8');
    const posts = JSON.parse(rawData);

    posts.forEach((entry, index) => {
        // Facebook's JSON structure for 'post' content
        const postText = entry.data?.[0]?.post || "";
        const timestamp = entry.timestamp;
        const title = entry.title || ""; // Often contains "Mike Steigerwald updated his status"

        // Skip empty entries
        if (!postText && !entry.attachments) return;

        const dateObj = new Date(timestamp * 1000);
        const datePrefix = dateObj.toISOString().split('T')[0];
        const uniqueId = `${datePrefix}-${index}`;

        // Handle Media/Attachments
        let mediaMarkdown = "";
        if (entry.attachments) {
            entry.attachments.forEach(attachment => {
                attachment.data.forEach(item => {
                    if (item.media && item.media.uri) {
                        // Extract just the filename from FB's complex URI
                        const originalUri = item.media.uri;
                        const mediaFilename = path.basename(originalUri);
                        const localAssetPath = path.join(CONFIG.assetsDir, mediaFilename);
                        
                        // Copy the physical file if it exists in your unzipped export
                        const sourcePath = path.join(CONFIG.fbExportDir, '..', originalUri);
                        if (fs.existsSync(sourcePath)) {
                            fs.copyFileSync(sourcePath, localAssetPath);
                            mediaMarkdown += `![Facebook Media](../../../assets/facebook/${mediaFilename})\n\n`;
                        }
                    }
                });
            });
        }

        // Prepare the Markdown content
        const fullContent = `${mediaMarkdown}${postText}`;
        const frontmatter = {
            title: title || `Facebook Post ${datePrefix}`,
            date: dateObj.toISOString(),
            platform: 'facebook',
            source_file: fileName
        };

        const fileBody = matter.stringify(fullContent, frontmatter);
        fs.writeFileSync(path.join(CONFIG.outputDir, `${uniqueId}.md`), fileBody);
    });
}

function run() {
    ensureDirs();
    CONFIG.targetFiles.forEach(processFile);
    console.log(`\n✅ Ingestion complete. Your Facebook history is now part of the SSoT.`);
}

run();