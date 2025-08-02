// =================================================================================
// Server-Side Code for Real-Time AI Voice Bot
// =================================================================================
// This script sets up a web server to handle real-time voice communication
// with Twilio, process it with OpenAI for AI responses, and use ElevenLabs
// for text-to-speech conversion.

// ---------------------------------------------------------------------------------
// 1. Initialization and Configuration
// ---------------------------------------------------------------------------------

// Load environment variables from a .env file for secure key management
require('dotenv').config();

// Import necessary libraries
const express = require('express'); // <-- THIS LINE IS NOW FIXED
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Retrieve API keys and configuration from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const PORT = process.env.PORT || 8080;

// Check for missing essential environment variables
if (!OPENAI_API_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  console.error("FATAL ERROR: Missing required environment variables. Please check your .env file.");
  process.exit(1); // Exit if keys are not set
}

// Initialize the Express app and create an HTTP server
const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------------
// 2. TwiML Endpoint for Twilio Call Handling
// ---------------------------------------------------------------------------------
// This endpoint is the first thing Twilio calls when a number is dialed.
// It provides TwiML instructions to connect the call to our WebSocket server.

app.post('/twiml', (req, res) => {
  console.log("Received TwiML request from Twilio.");

  // Dynamically determine the WebSocket URL based on the request host
  const host = req.get('host');
  const websocketUrl = `wss://${host}`;

  // Generate the TwiML response
  const twiml = `
    <Response>
      <Connect>
        <Stream url="${websocketUrl}" />
      </Connect>
      <Say>Sorry, the service is not available at the moment. Please try again later.</Say>
    </Response>
  `;

  // Send the TwiML response
  res.type('text/xml');
  res.send(twiml);
  console.log("Sent TwiML response to Twilio.");
});

// ---------------------------------------------------------------------------------
// 3. WebSocket Server for Real-Time Communication
// ---------------------------------------------------------------------------------
// This server handles the bidirectional audio stream with Twilio.

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('A new WebSocket connection has been established.');

  let elevenLabsStream; // To hold the connection to ElevenLabs
  let openAIStream;     // To hold the connection to OpenAI

  // Handle incoming messages from Twilio's audio stream
  ws.on('message', (message) => {
    const msg = JSON.parse(message);

    switch (msg.event) {
      // The 'start' event is sent by Twilio when the call is connected
      case 'start':
        console.log('Twilio has started the media stream.');
        // Here you would typically set up connections to OpenAI and ElevenLabs
        // For this example, we'll log that the stream has started.
        break;

      // The 'media' event contains the raw audio data from the caller
      case 'media':
        // This is where you would forward the audio data (msg.media.payload)
        // to a real-time speech-to-text service like Deepgram or Google Speech.
        // For this starter kit, we are not implementing a live STT service
        // to keep it simple. The logic would go here.
        break;

      // The 'stop' event is sent when the call ends
      case 'stop':
        console.log('Twilio has stopped the media stream.');
        // Clean up any open connections here.
        break;
    }
  });

  // Handle the closing of the WebSocket connection
  ws.on('close', () => {
    console.log('WebSocket connection has been closed.');
    // Ensure any external API connections (like ElevenLabs) are terminated.
  });

  // Handle WebSocket errors
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// ---------------------------------------------------------------------------------
// 4. Start the Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log("AI Voice Bot is running.");
  console.log(`To connect with Twilio, use the TwiML endpoint: https://<your-server-address>/twiml`);
});
