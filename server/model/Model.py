import torch
from transformers import AutoTokenizer, AutoModel
import json
import os

class MultiTaskModel(torch.nn.Module):
    def __init__(self, num_categories, num_risks):
        super(MultiTaskModel, self).__init__()
        self.bert = AutoModel.from_pretrained("distilbert-base-uncased")
        self.category_classifier = torch.nn.Linear(self.bert.config.hidden_size, num_categories)
        self.risk_classifier = torch.nn.Linear(self.bert.config.hidden_size, num_risks)

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        hidden_state = outputs.last_hidden_state[:, 0, :]  # Use the [CLS] token representation
        category_logits = self.category_classifier(hidden_state)
        risk_logits = self.risk_classifier(hidden_state)
        return category_logits, risk_logits

    @classmethod
    def from_pretrained(cls, path):
        # Load config
        with open(os.path.join(path, "config.json"), "r") as f:
            config = json.load(f)
        
        # Create model instance
        model = cls(
            num_categories=config["num_categories"],
            num_risks=config["num_risks"]
        )
        
        # Load BERT
        model.bert = AutoModel.from_pretrained(path, ignore_mismatched_sizes=True)
        
        # Load classifiers
        model.category_classifier.load_state_dict(torch.load(os.path.join(path, "category_classifier.pt")))
        model.risk_classifier.load_state_dict(torch.load(os.path.join(path, "risk_classifier.pt")))
        
        return model

class ModelHandler:
    def __init__(self, model_name="distilbert-base-uncased", device=None):
        model_path = f"model/trained_models/{model_name}_property_classifier"
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        
        # Load model
        self.model = MultiTaskModel.from_pretrained(model_path)
        self.model.to(self.device)
        
        # Load category and risk mappings
        with open("model/category_mapping.json", "r") as f:
            self.category_mapping = json.load(f)
        with open("model/risk_mapping.json", "r") as f:
            self.risk_mapping = json.load(f)
        
        # Create id_to_label mappings
        self.category_id_to_label = {int(k): v for k, v in self.category_mapping.items()}
        self.risk_id_to_label = {int(k): v for k, v in self.risk_mapping.items()}
        
        # Add debugging
        print("Category Mapping:", self.category_mapping)
        print("Risk Mapping:", self.risk_mapping)

    def classify_document(self, text):
        # Tokenize input text
        inputs = self.tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512).to(self.device)
        
        # Run inference
        self.model.eval()
        with torch.no_grad():
            category_logits, risk_logits = self.model(**inputs)
        
        # Get predictions and probabilities for both tasks
        category_probs = torch.nn.functional.softmax(category_logits, dim=1)
        risk_probs = torch.nn.functional.softmax(risk_logits, dim=1)
        
        category_id = torch.argmax(category_logits, dim=1).item()
        risk_id = torch.argmax(risk_logits, dim=1).item()
        
        # Debug output
        print(f"Category logits: {category_logits}")
        print(f"Risk logits: {risk_logits}")
        print(f"Category probabilities: {category_probs}")
        print(f"Risk probabilities: {risk_probs}")
        print(f"Predicted category ID: {category_id}")
        print(f"Predicted risk ID: {risk_id}")
        
        # Get labels from mappings with error handling
        category = self.category_id_to_label.get(category_id, "Unknown")
        risk_level = self.risk_id_to_label.get(risk_id, "Unknown")
        
        if category == "Unknown":
            print(f"Warning: Category ID {category_id} not found in mapping")
        if risk_level == "Unknown":
            print(f"Warning: Risk ID {risk_id} not found in mapping")

        return {
            "text": text,
            "predicted_category": category,
            "predicted_risk_level": risk_level,
            "category_confidence": category_probs.max().item(),
            "risk_confidence": risk_probs.max().item()
        }
