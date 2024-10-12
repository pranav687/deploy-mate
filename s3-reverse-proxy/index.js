const express = require('express')
const httpProxy = require('http-proxy')
require('dotenv').config({ path: '.env' });

const app = express()

const PORT = process.env.PORT
const BASE_PATH = process.env.BASE_PATH

const proxy = httpProxy.createProxy()

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0]

    const resolvesTo = `${BASE_PATH}/${subdomain}/`
    proxy.web(req, res, { target: resolvesTo, changeOrigin: true })

})
proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'

})
app.listen(PORT, () => console.log(`Reverse Proxy running on ${PORT}`))