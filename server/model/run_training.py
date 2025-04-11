from train_model import train_model

if __name__ == "__main__":
    # Call the train_model function with the desired model name
    train_model(model_name="roberta-base")  # You can change "roberta-base" to any other model name
    train_model(model_name="distilbert-base-uncased")
