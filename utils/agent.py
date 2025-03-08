import pprint
from langchain_core.output_parsers import StrOutputParser
from langchain_openai.chat_models import ChatOpenAI
from langgraph.graph import END, StateGraph
from typing import Annotated, Sequence, TypedDict, List, Literal
from .prompt_templates import get_prompt
from langchain_core.prompts import ChatPromptTemplate
from langgraph.checkpoint.memory import MemorySaver
from .memory import EpisodicMemory
import weaviate
import re
import os
from langchain.schema import Document
from langchain_core.runnables import RunnableConfig, chain
from .tools import create_search_tool


# Updated GraphState to reflect the new architecture
class GraphState(TypedDict):
    """
    Represents the state of the graph for a multi-agent software architecture design.

    Attributes:
        question: User query
        documents: Retrieved documents from the vectorstore
        reviewed_documents: Insights or summary from the Reviewer
        plan: Step-by-step plan from the Planner
        verified_plan: Plan enhanced with package versions and web searches
        generated_code: Code produced by the Code Generator
        reflection_feedback: Accumulated feedback from the Reflector
        status: Indicates if the code is acceptable or needs revision
    """
    question: str
    documents: List[str]
    reviewed_documents: str
    plan: str
    verified_plan: str
    generated_code: str
    reflection_feedback: List[str]
    status: Literal["revise", "acceptable"]


class SoftwareArchitectureAgent:
    def __init__(self, retriever, llm_model):
        self.retriever = retriever
        self.app = None
        self.memory_config = {"configurable": {"thread_id": "software_engineer"}}
        self.llm_model = llm_model
        self.llm = ChatOpenAI(model_name=self.llm_model, temperature=0, streaming=True)
        self.weaviate_client = weaviate.connect_to_local(host="127.0.0.1", port=8080)
        self.search_tool = create_search_tool("duckduckgo")
        self.memory_database_name = "feedbacks_memory"
        self.memory_manager = EpisodicMemory(self.weaviate_client, self.memory_database_name)
        self.output_response = ""
        self.create_graph()

    def create_graph(self):
        """
        Create and compile the graph workflow with six agents and an iterative loop.
        """
        workflow = StateGraph(GraphState)

        # Define nodes
        workflow.add_node("query_rewriter", self._question_rewriter)
        workflow.add_node("retrieve", self._retrieve)
        workflow.add_node("reviewer", self._reviewer)
        workflow.add_node("planner", self._planner)
        workflow.add_node("searcher", self._searcher)
        workflow.add_node("code_generator", self._code_generator)
        workflow.add_node("reflector", self._reflector)

        # Set entry point
        workflow.set_entry_point("query_rewriter")

        # Define sequential edges
        workflow.add_edge("query_rewriter", "retrieve")
        workflow.add_edge("retrieve", "reviewer")
        workflow.add_edge("reviewer", "planner")
        workflow.add_edge("planner", "searcher")
        workflow.add_edge("searcher", "code_generator")
        workflow.add_edge("code_generator", "reflector")

        # Define conditional edge for reflection loop
        def route_reflection(state: GraphState) -> str:
            return "END" if state["status"] == "acceptable" else "planner"

        workflow.add_conditional_edges(
            "reflector",
            route_reflection,
            {"END": END, "planner": "planner"}
        )

        # Compile with memory checkpointing
        memory = MemorySaver()
        self.app = workflow.compile(checkpointer=memory)

    def _question_rewriter(self, state: GraphState):
        """
        0) Retrieval Agent:
           - Retrieve code and documents from the vectorstore based on the user's question.
        """
        print("---MULTI QUERY REWRITE---")
        question = state["question"]
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", get_prompt("multi_query")),
                (
                    "human",
                    "Here is the initial question: \n\n {question} \n Formulate an improved question.",
                ),
            ]
        )
        question_rewriter = prompt | self.llm | StrOutputParser()
        modified_queries = question_rewriter.invoke({"question": question})
        return {"question": modified_queries}

    def _retrieve(self, state: GraphState) -> dict:
        """
        1) Retrieval Agent:
           - Retrieve code and documents from the vectorstore based on the user's question.
        """
        print("---RETRIEVE---")
        question = state["question"]
        documents = self.retriever.invoke(question)
        return {"documents": documents, "question": question}

    def _reviewer(self, state: GraphState) -> dict:
        """
        2) Reviewer Agent:
           - Review retrieved code/documents to understand logic and structure.
           - Summarize key insights or potential issues.
        """
        print("---REVIEWER---")
        documents = state["documents"]
        # documents_str = "\n---\n".join(documents)
        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("reviewer_prompt")),
            ("human", "Documents:\n{documents}")
        ])
        chain = prompt | self.llm | StrOutputParser()
        reviewed_documents = chain.invoke({"documents": documents})
        return {"reviewed_documents": documents + [reviewed_documents]}

    def _planner(self, state: GraphState) -> dict:
        """
        3) Planner Agent:
           - Transform the query into a step-by-step plan or pseudocode.
           - Consider best practices, required packages, Docker/CI/CD,
             database choices, etc.
           - Incorporate reviewer_output if relevant.
        """
        print("---PLANNER---")
        question = state["question"]
        reviewed_documents = state["reviewed_documents"]
        reflection_feedback = state.get("reflection_feedback", [])
        # feedbacks_memory = ""
        # try:
        #     feedbacks_memory = self.memory_manager.retrieve(question)
        # except Exception as e:
        #     print(e)
        feedback_str = "\n".join(reflection_feedback) if reflection_feedback else ""
        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("planner_prompt")),
            ("human", "User question: {question}\nReviewed documents: {reviewed_documents}\nFeedback: {feedback_str}")
        ])
        chain = prompt | self.llm | StrOutputParser()
        plan = chain.invoke(
            {"question": question, "reviewed_documents": reviewed_documents, "feedback_str": feedback_str})
        return {"plan": plan}

    def _searcher(self, state: GraphState) -> GraphState:
        """
        4) Searcher Agent:
           - Check package versions, library correctness, or relevant
             references from the web or best practices.
           - Possibly refine the plan based on these checks.
        """
        print("---SEARCHER---")
        question = state["question"]
        documents = state["reviewed_documents"]
        plan = state["plan"]

        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("searcher_prompt")),
            (
                "human",
                "User question: {question}\nPlan so far:\n{plan}\n\n"
                "Documents:\n{documents}"
            )
        ])

        # Bind tools to LLM
        llm_with_tools = self.llm.bind_tools([self.search_tool])

        # Create the chain
        llm_chain = prompt | llm_with_tools | StrOutputParser()

        @chain
        def tool_chain(user_input: str, config: RunnableConfig):
            try:
                # Format the input for the prompt
                formatted_input = {
                    "question": user_input,
                    "plan": plan,
                    "documents": documents
                }

                # First LLM call to determine if search is needed
                initial_response = llm_chain.invoke(formatted_input, config=config)

                # Check if the response contains tool calls
                if hasattr(initial_response, 'tool_calls') and initial_response.tool_calls:
                    # Execute tool calls if present
                    tool_results = self.search_tool.batch(initial_response.tool_calls, config=config)

                    # Prepare messages for the second LLM call
                    messages = [
                                   ("human", prompt.format(**formatted_input)),
                                   ("ai", initial_response),
                               ] + [(f"tool_result_{i}", result) for i, result in enumerate(tool_results)]

                    # Second LLM call with tool results
                    final_response = llm_with_tools.invoke(messages, config=config)
                    verified_plan = final_response.content if hasattr(final_response, 'content') else str(
                        final_response)
                else:
                    # If no tool calls, use the initial response
                    verified_plan = initial_response if isinstance(initial_response, str) else str(initial_response)

                return verified_plan

            except Exception as e:
                print(f"Search error: {str(e)}")
                # Fallback to original plan if search fails
                return plan

        try:
            verified_plan = tool_chain.invoke(question)
            verified_plan = verified_plan + plan
        except Exception as e:
            print(f"Tool chain execution failed: {str(e)}")
            verified_plan = plan  # Fallback to original plan

        return {"verified_plan": verified_plan}

    def _code_generator(self, state: GraphState) -> GraphState:
        """
        5) Code Generator Agent:
           - Generate the final code or solution in Persian,
             based on the plan and all previous insights.
        """
        print("---CODE GENERATOR---")
        question = state["question"]
        documents = state["reviewed_documents"]
        verified_plan = state["verified_plan"] if state["verified_plan"] != "" else state["plan"]

        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("code_generator_prompt")),
            (
                "human",
                "User question: {question}\nPlan:\n{plan}\n\n"
                "Documents:\n{documents}"
            )
        ])
        chain = prompt | self.llm | StrOutputParser()
        generated_code = chain.invoke({
            "question": question,
            "plan": verified_plan,
            "documents": documents
        })
        return {"generated_code": generated_code}

    def extract_code_files(self, generated_code: str) -> List[tuple[str, str, str]]:
        """
        Parse generated code to extract multiple code blocks and their associated filenames.

        Args:
            generated_code (str): The generated code string containing potential code blocks.

        Returns:
            List[tuple[str, str, str]]: List of (filename, language, code_content) tuples.
        """
        code_files = []
        # Pattern to match code blocks with optional language specifier
        code_block_pattern = r"```(\w+)?\n(.*?)```"
        matches = list(re.finditer(code_block_pattern, generated_code, re.DOTALL))

        if not matches:
            # No code blocks found, save entire content as text
            return [("generated_output.txt", "txt", generated_code.strip())]

        # Patterns to detect filenames in text before code blocks
        file_name_patterns = [
            r"file:\s*(\S+)",              # e.g., "file: main.py"
            r"code for\s*`?(\S+)`?",      # e.g., "code for main.py" or "code for `main.py`"
            r"`?(\S+)`?:\s*$"             # e.g., "main.py:" or "`main.py`:"
        ]
        compiled_patterns = [re.compile(p, re.IGNORECASE) for p in file_name_patterns]

        prev_end = 0
        counter = 1
        for match in matches:
            start = match.start()
            end = match.end()
            language = match.group(1) if match.group(1) else "txt"
            code_content = match.group(2).strip()

            # Extract text before the code block
            text_before = generated_code[prev_end:start].strip()
            file_name = None
            for pattern in compiled_patterns:
                match_file = pattern.search(text_before)
                if match_file:
                    file_name = match_file.group(1)
                    break

            if file_name:
                # Clean up filename by removing backticks or quotes
                file_name = re.sub(r"[`'\"]", "", file_name)
            else:
                # Generate default filename
                ext = self.get_extension(language)
                file_name = f"generated_code_{counter}.{ext}"
                counter += 1

            # Ensure filename has an extension
            name, ext = os.path.splitext(file_name)
            if not ext:
                ext = self.get_extension(language)
                file_name = f"{file_name}.{ext}"

            code_files.append((file_name, language, code_content))
            prev_end = end

        return code_files

    def get_extension(self, language: str) -> str:
        """
        Map programming language to file extension.

        Args:
            language (str): The language identifier from the code block.

        Returns:
            str: The corresponding file extension.
        """
        lang_to_ext = {
            "python": "py",
            "py": "py",
            "java": "java",
            "javascript": "js",
            "js": "js",
            "c": "c",
            "cpp": "cpp",
            "c++": "cpp",
            "ruby": "rb",
            "go": "go",
            "swift": "swift",
            "dockerfile": "dockerfile",  # Adjusted for common naming
            "txt": "txt"
        }
        return lang_to_ext.get(language.lower(), "txt")

    def _reflector(self, state: GraphState) -> dict:
        """
        Reflector Agent:
        - Evaluates the generated code.
        - Saves all detected files if acceptable.
        - Returns state with status and updated generated_code as a message.
        """
        print("---REFLECTOR---")
        generated_code = state["generated_code"]
        question = state["question"]
        plan = state["plan"]
        verified_plan = state["verified_plan"]
        documents = state["reviewed_documents"]
        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("reflector_prompt")),
            ("human",
             "User question: {question}\nDocuments: {documents}\nPlan: {plan}\nVerified Plan: {verified_plan}\nGenerated code: {generated_code}")
        ])
        chain_instance = prompt | self.llm | StrOutputParser()
        reflection = chain_instance.invoke({
            "plan": plan,
            "verified_plan": verified_plan,
            "question": question,
            "documents": documents,
            "generated_code": generated_code
        })

        if "acceptable" in reflection.lower():
            # Parse and save all code files
            code_files = self.extract_code_files(generated_code)
            saved_files = []
            for file_name, language, code_content in code_files:
                dir_name = os.path.dirname(file_name)
                if dir_name:
                    os.makedirs(dir_name, exist_ok=True)
                with open(file_name, "w", encoding="utf-8") as f:
                    f.write(code_content)
                saved_files.append(file_name)
            message = f"Code generated and saved to files: {', '.join(saved_files)}"
            print(message)
            return {"status": "acceptable", "generated_code": reflection}
        else:
            print("Revision needed back to planning")
            current_feedback = state.get("reflection_feedback", [])
            updated_feedback = current_feedback + [reflection]
            return {"reflection_feedback": updated_feedback, "status": "revise", "generated_code": generated_code}

    def invoke(self, input_query: str, personal_id: int) -> str:
        """
        Process the query through the graph and return the final generated code.
        """
        inputs = {"question": input_query}
        self.output_response = ""
        for output in self.app.stream(inputs, self.memory_config):
            for key, value in output.items():
                if key == "reflector":
                    self.output_response = value.get("generated_code", "Code needs revision")
                    print(f"Final Generated Code:\n{self.output_response}")
                elif key == "code_generator":
                    self.output_response = value.get("generated_code", "No code generated")
                    print(self.output_response)
                    # self.memory_manager.save(personal_id, input_query, self.output_response)
        return self.output_response

    def __del__(self):
        """
        Cleanup method to close the Weaviate client.
        """
        if self.weaviate_client.is_connected():
            self.weaviate_client.close()
