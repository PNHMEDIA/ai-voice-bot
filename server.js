// =================================================================================
// Server-Side Code for Real-Time AI Voice Bot (Welcome Message)
// =================================================================================
// This version uses ElevenLabs to stream a welcome message when the call connects.

// ---------------------------------------------------------------------------------
// 1. Initialization and Configuration
// ---------------------------------------------------------------------------------

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const ElevenLabs = require('elevenlabs-node');

const PORT = process.env.PORT || 8080;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Check for ElevenLabs keys
if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  console.error("FATAL ERROR: Missing ElevenLabs API Key or Voice ID. Please check your .env file.");
  process.exit(1);
}

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
    </Response>
  `;

  res.type('text/xml');
  res.send(twiml);
  console.log("Sent TwiML response to Twilio.");
});

// ---------------------------------------------------------------------------------
// 3. WebSocket Server for Real-Time Communication (Welcome Message Logic)
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('A new WebSocket connection has been established.');
  let streamSid;

  ws.on('message', async (message) => {
    const msg = JSON.parse(message);

    switch (msg.event) {
      case 'start':
        streamSid = msg.start.streamSid;
        console.log(`Twilio has started the media stream with SID: ${streamSid}`);
        
        // --- Play a welcome message using ElevenLabs ---
        try {
          console.log("Attempting to stream welcome message from ElevenLabs...");
          const voice = new ElevenLabs({
            apiKey: ELEVENLABS_API_KEY,
            voiceId: ELEVENLABS_VOICE_ID,
          });

          // Generate the audio stream for our welcome message
          const welcomeStream = await voice.textToSpeechStream({
            text: "Hello! How can I help you today?",
            modelId: "eleven_turbo_v2", // A fast, conversational model
          });

          // Pipe the audio from ElevenLabs back to the caller via Twilio
          for await (const chunk of welcomeStream) {
            const audioBase64 = chunk.toString('base64');
            const mediaMessage = {
              event: "media",
              streamSid: streamSid,
              media: {
                payload: audioBase64,
              },
            };
            ws.send(JSON.stringify(mediaMessage));
          }
          console.log("Finished streaming welcome message.");

          // Send a "mark" message to Twilio to indicate we've finished speaking
          const markMessage = {
            event: "mark",
            streamSid: streamSid,
            mark: { name: "welcome_message_finished" },
          };
          ws.send(JSON.stringify(markMessage));

        } catch (err) {
            console.error("Error with ElevenLabs stream:", err);
        }
        break;

      case 'media':
        // We are not processing incoming audio in this version yet.
        break;

      case 'stop':
        console.log('Twilio has stopped the media stream.');
        streamSid = null;
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
  console.log("AI Welcome Bot is running.");
});
