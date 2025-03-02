import argparse
from transformers import pipeline

def main():
    parser = argparse.ArgumentParser(
        description="Generate a Mermaid diagram definition using an open-source LLM."
    )
    # Using a positional argument for the prompt.
    parser.add_argument("prompt", type=str, help="The prompt to generate the Mermaid diagram.")
    args = parser.parse_args()

    # Initialize a text-generation pipeline with a lightweight open-source model.
    # You can change the model (e.g., "EleutherAI/gpt-neo-125M") to a larger one if resources allow.
    generator = pipeline("text-generation", model="EleutherAI/gpt-neo-125M")

    # Generate text based on the prompt.
    # Adjust max_length, temperature, etc., as needed.
    result = generator(args.prompt, max_length=300, do_sample=True, temperature=0.7)

    # Print only the generated text.
    generated_text = result[0]["generated_text"]

    # Optionally, if you want to remove the prompt from the output,
    # you could do something like:
    if generated_text.startswith(args.prompt):
        generated_text = generated_text[len(args.prompt):].strip()

    print(generated_text)

if __name__ == "__main__":
    main()
