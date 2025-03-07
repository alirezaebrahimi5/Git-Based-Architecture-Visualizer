from utils import get_prompt, get_vectorstores, SoftwareArchitectureAgent
from langchain_openai import ChatOpenAI, OpenAI, OpenAIEmbeddings
import os
from langchain.chains import HypotheticalDocumentEmbedder

os.environ[
    "OPENAI_API_KEY"] = "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"
# os.environ["OPENAI_API_KEY"] = "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"
os.environ["COHERE_API_KEY"] = "JV4zDNnW13pe5kyjOkj4Yf2FX4pAcroV8oQevj7F"
os.environ["LANGCHAIN_API_KEY"] = "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"
os.environ["GITHUB_PERSONAL_ACCESS_TOKEN"] = "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"
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"
os.environ["LANGCHAIN_PROJECT"] = 'default'


class SoftwareAgent:
    """
    Langchain Model class to handle different types of language models.
    """

    def __init__(self, llm_model, data_path, data_types, vectorstore_name="weaviate", embeddings_model="openai"):
        """
        Initialize the LangchainModel class with the specified LLM model type and options.

        Args:
            llm_model (str): The type of LLM model to use.
            vectorstore_name (str): The name of the vector store to use.
            embeddings_model (str): The embeddings model to use.
        """
        self.loader = None
        self.results = None
        self.model_type = llm_model
        self.text_splitter = None
        self.model = None
        self.temperature = 0.1
        self.chain = None
        self.result = None
        self.results = None
        self.chat_history = []
        self.vectorstore_name = vectorstore_name
        self.create_db = False
        self.database_collection_name = "github_agent"
        self.chunk_size = 5000
        self.embeddings_model = embeddings_model
        self.data_path = data_path
        self.data_types = data_types

    def model_chain_init(self):
        """
        Initialize the FitFusion chain.

        Args:
            data_path (str): The path to the data directory.
            data_types (list): The list of data types to process.
        """
        # Initialize vector database with embeddings
        vector_store = get_vectorstores(self.vectorstore_name, self.data_path, self.data_types, self._select_embeddings_model(),
                                        self.database_collection_name, self.chunk_size, self.create_db)

        # Initialize AgenticRAG chain with the retriever tool
        self.chain = SoftwareArchitectureAgent(vector_store.as_retriever(), self.model_type)
        # self.chain.create_graph()

    def _select_embeddings_model(self):
        """
        Select the embeddings model based on the embeddings_model attribute.

        Returns:
            BaseEmbeddings: The selected embeddings instance.
        """
        if self.embeddings_model == "ollama":
            return OllamaEmbeddings(model=self.model_type)
        else:
            # Default to OpenAI Embeddings
            return OpenAIEmbeddings(model="text-embedding-3-small")

    def query_inferences(self, query_input, personal_id):
        """
        Perform inference based on the query input and the model type.

        Args:
            query_input (str): The query input for inference.
            personal_id (str): user personal ID
        """
        # Invoke the chain with the query input
        self.results = self.chain.invoke(query_input, personal_id)

        # Print and return the results
        return self.results


if __name__ == "__main__":
    """
    Main function to run Langchain Model.
    """
    directory, model_type, vectorstore, file_formats = 'Vargha-Kh/FitFusion', 'gpt-4o-mini', 'weaviate', ['github']
    # Langchain model init
    software_agent_model = SoftwareAgent(llm_model=model_type, data_path=directory, data_types=file_formats,
                                         vectorstore_name=vectorstore)
    software_agent_model.model_chain_init()
    while True:
        query = input("Please ask your question! ")
        print(software_agent_model.query_inferences(query, "412"))
