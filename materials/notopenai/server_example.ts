import * as functions from "firebase-functions";
import OpenAi from "openai";
import * as admin from "firebase-admin";


const notopenaiKey = "[insert an openai key here]"
const openai = new OpenAi({
  apiKey: notopenaiKey
});
const maxTokensPerRequest = 500;
const resetTimeSecs = 2
const maxRequestsWithoutReset = 3
const maxTotalTokens = 1500000

export const notopenai = functions.https.onRequest(async (req, res): Promise<void> => {
  // Ensure the request is a POST and contains a JSON body
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return
  }
  if (!req.is("application/json")) {
    res.status(400).send("Bad Request: Content-Type must be application/json");
    return
  }
  try {
    // Extract messages from the request body
    const { messages, api_key, response_format,course_id } = req.body;

    
    const rateLimitPath = '[insert path to rate limit doc]'
    const logPath = '[insert path to log doc]'

    const rateLimitRef = admin.firestore().doc(rateLimitPath)
    const logRef = admin.firestore().doc(logPath)

    // first make sure that the api_key is valid
    
    const rateLimitDoc = (await rateLimitRef.get()).data();
    

    if (!rateLimitDoc) {
      // raise an error
      res.status(401).send("Unauthorized")
      return
    }

    // read the rate limit doc
    const oldRate = rateLimitDoc.rate
    const lastRequest = rateLimitDoc.lastRequest
    let totalTokens = rateLimitDoc.totalTokens
    totalTokens = isNaN(totalTokens) ? 0 : totalTokens;


    const timeSinceLastRequestMs = Date.now() - lastRequest
    const timeSinceLastRequestSec = timeSinceLastRequestMs / 1000

    // if the time since the last request is greater than the reset time, reset the rate
    // else increment the rate
    const withinResetTime = timeSinceLastRequestSec < resetTimeSecs
    const newRate = withinResetTime ? oldRate + 1 : 1

    // check if they are requesting too much 
    if (newRate > maxRequestsWithoutReset) {
      res.status(429).send(`Too many requests. Wait ${resetTimeSecs} seconds before trying again.`)
      return
    }

    // check to make sure they haven't used too many tokens
    if (totalTokens > maxTotalTokens) {
      res.status(429).send("Too many tokens used. Contact the course staff!")
      return
    }

    // Check if messages is provided and is an array
    if (!messages || !Array.isArray(messages)) {
      res.status(400).send("Bad Request: Missing or invalid \"messages\" field");
      return
    }

    const completion = await openai.chat.completions.create({
      messages: messages,
      model: "gpt-3.5-turbo",
      max_tokens: maxTokensPerRequest,
      response_format: response_format,
    });

    // Parse the response and return the content
    const choice = completion.choices[0];
    const content = choice?.message?.content || "";
    const usedTokens = completion.usage?.total_tokens || 0;

    res.send(content);
    
    // update the rate limit doc
    const update = {
      totalTokens: totalTokens + usedTokens,
      rate: newRate,
      lastRequest: Date.now()
    }
    // make a log of what just happened
    rateLimitRef.set(update, { merge: true })
    logRef.set({
      messages, 
      responseFormat: response_format, 
      completion, 
      content, 
      usedTokens, 
      timeStamp: Date.now()
    })

    return
  } catch (error: any) {
    // Log the error to Firebase console
    functions.logger.error("Failed to process request:", error);
    // Send a server error response
    const errorMessage = error.message || "Internal Server Error";
    res.status(500).send(errorMessage);
    return
  }
});