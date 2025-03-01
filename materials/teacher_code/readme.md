# Teacher Code
-----

This python function is for you to create NotOpenAi keys for your students. 

Step 1:
Go to https://platform.openai.com/api-keys
and create an OpenAI key (which will back all of your student NotOpenAi keys)

Step 2:
Run 
`python generate_student_keys.py`

It uses the python requests package:
`pip install requests`

You can optionally edit generate_student_keys if you would like to change the defaults. You should change the `options` variable
```python
options = {
    # The total number of tokens that can be generated with each API key
    "maxTotalTokens": 1500000,
    "maxTokensPerRequest": 500,
    # You can only make requests at this rate (requests per resetTimeSecs)
    "maxRequestsWithoutReset": 3,
    "resetTimeSecs": 2,
    # This not open ai key can only be used with this model
    "model": "gpt-3.5-turbo" 
}```