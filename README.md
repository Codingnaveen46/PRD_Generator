# PRD Intelligence Platform

A powerful tool to analyze and standardize Product Requirement Documents (PRD) or Business Requirement Documents (BRD). Supported formats: `.pdf`, `.md`, and `.docx`.

## Features
- **File Support**: Upload and extract text from PDF, Markdown, and Word documents.
- **AI-Powered Analysis**: Uses Hugging Face's Inference API (Qwen2.5-Coder-32B) to generate standardized PRDs.
- **Standardized Sections**: Generates structured PRDs with Overview, Objectives, Functional Requirements, Inclusions, and Exclusions.
- **Intelligence Insights**: Provides quality scores, identifies missing requirements, and flags QA/Technical risks.
- **Multi-Format Export**: Download the standardized PRD as Markdown, PDF, or DOCX.
- **Zero-Auth Layer**: Built for direct dashboard access for rapid testing and internal use.

## Architecture
- **Frontend**: React + Tailwind CSS + Vite
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **AI**: Hugging Face Inference API

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- Supabase account
- Hugging Face API Token

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Create a `.env` file in the `backend` directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
HUGGINGFACE_API_KEY=your_huggingface_token
```
Run the server:
```bash
uvicorn app.main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```
Run the development server:
```bash
npm run dev
```

## License
MIT
