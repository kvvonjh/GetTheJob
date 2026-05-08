// ===== CONFIG =====
const SUPABASE_URL = 'https://lbwocrufyqvvouhsorhr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxid29jcnVmeXF2dm91aHNvcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjQ2NDMsImV4cCI6MjA4OTg0MDY0M30.aL3NHkRQR1UT-1XOUjBuYMiXcK9ZcVIL1InFOm4EIPw';

// Gemini API (무료 티어 사용)
// 아래 키를 본인의 Google AI Studio API Key로 교체하세요
// 발급: https://aistudio.google.com → "Get API key"
const GEMINI_API_KEY = 'AIzaSyBjhpy5GX8-C2O_3og7AXN49xibbqqPo_4';
const GEMINI_MODEL = 'gemini-2.5-flash-lite-preview-06-17'; // 무료 티어 최고 처리량 모델

// PDF 업로드 제한
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
