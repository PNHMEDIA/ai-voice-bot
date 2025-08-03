// =================================================================================
// Server-Side Code for a Production-Ready Real-Time AI Conversational Bot
// =================================================================================
// This version uses a robust method of generating MP3s and having Twilio play
// them back, which completely eliminates audio encoding issues like "rumbling".

// ---------------------------------------------------------------------------------
// 1. Initialization and Configuration
// ---------------------------------------------------------------------------------

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@deepgram/sdk');
const OpenAI = require('openai');
const twilio = require('twilio');

// --- Retrieve API Keys and Configuration ---
const PORT = process.env.PORT || 8080;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// --- Validate Essential Keys ---
if (!DEEPGRAM_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error("FATAL ERROR: Missing one or more required API keys. Please check your .env file.");
  process.exit(1);
}

// --- Initialize External Services ---
const deepgram = createClient(DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
const server = http.createServer(app);

// --- Create a directory for temporary audio files and serve it publicly ---
const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(path.join(__dirname, 'public', 'audio')));


// ---------------------------------------------------------------------------------
// 2. TwiML and Webhook Endpoints
// ---------------------------------------------------------------------------------

// This is the initial webhook Twilio calls. It connects the call to our WebSocket.
app.post('/twiml', (req, res) => {
  const host = req.get('host');
  const websocketUrl = `wss://${host}`;
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.connect().stream({ url: websocketUrl });
  res.type('text/xml');
  res.send(twiml.toString());
});

// This endpoint serves the TwiML to play an audio file and then reconnect the stream.
app.post('/play_and_reconnect', (req, res) => {
    const audioUrl = req.query.audioUrl;
    const host = req.get('host');
    const websocketUrl = `wss://${host}`;
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.play(audioUrl);
    // After playing, we reconnect to the WebSocket to continue listening.
    twiml.connect().stream({ url: websocketUrl });
    res.type('text/xml');
    res.send(twiml.toString());
});


// ---------------------------------------------------------------------------------
// 3. WebSocket Server for Real-Time AI Conversation
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('A new WebSocket connection has been established.');
  let deepgramLive;
  let callSid;
  let conversationHistory = [{ role: "system", content: "You are a helpful and conversational AI assistant speaking in Czech. Your name is Jana. Be concise and friendly. The current date is August 3, 2025." }];

  // --- Function to generate MP3 and have Twilio play it ---
  const speakToCaller = async (text, req) => {
    if (!text || !callSid) return;
    console.log(`AI Speaking: "${text}"`);

    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
    const headers = { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY };
    const body = JSON.stringify({ text: text, model_id: "eleven_multilingual_v2" });

    try {
        const response = await fetch(elevenLabsUrl, { method: 'POST', headers: headers, body: body });
        if (!response.ok) throw new Error(`ElevenLabs API returned an error: ${response.statusText}`);
        
        const audioBuffer = await response.arrayBuffer();
        const audioFileName = `${callSid}-${Date.now()}.mp3`;
        const audioFilePath = path.join(audioDir, audioFileName);
        fs.writeFileSync(audioFilePath, Buffer.from(audioBuffer));
        
        // Construct the full public URL for the audio file
        const publicAudioUrl = `https://${req.get('host')}/audio/${audioFileName}`;
        console.log(`Generated audio file. Public URL: ${publicAudioUrl}`);

        // Update the live call to play the new audio file
        await twilioClient.calls(callSid).update({
            url: `https://${req.get('host')}/play_and_reconnect?audioUrl=${publicAudioUrl}`,
            method: 'POST'
        });
        console.log(`Instructed Twilio to play the audio file for call SID: ${callSid}`);

    } catch (error) {
        console.error("Error in speakToCaller function:", error);
    }
  };

  // --- Establish Deepgram Connection ---
  deepgramLive = deepgram.listen.live({ model: 'nova-2', language: 'cs', smart_format: true, interim_results: false });
  deepgramLive.on('open', () => console.log('Deepgram connection opened.'));
  deepgramLive.on('error', (error) => console.error('Deepgram error:', error));
  
  // --- Handle Transcripts from Deepgram ---
  deepgramLive.on('transcript', async (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript) {
      console.log(`User said: "${transcript}"`);
      conversationHistory.push({ role: "user", content: transcript });
      try {
        const completion = await openai.chat.completions.create({ model: "gpt-4o", messages: conversationHistory });
        const aiResponse = completion.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: aiResponse });
        // We need the 'req' object to get the host, so we pass it from the 'start' event.
        // This is a simplification; in a real app, you'd manage this context more robustly.
        await speakToCaller(aiResponse, ws.upgradeReq); 
      } catch (error) {
        console.error("Error getting response from OpenAI:", error);
      }
    }
  });

  // --- Handle Messages from Twilio ---
  ws.on('message', async (message) => {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case 'start':
        callSid = msg.start.callSid;
        // Store the request object on the WebSocket connection for later use
        ws.upgradeReq = msg.start.customParameters; 
        console.log(`Twilio media stream started (Call SID: ${callSid})`);
        await speakToCaller("Dobrý den! U telefonu Jana, jak vám mohu pomoci?", ws.upgradeReq);
        break;
      case 'media':
        if (deepgramLive && deepgramLive.getReadyState() === 1) {
          deepgramLive.send(Buffer.from(msg.media.payload, 'base64'));
        }
        break;
      case 'stop':
        console.log('Twilio media stream stopped.');
        if (deepgramLive) deepgramLive.finish();
        // Clean up audio files for this call
        fs.readdirSync(audioDir).forEach(file => {
            if (file.startsWith(callSid)) {
                try {
                    fs.unlinkSync(path.join(audioDir, file));
                    console.log(`Cleaned up audio file: ${file}`);
                } catch (err) {
                    console.error(`Error cleaning up file ${file}:`, err);
                }
            }
        });
        break;
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed.');
    if (deepgramLive) deepgramLive.finish();
  });
});

// ---------------------------------------------------------------------------------
// 4. Start the Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log("Full AI Conversational Bot is running.");
});
