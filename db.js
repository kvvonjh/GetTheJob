// ===== DB.JS — Supabase 연동 =====

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 세션 관리 =====
const Session = {
  TOKEN_KEY: 'jobfit_session_token',

  getToken() {
    let token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(this.TOKEN_KEY, token);
    }
    return token;
  },

  async ensureSession() {
    const token = this.getToken();
    const { data } = await db
      .from('job_sessions')
      .select('id')
      .eq('session_token', token)
      .single();

    if (!data) {
      await db.from('job_sessions').insert({ session_token: token });
    } else {
      await db.from('job_sessions').update({ last_seen_at: new Date().toISOString() }).eq('session_token', token);
    }
    return token;
  }
};

// ===== 서류(Documents) =====
const DocDB = {
  async list(type) {
    const token = Session.getToken();
    const query = db
      .from('job_documents')
      .select('*')
      .eq('session_token', token)
      .eq('is_latest', true)
      .order('created_at', { ascending: false });

    if (type) query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async insert(docData) {
    const token = Session.getToken();
    const { data, error } = await db
      .from('job_documents')
      .insert({ ...docData, session_token: token })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadFile(file, docId) {
    const token = Session.getToken();
    const filePath = `${token}/${docId}/${file.name}`;
    const { error } = await db.storage
      .from('job-documents')
      .upload(filePath, file, { contentType: 'application/pdf' });
    if (error) throw error;
    return filePath;
  },

  async getFileUrl(filePath) {
    const { data } = await db.storage
      .from('job-documents')
      .createSignedUrl(filePath, 3600); // 1시간 유효
    return data?.signedUrl;
  },

  async delete(docId) {
    const { error } = await db
      .from('job_documents')
      .delete()
      .eq('id', docId);
    if (error) throw error;
  },

  async getVersions(parentId) {
    const token = Session.getToken();
    const { data, error } = await db
      .from('job_documents')
      .select('*')
      .eq('session_token', token)
      .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
      .order('version', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};

// ===== 서류 분석 결과 =====
const DocAnalysisDB = {
  async save(documentId, feedback) {
    const token = Session.getToken();
    const { data, error } = await db
      .from('job_document_analyses')
      .insert({ document_id: documentId, session_token: token, feedback })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getLatest(documentId) {
    const { data, error } = await db
      .from('job_document_analyses')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
};

// ===== 공고 분석 결과 =====
const PostingAnalysisDB = {
  async save(analysisData) {
    const token = Session.getToken();
    const { data, error } = await db
      .from('job_posting_analyses')
      .insert({ ...analysisData, session_token: token })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async list() {
    const token = Session.getToken();
    const { data, error } = await db
      .from('job_posting_analyses')
      .select('*')
      .eq('session_token', token)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await db
      .from('job_posting_analyses')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
};

// ===== PDF → Base64 변환 =====
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== URL에서 텍스트 가져오기 (CORS 우회용 프록시) =====
async function fetchUrlText(url) {
  // allorigins.win 프록시 사용
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  const json = await res.json();
  if (!json.contents) throw new Error('페이지를 불러올 수 없어요');

  // HTML에서 텍스트만 추출
  const parser = new DOMParser();
  const doc = parser.parseFromString(json.contents, 'text/html');
  // 불필요한 태그 제거
  ['script', 'style', 'nav', 'footer', 'header'].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });
  const text = doc.body?.innerText || doc.body?.textContent || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 8000); // 8000자 제한
}
