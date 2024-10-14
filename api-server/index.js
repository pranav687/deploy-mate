
const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
require('dotenv').config({ path: '.env' });
const { Server, Socket } = require('socket.io')
const Redis = require('ioredis')



const app = express()
const PORT_API_SERVER = process.env.PORT_API_SERVER
const subscriber = new Redis(process.env.REDIS_SERVICE_URL)
const io = new Server({ cors: '*' })

io.listen(9002, () => console.log('Socket Server 9002'))

io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel);
        socket.emit('message', `joined : ${channel}`)
    })
})
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
    const { gitURL, slug } = req.body
    const projectSlug = slug ? slug : generateSlug()

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

function initReditSubscribe() {
    console.log("Subscribed to logs")
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        console.log(`Pattern: ${pattern}, Channel: ${channel}, Message: ${message}`);
        io.to(channel).emit('message', message);
    });

}
initReditSubscribe()
app.listen(PORT_API_SERVER, () => console.log(`API Server Running..${PORT_API_SERVER}`))
