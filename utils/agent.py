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

class GraphState(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        question: question
        generation: LLM generation
        documents: list of documents
    """
    question: str
    generation: str
    plan: str
    documents: List[str]


class SoftwareArchitectureAgent:
    def __init__(self, retriever, llm_model):
        # Initialize tools and other configurations
        self.retriever = retriever
        self.app = None
        self.memory_config = {"configurable": {"thread_id": "software engineer"}}
        self.llm_model = llm_model
        self.llm = ChatOpenAI(model_name=self.llm_model, temperature=0, streaming=True)
        self.weaviate_client = weaviate.connect_to_local(host="127.0.0.1", port=8080)
        self.memory_database_name = "feedbacks_memory"
        self.memory_manager = EpisodicMemory(self.weaviate_client, self.memory_database_name)
        self.output_response = ""
        self.reflection_step = None  # Add a placeholder for the reflection step
        # Agent Graph Init
        self.create_graph()

    def create_graph(self):
        """
        Create and compile the graph workflow for processing queries.
        """
        workflow = StateGraph(GraphState)

        # Define nodes
        workflow.add_node("retrieve", self._retrieve)
        workflow.add_node("planner", self._planning)
        workflow.add_node("reflection", self._reflection)
        workflow.add_node("generate", self._generate)

        # Define edges
        workflow.set_entry_point("retrieve")
        workflow.add_edge("retrieve", "planner")
        workflow.add_edge("planner", "reflection")
        workflow.add_edge("reflection", "generate")
        workflow.add_edge("generate", END)

        # Compile with memory checkpointing
        memory = MemorySaver()
        self.app = workflow.compile(checkpointer=memory)

    def _retrieve(self, state: GraphState) -> GraphState:
        """
        Retrieve documents based on the user's question.

        Args:
            state (GraphState): The current state of the graph.

        Returns:
            GraphState: Updated state with retrieved documents.
        """
        print("---RETRIEVE---")
        question = state["question"]
        documents = self.retriever.invoke(question)
        return {"documents": documents, "question": question}

    def _planning(self, state: GraphState) -> GraphState:
        """
        Create a step-by-step plan based on the question, documents, and past interactions.

        Args:
            state (GraphState): The current state of the graph.

        Returns:
            GraphState: Updated state with the plan.
        """
        print("---PLANNING---")
        question = state["question"]
        documents = state["documents"]

        # try:
        #     feedbacks_memory = self.memory_manager.retrieve(question)
        # except Exception as e:
        #     print(e)
        feedbacks_memory = ""

        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("planner_prompt")),
            ("human",
             "User question: {question}\nRetrieved documents: {documents}\nFeedbacks Memory: {feedbacks_memory}")
        ])
        chain = prompt | self.llm | StrOutputParser()
        plan = chain.invoke({"question": question, "documents": documents, "feedbacks_memory": feedbacks_memory})
        return {"documents": documents, "question": question, "plan": plan}

    def _reflection(self, state: GraphState) -> GraphState:
        """
        Refine the plan through reflection.

        Args:
            state (GraphState): The current state of the graph.

        Returns:
            GraphState: Updated state with the refined plan.
        """
        print("---REFLECTION---")
        plan = state["plan"]
        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("reflection_prompt")),
            ("human", "Plan: {plan}")
        ])
        chain = prompt | self.llm | StrOutputParser()
        reflection = chain.invoke({"plan": plan})
        return {"documents": state["documents"], "question": state["question"], "plan": reflection}

    def _generate(self, state: GraphState) -> GraphState:
        """
        Generate the final response based on the refined plan.

        Args:
            state (GraphState): The current state of the graph.

        Returns:
            GraphState: Updated state with the final generation.
        """
        print("---GENERATE---")
        question = state["question"]
        documents = state["documents"]
        plan = state["plan"]
        prompt = ChatPromptTemplate.from_messages([
            ("system", get_prompt("agentic_matchmaking_prompt")),
            ("human", "User question: {question}\nPlan: {plan}\nDocuments: {documents}")
        ])
        chain = prompt | self.llm | StrOutputParser()
        generation = chain.invoke({"question": question, "plan": plan, "documents": documents})
        return {"documents": documents, "question": question, "generation": generation}

    def invoke(self, input_query: str, personal_id: int) -> str:
        """
        Main entry for user queries. Process the query through the graph and return the final output.
        """
        inputs = {"question": input_query}
        self.output_response = ""
        for output in self.app.stream(inputs, self.memory_config):
            for key, value in output.items():
                if "plan" in value or "generation" in value:
                    output_msg = value.get("plan", value.get("generation"))
                    print(output_msg)
                    if key == "generation":
                        self.memory_manager.save(personal_id, input_query, output_msg)
                        self.output_response = str(output_msg)
        return self.output_response

    def __del__(self):
        """
        Cleanup method to close the Weaviate client when the agent is destroyed.
        """
        if self.weaviate_client.is_connected():
            self.weaviate_client.close()
