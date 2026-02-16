from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Union
import json
import uuid

app = FastAPI()

data_store = []

class DataRecord(BaseModel):
    id: Union[str, int]
    input_text: str
    generated_sql: Optional[str] = None
    status: Optional[str] = "pending"
    metadata: Optional[Dict[str, Any]] = {}

class TransformationRequest(BaseModel):
    data: List[Dict[str, Any]]
    transformation_type: str

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "FastAPI is running"}

@app.get("/api/data")
def get_data(limit: int = 10, status: Optional[str] = None):
    """
    Simulates fetching data.
    In a real app, this would query a database.
    Here, we'll return a subset of our in-memory (or mocked) data.
    """
    # Mock data if store is empty
    if not data_store:
        for i in range(20):
            data_store.append({
                "id": str(uuid.uuid4()),
                "input_text": f"Sample input text {i}",
                "generated_sql": f"SELECT * FROM table_{i}",
                "status": "verified" if i % 2 == 0 else "pending",
                "bbox": [i*10, i*10, i*20, i*20]
            })
    
    filtered_data = data_store
    if status:
        filtered_data = [d for d in filtered_data if d.get("status") == status]
    
    return {"data": filtered_data[:limit], "total": len(filtered_data)}

@app.post("/api/transform")
def transform_data(request: TransformationRequest):
    """
    Takes raw JSON data and applies a specific transformation.
    """
    transformed_data = []
    
    try:
        if request.transformation_type == "normalize_sql":
            for item in request.data:
                new_item = item.copy()
                if "generated_sql" in new_item and isinstance(new_item["generated_sql"], str):
                    # Basic example transformation: uppercase keywords (mock logic)
                    new_item["generated_sql"] = new_item["generated_sql"].upper().strip()
                transformed_data.append(new_item)
                
        elif request.transformation_type == "openai_format":
             for item in request.data:
                # Convert to {"messages": [...]} format
                new_item = {
                    "messages": [
                        {"role": "user", "content": item.get("input_text", "")},
                        {"role": "assistant", "content": item.get("generated_sql", "")}
                    ]
                }
                transformed_data.append(new_item)
        
        elif request.transformation_type == "validate_bbox":
             for item in request.data:
                new_item = item.copy()
                if "bbox" in new_item and isinstance(new_item["bbox"], list):
                     # Ensure 4 coordinates
                     if len(new_item["bbox"]) == 4:
                         new_item["bbox_valid"] = True
                     else:
                         new_item["bbox_valid"] = False
                transformed_data.append(new_item)

        else:
             # Default: Just return as is
             transformed_data = request.data

        return {"data": transformed_data, "count": len(transformed_data)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export")
def export_data(data: List[Dict[str, Any]]):
    """
    Endpoint to 'package' data for download. 
    In a real scenario, this might generate a file link. 
    Here it just echoes back the sanitized data ready for file blob creation on frontend.
    """
    return {"file_content": json.dumps(data, indent=2), "filename": "exported_data.json"}
