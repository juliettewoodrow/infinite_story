import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAi from "openai";

// Make sure you have initialized Firebase Admin in your codebase
// e.g., admin.initializeApp();


// Provide some fallback defaults (if your document is missing these fields)
const DEFAULTS = {
  maxTokensPerRequest: 500,
  resetTimeSecs: 2,
  maxRequestsWithoutReset: 3,
  maxTotalTokens: 1500000,
  model: "gpt-3.5-turbo"
};

export const notopenai = functions.https.onRequest(async (req, res): Promise<void> => {
  // Ensure the request is a POST and contains a JSON body
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  if (!req.is("application/json")) {
    res.status(400).send("Bad Request: Content-Type must be application/json");
    return;
  }

  try {
    // Extract parameters from the request body
    const { messages, api_key, response_format, course_id } = req.body;

    // Basic validation
    if (!api_key || !course_id) {
      res.status(400).send("Bad Request: 'api_key' and 'course_id' are required");
      return;
    }
    if (!messages || !Array.isArray(messages)) {
      res.status(400).send("Bad Request: 'messages' field must be an array");
      return;
    }

    // Firestore paths
    const apiKeyDocPath = `/apiKeys/${api_key}`;
    const logPath = `/apiKeys/${api_key}/logs/${Date.now()}`;

    const apiKeyRef = admin.firestore().doc(apiKeyDocPath);
    const logRef = admin.firestore().doc(logPath);

    // Fetch the API key document
    const apiKeySnap = await apiKeyRef.get();
    if (!apiKeySnap.exists) {
      // If the document does not exist, the provided api_key is invalid
      res.status(401).send("Unauthorized: Invalid api_key");
      return;
    }

    // Destructure document fields (with default fallbacks)
    const {
      openAiKey,
      maxRequestsWithoutReset = DEFAULTS.maxRequestsWithoutReset,
      maxTotalTokens = DEFAULTS.maxTotalTokens,
      maxTokensPerRequest = DEFAULTS.maxTokensPerRequest,
      resetTimeSecs = DEFAULTS.resetTimeSecs,
      model = DEFAULTS.model,
      rate = 0,
      lastRequest = 0,
      totalTokens = 0
    } = apiKeySnap.data() || {};

    // If no actual OpenAI key is in the doc, user is unauthorized
    if (!openAiKey) {
      res.status(401).send("Unauthorized: Missing 'openAiKey' in document");
      return;
    }

    // Calculate time since last request
    const timeSinceLastRequestMs = Date.now() - lastRequest;
    const timeSinceLastRequestSec = timeSinceLastRequestMs / 1000;

    // Determine new rate (reset if enough time has passed)
    const withinResetTime = timeSinceLastRequestSec < resetTimeSecs;
    const newRate = withinResetTime ? rate + 1 : 1;

    // Check request count within reset window
    if (newRate > maxRequestsWithoutReset) {
      res.status(429).send(`Too many requests. Wait ${resetTimeSecs} seconds before trying again.`);
      return;
    }

    // Check total tokens used so far
    if (totalTokens > maxTotalTokens) {
      res.status(429).send("Too many tokens used. Please contact course staff.");
      return;
    }

    // Initialize OpenAI client with the key from Firestore
    const openai = new OpenAi({ apiKey: openAiKey });

    // Make the chat completion request
    const completion = await openai.chat.completions.create({
      messages,
      model,
      max_tokens: maxTokensPerRequest,
      // Some libraries call it "response_format". 
      // If your library does not actually support "response_format", 
      // remove or adjust this property. 
      response_format: response_format 
    });

    // Extract the text content from the response
    const choice = completion.choices?.[0];
    const content = choice?.message?.content || "";
    const usedTokens = completion.usage?.total_tokens || 0;

    // Send the content back to the user
    res.send(content);

    // Update the document with new rate limit data
    const updateData = {
      totalTokens: totalTokens + usedTokens,
      rate: newRate,
      lastRequest: Date.now()
    };
    await apiKeyRef.set(updateData, { merge: true });

    // Write a log entry
    await logRef.set({
      messages,
      responseFormat: response_format,
      completion,
      content,
      usedTokens,
      timeStamp: Date.now()
    });

    return;
  } catch (error: any) {
    // Log the error and return a 500
    functions.logger.error("Failed to process request:", error);
    const errorMessage = error.message || "Internal Server Error";
    res.status(500).send(errorMessage);
    return;
  }
});