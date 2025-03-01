import requests
import json

def call_generate_keys_function():
    openAiKey = input("Enter your OpenAI API key: ")

    # check if it looks like an OpenAI key. It should have the format "sk-..."
    if not openAiKey.startswith("sk-"):
        print("This doesn't look like an OpenAI key. Please check and try again.")
        return

    n_keys = int(input("Enter the number of keys you want to generate: "))

    # The URL to your Firebase Cloud Function endpoint
    url = "https://us-central1-notopenai-31af6.cloudfunctions.net/generateKeys"
    
    # Payload matching the function's expected JSON structure
    payload = {
        "openAiKey": openAiKey,
        "numKeys": n_keys,
        "maxRequestsWithoutReset": 3,
        "maxTotalTokens": 1500000,
        "maxTokensPerRequest": 500,
        "resetTimeSecs": 2,
        "model": "gp-3.5-turbo"  # or "gpt-3.5-turbo" if that's what you intend
    }
    
    # Set the headers to indicate JSON content
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        # Make the POST request
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        
        # Raise an exception if the request was not successful (4xx or 5xx)
        response.raise_for_status()
        
        # If successful, parse the JSON response
        data = response.json()
        print("Response from generateKeys function:")
        print(json.dumps(data, indent=2))

        # Create a csv file with the keys. Append to the file if it already exists.
        with open(f"keys/{openAiKey}.csv", "a") as f:
            for key in data["keys"]:
                f.write(f"{key}\n")
        print("Keys written to student_keys.csv")

    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    call_generate_keys_function()