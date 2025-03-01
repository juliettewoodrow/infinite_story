import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const defaultValues = {
  numKeys: 1,
  maxRequestsWithoutReset: 3,
  maxTotalTokens: 1500000,
  maxTokensPerRequest: 500,
  resetTimeSecs: 2,
  model: "gpt-3.5-turbo"
};

export const generateKeys = functions.https.onRequest(async (req, res): Promise<void> => {
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
    // Extract data from the request body
    const {
      openAiKey,
      numKeys,
      maxRequestsWithoutReset,
      maxTotalTokens,
      maxTokensPerRequest,
      model,
      resetTimeSecs
    } = req.body;

    // Basic validation
    if (!openAiKey) {
      res.status(400).send("Bad Request: 'openAiKey' is required");
      return;
    }

    // Apply defaults if values are not provided
    const realNumKeys = numKeys ?? defaultValues.numKeys;
    const realMaxRequestsWithoutReset = maxRequestsWithoutReset ?? defaultValues.maxRequestsWithoutReset;
    const realMaxTotalTokens = maxTotalTokens ?? defaultValues.maxTotalTokens;
    const realMaxTokensPerRequest = maxTokensPerRequest ?? defaultValues.maxTokensPerRequest;
    const realResetTimeSecs = resetTimeSecs ?? defaultValues.resetTimeSecs;
    const realModel = model ?? defaultValues.model;

    // Reference to the sub-collection for this openAiKey
    const apiKeyCollectionRef = admin.firestore().collection("apiKeys")

    // Create numKeys documents
    const createdKeys: string[] = [];
    for (let i = 0; i < realNumKeys; i++) {
      const newDocRef = await apiKeyCollectionRef.add({
        openAiKey,
        maxRequestsWithoutReset: realMaxRequestsWithoutReset,
        maxTotalTokens: realMaxTotalTokens,
        maxTokensPerRequest: realMaxTokensPerRequest,
        resetTimeSecs: realResetTimeSecs,
        model: realModel,
      });
      createdKeys.push(newDocRef.id);
    }

    // save all the keys to a doc
    const openAiKeyDocRef = admin.firestore().doc(`openAiKey/${openAiKey}`)

    // add each key to the doc (which might not yet exist, or might already have keys)
    await openAiKeyDocRef.set({
      keys: admin.firestore.FieldValue.arrayUnion(...createdKeys)
    }, { merge: true });

    // Return the newly created keys (document IDs) to the client
    res.status(200).json({
      success: true,
      message: `Created ${realNumKeys} new key(s).`,
      keys: createdKeys
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || "Internal Server Error"
    });
  }
});