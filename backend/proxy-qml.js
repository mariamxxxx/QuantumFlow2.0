/**
 * proxy-qml.js
 * Node/Express proxy for QML Python worker
 * Run: `node proxy-qml.js` (ensure dependencies installed)
 * npm packages: express, node-fetch, dotenv, body-parser
 */

const express = require('express')
const fetch = require('node-fetch')
const dotenv = require('dotenv')
const bodyParser = require('body-parser')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
const PY_QML_URL = process.env.PY_QML_URL || 'http://localhost:5001'
// Allow configuring ALLOWED_ORIGIN via .env. For local development default to
// allowing any origin (helps when frontend runs on a different port).
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

app.use(bodyParser.json({ limit: '1mb' }))

// Simple CORS for allowed origin from .env
app.use((req, res, next) => {
  // If ALLOWED_ORIGIN is '*', allow any origin (useful for local dev).
  const origin = req.headers.origin
  if (ALLOWED_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*')
  } else {
    // Only echo the configured origin to avoid open CORS in other envs
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/', (req, res) => res.json({ status: 'ok' }))

async function forward(req, res, path) {
  try {
    const url = `${PY_QML_URL}${path}`
    console.log(`proxy: forwarding ${req.method} ${req.path} -> ${url}`)
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })

    const text = await r.text()
    // try parse JSON
    try {
      const json = JSON.parse(text)
      if (!r.ok) return res.status(502).json({ error: json.error || 'worker error', details: json })
      return res.status(200).json(json)
    } catch (e) {
      // non-json
      if (!r.ok) return res.status(502).send(text)
      return res.send(text)
    }
  } catch (err) {
    console.error('proxy error:', err)
    return res.status(502).json({ error: 'Python worker unreachable', details: err.message })
  }
}

app.post('/api/generate-dataset', async (req, res) => {
  return forward(req, res, '/generate-dataset')
})

app.post('/api/qkernel', async (req, res) => {
  return forward(req, res, '/qkernel')
})

app.post('/api/classical-kernel', async (req, res) => {
  return forward(req, res, '/classical-kernel')
})

const server = app.listen(PORT, () => {
  console.log(`proxy-qml listening on port ${PORT}, forwarding to ${PY_QML_URL}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the process using it or set a different PORT in backend/.env.`)
  } else {
    console.error('Server error:', err)
  }
  process.exit(1)
})

/*
package.json hint:
{
  "name": "qml-proxy",
  "version": "1.0.0",
  "main": "proxy-qml.js",
  "scripts": { "start": "node proxy-qml.js" },
  "dependencies": {
    "express": "^4.18.0",
    "node-fetch": "^2.6.7",
    "dotenv": "^16.0.0",
    "body-parser": "^1.20.0"
  }
}
*/
