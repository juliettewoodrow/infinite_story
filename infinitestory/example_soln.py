import json
from notopenai import NotOpenAI
import os
from graphics import Canvas

# go to cs106a.stanford.edu/notopenai and get your free api key
CLIENT = NotOpenAI(api_key="your_api_key_here")
STORY_NAME = "original_big"
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

def main():
    canvas = Canvas(CANVAS_WIDTH, CANVAS_HEIGHT, "Infinte Story")
    story_data = json.load(open(f'data/{STORY_NAME}.json'))
    curr_scene_key ="start"
    scenes = story_data["scenes"]
    while True:
        if curr_scene_key in scenes:
            scene_data = scenes[curr_scene_key]
        else:
            scene_data = create_new_scene(story_data, curr_scene_key)
            scenes[curr_scene_key] = scene_data
        print_scene(scene_data)
        show_illustration(canvas, curr_scene_key)
        choice = get_valid_choice(scene_data)
        curr_scene_key = choice['scene_key']


def create_new_scene(story_data, scene_key):
    plot = story_data['plot']
    example_room = story_data['scenes']['start']
    print("[Suspenseful music plays as the story continues...]")
    prompt = f"Return the next scene of a story for key {scene_key}. An example scene should be formatted in json like this: {example_room}. The main plot line of the story is {plot}."
    chat_completion = CLIENT.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="gpt-3.5-turbo",
        response_format={"type": "json_object"},
    )
    json_response = chat_completion.choices[0].message.content
    return json.loads(json_response)


def print_scene(scene_data):
    print("")
    print(scene_data['text'])
    if 'choices' in scene_data:
        choices = scene_data['choices']
        for idx, choice in enumerate(choices):
            print(f"{idx+1}. {choice['text']}")


def get_valid_choice(scene_data):
    choices = scene_data['choices']
    choice = input("What do you choose? ")
    while not choice.isdigit() or int(choice) > len(choices):
        choice = input("Please enter a valid choice: ")
    if choice.isdigit():
        choice_index = int(choice) - 1
        selected_choice = choices[choice_index]
        return selected_choice
    

def show_illustration(canvas, scene_key):
    illustration_path = f"img/{scene_key}.jpg"
    if os.path.exists(illustration_path):
        canvas.clear()
        canvas.create_image_with_size(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, illustration_path)
        canvas.create_rectangle(0, CANVAS_HEIGHT - 32, 200, CANVAS_HEIGHT, color="#FFFFFF")
    else:
        canvas.clear()
        canvas.create_rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, "black")
        canvas.create_rectangle(80, 80,
                                CANVAS_WIDTH - 80,
                                CANVAS_HEIGHT - 80,
                                color = "lightblue")
        

if __name__ == "__main__":
    main()