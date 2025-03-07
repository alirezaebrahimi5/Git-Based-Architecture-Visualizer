from weaviate.classes.config import Configure, Property, DataType
from weaviate.exceptions import WeaviateQueryError
import os
import time
from weaviate.classes.query import MetadataQuery


class EpisodicMemory:
    """
    Manages long-term memory interactions with Weaviate, storing and retrieving past interactions.
    """

    def __init__(self, weaviate_client, memory_database_name):
        """
        Initialize the SemanticMemory with a Weaviate client.

        Args:
            weaviate_client: The Weaviate client instance.
        """
        self.client = weaviate_client
        self.memory_database_name = memory_database_name
        self.feedbacks_collection = self._initialize_schema()

    def _initialize_schema(self):
        """
        Initialize or retrieve the Weaviate schema for storing suggestions and feedbacks.

        Returns:
            Collection: The Weaviate feedbacks collection.
        """
        try:
            if not self.client.collections.exists(self.memory_database_name):
                print("Creating memory feedback database")
                return self.client.collections.create(
                    self.memory_database_name,
                    vectorizer_config=Configure.Vectorizer.text2vec_openai(
                        model="text-embedding-3-small",
                        # api_key=os.getenv("OPENAI_API_KEY")
                    ),
                    properties=[
                        Property(name="personal_id", data_type=DataType.INT),
                        Property(name="user_info", data_type=DataType.TEXT),
                        Property(name="suggestions", data_type=DataType.TEXT),
                        Property(name="feedbacks", data_type=DataType.TEXT),
                    ]
                )
            else:
                print(f"Loading vector database collection: {self.memory_database_name}")
                return self.client.collections.get(self.memory_database_name)
        except WeaviateQueryError:
            print("Creating memory feedback database")
            return self.client.collections.create(
                self.memory_database_name,
                vectorizer_config=Configure.Vectorizer.text2vec_openai(
                    model="text-embedding-3-small",
                    api_key=os.getenv("OPENAI_API_KEY")
                ),
                properties=[
                    Property(name="personal_id", data_type=DataType.INT),
                    Property(name="user_info", data_type=DataType.TEXT),
                    Property(name="suggestions", data_type=DataType.TEXT),
                    Property(name="feedbacks", data_type=DataType.TEXT),
                ]
            )

    def save(self, personal_id: int, input_query: str, output_msg: str) -> None:
        """
        Save an interaction to Weaviate with retry logic.

        Args:
            personal_id (int): The user's personal ID.
            input_query (str): The user's input query.
            output_msg (str): The generated suggestions.

        Raises:
            Exception: If all retry attempts fail.
        """
        max_retries = 3
        for attempt in range(max_retries):
            try:
                data_object = {
                    "personal_id": personal_id,
                    "user_info": input_query,
                    "suggestions": output_msg
                }
                self.feedbacks_collection.data.insert(properties=data_object)
                break
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff

    def retrieve(self, query: str) -> str:
        """
        Retrieve similar past interactions from Weaviate based on the query.

        Args:
            query (str): The query to search for similar interactions.

        Returns:
            str: A formatted string of retrieved interactions.
        """
        retrieved_users = self.feedbacks_collection.query.near_text(
            query=query,
            limit=5,
            return_metadata=MetadataQuery(distance=True)
        )
        feedbacks_memory = ""
        for i, obj in enumerate(retrieved_users.objects, start=1):
            user_id = obj.properties.get("personal_id", "N/A")
            user_info = obj.properties.get("user_info", "N/A")
            suggestions = obj.properties.get("suggestions", "N/A")
            feedbacks = obj.properties.get("feedbacks", "N/A")
            feedbacks_memory += f"""
                user {i}:
                id: {user_id}
                client_info: {user_info}
                therapist suggestions: {suggestions}
                feedbacks on the suggestions: {feedbacks}
            """
        return feedbacks_memory
