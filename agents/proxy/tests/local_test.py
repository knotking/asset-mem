import sys
import logging
logging.basicConfig(level=logging.INFO)
# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("Loaded environment variables from .env")
except ImportError:
    print("python-dotenv not installed. Skipping .env loading.")

from vertex_client import get_agent_answer
def main():
    print("Local Vertex AI Reasoning Engine Test Console")
    print("Type 'exit' to quit.")
    try:
        chat_id = input("Enter chat_id (integer): ").strip()
        if not chat_id.isdigit():
            print("chat_id must be an integer.")
            return
        chat_id = int(chat_id)
        while True:
            user_text = input("You: ").strip()
            if user_text.lower() == 'exit':
                print("Exiting.")
                break
            answer = get_agent_answer(chat_id, user_text)
            print(f"Agent: {answer}")
    except KeyboardInterrupt:
        print("\nExiting.")
        sys.exit(0)

if __name__ == "__main__":
    main() 