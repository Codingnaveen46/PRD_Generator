from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, status
from typing import List
import uuid

from app.core.database import supabase
from app.models.schemas import PRDResponse, PRDDetailResponse, AnalysisResultSchema
from app.services.extractor import extract_text
from app.services.analyzer import analyze_prd_text

router = APIRouter()

# Test user UUID (created in Supabase auth to satisfy FK constraint)
ANON_USER_ID = "39803246-87ff-4b15-8560-dff026e592bc"

async def process_document(prd_id: str, file_bytes: bytes, filename: str):
    try:
        # 1. Extract text
        print(f"Extracting text for PRD {prd_id}")
        text = extract_text(file_bytes, filename)
        
        # 2. Analyze with OpenAI
        print(f"Analyzing text for PRD {prd_id} with OpenAI")
        analysis: AnalysisResultSchema = await analyze_prd_text(text)
        
        # 3. Store results
        print(f"Storing results for PRD {prd_id}")
        supabase.table("analysis_results").insert({
            "prd_id": prd_id,
            "standardized_prd": analysis.standardized_prd,
            "quality_score": analysis.quality_score,
            "missing_requirements": getattr(analysis, 'missing_requirements', []),
            "qa_risk_insights": getattr(analysis, 'qa_risk_insights', [])
        }).execute()

        # 4. Update status to completed
        supabase.table("prds").update({"status": "completed"}).eq("id", prd_id).execute()
        print(f"Finished processing PRD {prd_id}")

    except Exception as e:
        print(f"Error processing document: {e}")
        supabase.table("prds").update({"status": "failed"}).eq("id", prd_id).execute()

@router.post("/analyze", response_model=PRDResponse)
async def upload_and_analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename.lower().endswith(('.pdf', '.md', '.docx')):
         raise HTTPException(status_code=400, detail="Only .pdf, .docx, and .md files are supported")

    file_bytes = await file.read()
    
    # Generate unique storage path
    storage_path = f"{ANON_USER_ID}/{uuid.uuid4()}_{file.filename}"
    
    try:
        # Try to upload to Supabase Storage (may fail if storage RLS is strict)
        try:
            supabase.storage.from_("prd_documents").upload(storage_path, file_bytes)
        except Exception as storage_err:
            print(f"Storage upload skipped (non-critical): {storage_err}")
        
        # Create database record (user_id is text to avoid FK constraint issues)
        db_res = supabase.table("prds").insert({
            "user_id": ANON_USER_ID,
            "filename": file.filename,
            "storage_path": storage_path,
            "status": "processing"
        }).execute()
        
        prd_record = db_res.data[0]
        
        # Background processing
        background_tasks.add_task(process_document, prd_record['id'], file_bytes, file.filename)
        
        return PRDResponse(
            id=prd_record['id'],
            filename=prd_record['filename'],
            status=prd_record['status'],
            created_at=prd_record['created_at']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prds", response_model=List[PRDResponse])
async def list_prds():
    try:
        response = supabase.table("prds").select("*").order("created_at", desc=True).execute()
        return [PRDResponse(**item) for item in response.data]
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.get("/prds/{prd_id}", response_model=PRDDetailResponse)
async def get_prd_detail(prd_id: str):
    try:
        # Get PRD
        prd_res = supabase.table("prds").select("*").eq("id", prd_id).execute()
        if not prd_res.data:
            raise HTTPException(status_code=404, detail="PRD not found")
            
        prd = prd_res.data[0]
        response_model = PRDDetailResponse(**prd)
        
        # If completed, get analysis
        if prd['status'] == 'completed':
             analysis_res = supabase.table("analysis_results").select("*").eq("prd_id", prd_id).execute()
             if analysis_res.data:
                 response_model.analysis = AnalysisResultSchema(**analysis_res.data[0])
                 
        return response_model
    except HTTPException:
        raise
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))
