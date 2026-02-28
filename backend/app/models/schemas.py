from typing import List, Optional
from pydantic import BaseModel

class AnalysisResultSchema(BaseModel):
    standardized_prd: str
    quality_score: int
    missing_requirements: List[str]
    qa_risk_insights: List[str]

class PRDResponse(BaseModel):
    id: str
    filename: str
    status: str
    created_at: str

class PRDDetailResponse(PRDResponse):
    analysis: Optional[AnalysisResultSchema] = None
