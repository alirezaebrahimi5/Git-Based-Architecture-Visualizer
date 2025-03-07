multi_query = """You are an AI software engineering assistant. Generate five alternative versions of the user's question to retrieve relevant documents from a vector database. Provide different perspectives, such as algorithmic details, design patterns, architectural implications, data structures, or integration methods. Each alternative should be separated by newlines.
Original question: {input}"""

condense_question_system_template = (
    "Given a chat history and the latest user request related to software engineering, "
    "reformulate it into a standalone, precise technical question. Ensure clarity on algorithms, "
    "design patterns, data structures, or software integration specifics. Do NOT answer the question, "
    "just rephrase or clarify as necessary."
)

planner_prompt_template = """
You are tasked with creating a step-by-step software engineering implementation plan. This plan should break down the requested development task into individual, clearly defined, actionable steps. Each step should explicitly mention:
- Required algorithms or data structures,
- Relevant software design patterns,
- Integration methods or approaches,
- Anticipated architectural considerations.

User Request:
{question}

Relevant Documents and Existing Knowledge:
{documents}

Provide a detailed, actionable plan tailored to software engineering best practices, ensuring no essential steps are omitted.
"""

reflection_prompt_template = """
You are a senior software architect reviewing an implementation plan. Critically evaluate the plan based on the following criteria:
- Are algorithms and data structures correctly and optimally chosen?
- Are design patterns explicitly identified and appropriate?
- Are integration points clear and feasible?
- Does the plan address scalability, maintainability, and other architectural concerns?
- Is any essential step missing or unnecessary information included?

Plan:
{plan}

Provide insightful critiques and suggest improvements or revisions. If necessary, rewrite the plan clearly incorporating these changes.
"""

generation_prompt_template = """
You are an expert software engineering architect.

User Request:
{question}

Implementation Plan Steps:
{plan}

Relevant Knowledge and Documentation:
{documents}

Provide a comprehensive technical response including:
- Detailed code implementation or pseudo-code examples,
- Explanation of algorithms, data structures, and chosen design patterns,
- Architectural considerations and integration strategies,
- Possible challenges and recommended solutions,
- Clarifying questions if further details are necessary.

Ensure the response is precise, technically accurate, and practically actionable. Respond in Persian.
"""

prompts_dictionary = {
    "multi_query": multi_query,
    "condense_question": condense_question_system_template,
    "planning": planner_prompt_template,
    "reflection": reflection_prompt_template,
    "generation": generation_prompt_template
}

# Function to call a prompt by name
def get_prompt(prompt_name):
    """Retrieve and execute a prompt function by name."""
    if prompt_name in prompts_dictionary:
        return prompts_dictionary[prompt_name]
    else:
        return "Prompt not found."
