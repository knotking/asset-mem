# train_model.py
import json
import torch
import pandas as pd
from datasets import Dataset, DatasetDict
from transformers import AutoTokenizer, Trainer, TrainingArguments, AutoModel
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
import os

auth_token = "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"
def train_model(model_name="roberta-base"):
    # Load JSON data
    with open("property_risk_dataset.json", "r") as f:
        data = json.load(f)

    # Convert to pandas DataFrame
    df = pd.DataFrame(data)

    # Encode categorical labels
    category_encoder = LabelEncoder()
    df["category_labels"] = category_encoder.fit_transform(df["category"])

    risk_encoder = LabelEncoder()
    df["risk_labels"] = risk_encoder.fit_transform(df["risk_level"])

    # Split data into training and validation sets
    train_texts, val_texts, train_category_labels, val_category_labels, train_risk_labels, val_risk_labels = train_test_split(
        df["text"].tolist(), df["category_labels"].tolist(), df["risk_labels"].tolist(), test_size=0.2, random_state=42
    )

    train_data = {
        "text": train_texts,
        "category_labels": train_category_labels,
        "risk_labels": train_risk_labels
    }

    val_data = {
        "text": val_texts,
        "category_labels": val_category_labels,
        "risk_labels": val_risk_labels
    }

    # Convert to Hugging Face Dataset
    datasets = DatasetDict({
        "train": Dataset.from_dict(train_data),
        "val": Dataset.from_dict(val_data)
    })

     
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name, token=auth_token)

    def tokenize_function(examples):
        return tokenizer(examples["text"], padding="max_length", truncation=True)

    # Tokenize dataset
    tokenized_datasets = datasets.map(tokenize_function, batched=True)

    # Convert labels into tensor format
    def format_labels(example):
        return {
            "input_ids": example["input_ids"],
            "attention_mask": example["attention_mask"],
            "category_labels": torch.tensor(example["category_labels"], dtype=torch.long),
            "risk_labels": torch.tensor(example["risk_labels"], dtype=torch.long),
        }

    tokenized_datasets = tokenized_datasets.map(format_labels)

    # Define custom multi-task model
    class MultiTaskModel(torch.nn.Module):
        def __init__(self, base_model, num_categories, num_risks):
            super().__init__()
            self.base_model = AutoModel.from_pretrained(base_model, token=auth_token)
            self.dropout = torch.nn.Dropout(0.1)
            self.category_classifier = torch.nn.Linear(self.base_model.config.hidden_size, num_categories)
            self.risk_classifier = torch.nn.Linear(self.base_model.config.hidden_size, num_risks)

        def forward(self, input_ids, attention_mask, category_labels=None, risk_labels=None):
            outputs = self.base_model(input_ids=input_ids, attention_mask=attention_mask)
            pooled_output = outputs.last_hidden_state[:, 0, :]  # CLS token representation

            category_logits = self.category_classifier(self.dropout(pooled_output))
            risk_logits = self.risk_classifier(self.dropout(pooled_output))

            loss = None
            if category_labels is not None and risk_labels is not None:
                category_loss = torch.nn.CrossEntropyLoss()(category_logits, category_labels)
                risk_loss = torch.nn.CrossEntropyLoss()(risk_logits, risk_labels)
                loss = category_loss + risk_loss  # Combine losses

            return {"loss": loss, "logits": (category_logits, risk_logits)}

        def save_pretrained(self, path):
            # Save the base model
            self.base_model.save_pretrained(path)
            
            # Save the category classifier
            torch.save(self.category_classifier.state_dict(), os.path.join(path, "category_classifier.pt"))
            
            # Save the risk classifier
            torch.save(self.risk_classifier.state_dict(), os.path.join(path, "risk_classifier.pt"))
            
            # Save model config
            config = {
                "num_categories": self.category_classifier.out_features,
                "num_risks": self.risk_classifier.out_features,
            }
            with open(os.path.join(path, "config.json"), "w") as f:
                json.dump(config, f)

    # Instantiate model
    num_categories = len(df["category_labels"].unique())
    num_risks = len(df["risk_labels"].unique())
    model = MultiTaskModel(model_name, num_categories, num_risks)

    # Custom Trainer to handle multiple labels
    class MultiTaskTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
            category_labels = inputs.pop("category_labels")
            risk_labels = inputs.pop("risk_labels")

            outputs = model(**inputs, category_labels=category_labels, risk_labels=risk_labels)
            loss = outputs["loss"]

            return (loss, outputs) if return_outputs else loss

    # Training arguments
    training_args = TrainingArguments(
        output_dir="./results",
        evaluation_strategy="epoch",
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        num_train_epochs=3,
        weight_decay=0.01,
        logging_dir="./logs",
    )

    # Define Trainer
    trainer = MultiTaskTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["val"],
        tokenizer=tokenizer,
    )

    # Train the model
    trainer.train()

    # Save model and tokenizer with the specified model name
    model_save_path = f"./trained_models/{model_name.replace('/', '_')}_property_classifier"
    model.save_pretrained(model_save_path)
    tokenizer.save_pretrained(model_save_path)

    # Save configuration
    config = {
        "num_categories": num_categories,
        "num_risks": num_risks,
        "category_labels_mapping": dict(enumerate(category_encoder.classes_)),
        "risk_labels_mapping": dict(enumerate(risk_encoder.classes_))
    }
    with open(os.path.join(model_save_path, "config.json"), "w") as f:
        json.dump(config, f)

if __name__ == "__main__":
    train_model(model_name="roberta-base")  # You can change "roberta-base" to any other model name