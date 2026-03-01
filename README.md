# Suture

AI-powered embroidery file generator that converts text prompts or images into machine-ready embroidery files (.DST).

## Features

- Text-to-image generation using Gemini AI
- Image upload with automatic quality validation and enhancement
- Automated image preprocessing (background removal, contrast adjustment)
- SVG tracing with AI-powered quality review
- DST embroidery file generation with configurable stitch patterns
- Manufacturing quote calculator with garment selection
- Shopping cart for bulk orders

## Tech Stack

**Frontend:**
- Next.js 16 with TypeScript
- React 19
- Tailwind CSS 4

**Backend:**
- FastAPI
- Google Gemini AI
- vtracer (SVG conversion)
- pyembroidery (DST generation)
- rembg (background removal)
- Pillow (image processing)

## Setup

### Prerequisites

- Node.js 20+
- Python 3.9+
- Google Gemini API key

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Create a `.env` file in the backend directory (use `.env.example` as template):
```
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET_KEY=your_secure_random_secret_key_here
FRONTEND_URL=http://localhost:3000
```

**⚠️ Security Note:** Never commit your `.env` file or real API keys to version control. Use the provided `.env.example` as a template only.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000` and the backend API on `http://localhost:8000`.

## Pipeline

1. Input: Text prompt or image upload
2. Image validation and enhancement
3. Preprocessing (background removal, contrast adjustment)
4. SVG conversion with AI review
5. DST generation with AI optimization
6. Download final embroidery file

## API Endpoints

- `POST /generate-image` - Generate image from text prompt
- `POST /upload-image` - Upload and validate image
- `POST /preprocess-image` - Preprocess image for conversion
- `POST /convert-to-svg` - Convert image to SVG
- `POST /convert-to-dst` - Convert to DST embroidery file
- `POST /manufacturing-quote` - Calculate manufacturing quote
- `POST /auth/register` - User registration
- `POST /auth/login` - User login

## License

MIT
