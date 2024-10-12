
const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
require('dotenv').config({ path: '.env' });
// const { Server } = require('socket.io')
// const Redis = require('ioredis')

const app = express()
const PORT_API_SERVER = process.env.PORT_API_SERVER

// io.listen(9002, () => console.log('Socket Server 9002'))
console.log(process.env.AWS_ECS_TASK)
const ecsClient = new ECSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }

})

const config = {
    CLUSTER: process.env.AWS_ECS_CLUSTER,
    TASK: process.env.AWS_ECS_TASK
}

app.use(express.json())

app.post('/project', async (req, res) => {
    const { gitURL } = req.body
    const projectSlug = generateSlug()

    // Spin the container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: [process.env.AWS_SUBNET],
                securityGroups: [process.env.AWS_SG]
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        { name: 'GIT_REPO_URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug }
                    ]
                }
            ]
        }
    })

    await ecsClient.send(command);

    return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000` } })

})


app.listen(PORT_API_SERVER, () => console.log(`API Server Running..${PORT_API_SERVER}`))
