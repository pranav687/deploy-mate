const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
const Redis = require('ioredis')
require('dotenv').config({ path: '.env' });

const publisher = new Redis(process.env.REDIS_SERVICE_URL)

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ca-central-1',  // Ensure the region is in quotes
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

console.log(process.env.AWS_SECRET_ACCESS_KEY)
const PROJECT_ID = process.env.PROJECT_ID

function publishedLog(log) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }))
}

async function init() {
    console.log('Executing script.js');
    publishedLog('Build Started')
    const outDirPath = path.join(__dirname, 'output');
    const distFolderPath = path.join(outDirPath, 'dist');

    // Create directories if they don't exist
    if (!fs.existsSync(outDirPath)) {
        fs.mkdirSync(outDirPath);
    }

    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    p.stdout.on('data', function (data) {
        console.log(data.toString());
        publishedLog(data.toString());
    });

    p.stderr.on('data', function (data) {
        console.error('Error', data.toString());
        publishedLog(`Error : ${data.toString()}`)

    });

    p.on('close', async function (code) {
        if (code !== 0) {
            console.error(`Build process exited with code ${code}`);
            return;
        }
        console.log('Build Complete');
        publishedLog(`Build Complete `);


        if (!fs.existsSync(distFolderPath)) {
            console.error(`Dist folder does not exist: ${distFolderPath}`);
            return;
        }

        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });
        publishedLog(`Starting to upload `);

        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file);
            if (fs.lstatSync(filePath).isDirectory()) continue;

            console.log('uploading', filePath);
            publishedLog(`uploading : ${file} `);

            const command = new PutObjectCommand({
                Bucket: 'deploy-mate-outputs',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            });

            await s3Client.send(command);
            console.log('uploaded', filePath);
            publishedLog(`uploaded.. `);

        }
        console.log('Done...');
        publishedLog(`done... `);

    });
}


init()