// =================================================================================
// Server-Side Code for Real-Time AI Voice Bot (Echo Test)
// =================================================================================
// This script sets up a web server to handle real-time voice communication.
// This version acts as an "Echo Bot" to test the two-way audio stream.

// ---------------------------------------------------------------------------------
// 1. Initialization and Configuration
// ---------------------------------------------------------------------------------

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------------
// 2. TwiML Endpoint for Twilio Call Handling
// ---------------------------------------------------------------------------------

app.post('/twiml', (req, res) => {
  console.log("Received TwiML request from Twilio.");
  const host = req.get('host');
  const websocketUrl = `wss://${host}`;

  const twiml = `
    <Response>
      <Connect>
        <Stream url="${websocketUrl}" />
      </Connect>
      <Say>Sorry, the service is not available at the moment. Please try again later.</Say>
    </Response>
  `;

  res.type('text/xml');
  res.send(twiml);
  console.log("Sent TwiML response to Twilio.");
});

// ---------------------------------------------------------------------------------
// 3. WebSocket Server for Real-Time Communication (Echo Logic)
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('A new WebSocket connection has been established.');
  let streamSid; // This will store the unique ID for this call's audio stream

  ws.on('message', (message) => {
    const msg = JSON.parse(message);

    switch (msg.event) {
      case 'start':
        // The 'start' event gives us the streamSid, which we need to send audio back
        streamSid = msg.start.streamSid;
        console.log(`Twilio has started the media stream with SID: ${streamSid}`);
        break;

      case 'media':
        // The 'media' event contains the audio from the caller.
        // We will send it right back to create an echo.
        if (streamSid) {
          const echoMessage = {
            event: "media",
            streamSid: streamSid,
            media: {
              // We use the exact same audio payload we just received
              payload: msg.media.payload,
            },
          };
          // Send the audio back to Twilio through the WebSocket
          ws.send(JSON.stringify(echoMessage));
        }
        break;

      case 'stop':
        // The 'stop' event is sent when the call ends.
        console.log('Twilio has stopped the media stream.');
        streamSid = null; // Clear the streamSid
        break;
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection has been closed.');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// ---------------------------------------------------------------------------------
// 4. Start the Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log("AI Echo Bot is running.");
});
