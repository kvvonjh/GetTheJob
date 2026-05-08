// ===== CONFIG =====
const SUPABASE_URL = 'https://lbwocrufyqvvouhsorhr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxid29jcnVmeXF2dm91aHNvcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjQ2NDMsImV4cCI6MjA4OTg0MDY0M30.aL3NHkRQR1UT-1XOUjBuYMiXcK9ZcVIL1InFOm4EIPw';

// Gemini API 키는 Supabase Edge Function 환경변수에 안전하게 보관됩니다
// 프론트엔드에서는 Edge Function URL만 사용
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`;

// PDF 업로드 제한
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
