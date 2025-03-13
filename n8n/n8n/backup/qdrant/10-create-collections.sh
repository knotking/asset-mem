echo 'Waiting for Qdrant...';
until curl -f http://qdrant:6333/readyz; do sleep 5; done;
    echo 'Qdrant is ready. Initializing collections...';
    curl -X PUT 'http://qdrant:6333/collections/homeama' \
        -H 'Content-Type: application/json' \
        -d '{
            "vectors": {
            "size": 3072,
            "distance": "Cosine"
            }
        }'    
    echo 'Initialization done.';

