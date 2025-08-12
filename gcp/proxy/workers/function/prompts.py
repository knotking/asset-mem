def document_classification_prompt() -> str:
    prompt ="""
                Persona: You are an expert document and image classifier.

                Objective: Analyze the provided file and identify its type. Respond with only a single classification label from the list below.

                Labels:

                    product_manual

                    warranty_card

                    receipt

                    image_appliance_issue

                    image_plumbing_issue

                    image_electrical_issue

                    image_hvac_issue

                    image_other_issue

                    other_document

                    other_image

                Rules:

                    Respond with ONLY the single, most appropriate label.

                    Do NOT provide any additional text, explanations, or punctuation.

                    Do NOT attempt to summarize the document or image.

                Example Input: An image showing a pipe with a small drip.
                Example Output: image_plumbing_issue

                Example Input: A PDF file with the words "User Manual" on the cover.
                Example Output: product_manual 
            """
    return prompt

def parsing_prompt_other() -> str:
    prompt = """
                You are an expert homecare document and image analyst. Your task is to analyze user-uploaded files and extract key information.

                Analyze the provided file and generate a detailed natural language summary that will be stored in a RAG system.

                Your response must be a natural language paragraph that includes the following information, if available:

                    - File Classification: State the type of document or image.

                    - Key Contents: Describe the main subject of the file.

                    - Appliance Details: Mention any detected model numbers, serial numbers, or brands.

                    - Issue Description: If it's an image of an issue, describe the problem clearly e.g., "a leak under the sink," "a cracked screen".

                Important Rules:
                    DO NOT respond with a JSON object.

            """
    return prompt
