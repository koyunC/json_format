# AI Data Inspector & Formatter

A production-ready React (TypeScript) + FastAPI application for managing and transforming AI training data.

## Features
- **Data Ingestion**: Upload JSON files or paste raw JSON.
- **Inspector**: Responsive grid with multi-selection and filtering.
- **Transformation Engine**: Normalize SQL, format for OpenAI, validate bounding boxes.
- **Export**: Download transformed datasets.

## Local Development

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)

### 1. Setup Backend
Open a terminal and run:
```bash

pip install -r requirements.txt

# Start the FastAPI server
python3 -m uvicorn api.index:app --reload --port 8000
```

### 2. Setup Frontend
Open a **new** terminal window and run:
```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

### 3. Access the App
Open your browser and navigate to the URL shown in the frontend terminal (usually `http://localhost:5173`).

## Deployment
This project is configured for Vercel.

**Live Demo:** [https://json-formating-67l4eqmqy-koyuncs-projects.vercel.app](https://json-formating-67l4eqmqy-koyuncs-projects.vercel.app)

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` to deploy.
