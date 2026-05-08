// ===== DOCUMENTS.JS =====

// 현재 선택된 탭/서류
let currentDocTab = 'resume';
let selectedDocId = null;
let selectedDocFile = null; // 모달에서 선택한 파일

// ===== 탭 전환 =====
const Documents = {
  switchTab(type) {
    currentDocTab = type;
    document.querySelectorAll('.doc-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    this.renderList();
  },

  async renderList() {
    const listEl = document.getElementById('doc-list');

    try {
      const docs = await DocDB.list(currentDocTab);

      if (docs.length === 0) {
        const icon = currentDocTab === 'resume' ? '📋' : '💼';
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <p>등록된 ${currentDocTab === 'resume' ? '이력서' : '포트폴리오'}가 없어요</p>
            <span>위 버튼을 눌러 서류를 등록해보세요</span>
          </div>`;
        return;
      }

      listEl.innerHTML = '';

      docs.forEach(doc => {
        const card = this.createDocCard(doc);
        listEl.appendChild(card);
      });

      // 분석 버튼
      const analyzeBtn = document.createElement('button');
      analyzeBtn.className = 'btn-primary btn-full btn-analyze-doc';
      analyzeBtn.id = 'btn-analyze-doc';
      analyzeBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        선택한 서류 분석하기
      `;
      analyzeBtn.onclick = () => this.analyzeSelected();
      analyzeBtn.disabled = !selectedDocId;
      listEl.appendChild(analyzeBtn);

    } catch (e) {
      console.error(e);
      Toast.show('서류 목록을 불러오지 못했어요', 'error');
    }
  },

  createDocCard(doc) {
    const card = document.createElement('div');
    card.className = 'doc-card' + (doc.id === selectedDocId ? ' selected' : '');
    card.dataset.id = doc.id;

    const date = new Date(doc.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    const icon = doc.type === 'resume' ? '📋' : '💼';

    card.innerHTML = `
      <div class="doc-card-icon">${icon}</div>
      <div class="doc-card-info">
        <div class="doc-card-title">${doc.title}</div>
        <div class="doc-card-meta">${doc.target_role || ''} · v${doc.version} · ${date}</div>
      </div>
      <div class="doc-card-actions">
        <button class="doc-action-btn danger" title="삭제" onclick="event.stopPropagation(); Documents.deleteDoc('${doc.id}')">✕</button>
      </div>
    `;

    card.addEventListener('click', () => this.selectDoc(doc.id));
    return card;
  },

  selectDoc(docId) {
    selectedDocId = docId;
    // 카드 선택 상태 업데이트
    document.querySelectorAll('.doc-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.id === docId);
    });
    // 분석 버튼 활성화
    const btn = document.getElementById('btn-analyze-doc');
    if (btn) btn.disabled = false;
  },

  async analyzeSelected() {
    if (!selectedDocId) return Toast.show('서류를 먼저 선택해주세요', 'error');

    // 기존 분석 결과 있으면 먼저 표시
    try {
      const existing = await DocAnalysisDB.getLatest(selectedDocId);
      if (existing) {
        this.renderResult(existing.feedback, existing.created_at);
        return;
      }
    } catch {}

    // 새 분석
    await this.runAnalysis(selectedDocId);
  },

  async runAnalysis(docId) {
    Loading.show('AI가 서류를 꼼꼼히 분석하고 있어요...');
    try {
      const docs = await DocDB.list();
      const doc = docs.find(d => d.id === docId);
      if (!doc) throw new Error('서류를 찾을 수 없어요');

      // 파일 URL 가져오기
      const fileUrl = await DocDB.getFileUrl(doc.file_path);
      if (!fileUrl) throw new Error('파일을 불러올 수 없어요');

      // PDF 파일 fetch → base64
      const resp = await fetch(fileUrl);
      const blob = await resp.blob();
      const base64 = await fileToBase64(new File([blob], doc.file_name, { type: 'application/pdf' }));

      // AI 분석 호출
      const feedback = await AI.analyzeDocument(doc, base64);

      // 저장
      await DocAnalysisDB.save(docId, feedback);

      // 렌더링
      this.renderResult(feedback, new Date().toISOString());
      Toast.show('분석이 완료됐어요!', 'success');

    } catch (e) {
      console.error(e);
      Toast.show('분석 중 오류가 발생했어요: ' + e.message, 'error');
    } finally {
      Loading.hide();
    }
  },

  renderResult(feedback, createdAt) {
    const emptyEl = document.getElementById('result-empty');
    const contentEl = document.getElementById('result-content');

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const date = new Date(createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    let html = `
      <div class="result-header">
        <div class="result-doc-info">
          <h3>${feedback.title || '서류 분석 결과'}</h3>
          <div class="result-doc-meta">${feedback.role || ''} · ${feedback.domain || ''}</div>
        </div>
        <div class="result-date">${date}</div>
      </div>
    `;

    // 섹션별 피드백
    if (feedback.sections) {
      feedback.sections.forEach(section => {
        html += `<div class="feedback-section">
          <div class="feedback-section-title">${section.title}</div>`;
        section.items.forEach(item => {
          const badgeClass = item.level === 'good' ? 'badge-good' : item.level === 'critical' ? 'badge-critical' : 'badge-improve';
          const badgeText = item.level === 'good' ? '잘 됨' : item.level === 'critical' ? '필수 개선' : '개선 권장';
          html += `<div class="feedback-item">
            <div class="feedback-item-header">
              <span class="feedback-item-label">${item.label}</span>
              <span class="feedback-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="feedback-item-text">${item.text}</div>
          </div>`;
        });
        html += `</div>`;
      });
    }

    // 재분석 버튼
    html += `<button class="btn-ghost" style="margin-top:8px;width:100%;justify-content:center;" onclick="Documents.runAnalysis('${selectedDocId}')">
      🔄 다시 분석하기
    </button>`;

    contentEl.innerHTML = html;
  },

  async deleteDoc(docId) {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      await DocDB.delete(docId);
      if (selectedDocId === docId) {
        selectedDocId = null;
        document.getElementById('result-empty').classList.remove('hidden');
        document.getElementById('result-content').classList.add('hidden');
      }
      await this.renderList();
      Toast.show('삭제됐어요', 'success');
    } catch (e) {
      Toast.show('삭제 중 오류가 발생했어요', 'error');
    }
  },

  async refreshAnalysisSelect() {
    const select = document.getElementById('analysis-doc-select');
    try {
      const docs = await DocDB.list('resume');
      select.innerHTML = docs.length === 0
        ? '<option value="">이력서를 먼저 등록해주세요 (STEP 01)</option>'
        : '<option value="">이력서를 선택하세요</option>' + docs.map(d =>
            `<option value="${d.id}">${d.title} (v${d.version})</option>`
          ).join('');
    } catch {}
  }
};

// ===== 서류 등록 모달 =====
const DocumentModal = {
  open() {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-title').value = '';
    document.getElementById('modal-role').value = '';
    document.getElementById('modal-domain').value = '';
    document.getElementById('modal-companies').value = '';
    selectedDocFile = null;
    this.resetFileDrop();
  },

  close(event) {
    if (event && event.target !== document.getElementById('modal-overlay')) return;
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  resetFileDrop() {
    document.getElementById('file-drop').classList.remove('has-file');
    document.getElementById('file-drop-inner').innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 4v16M8 12l8-8 8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 24h24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <p>클릭하거나 파일을 드래그해서 올려주세요</p>
      <span>PDF만 가능 · 최대 10MB</span>
    `;
    document.getElementById('file-input').value = '';
  },

  handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      Toast.show('PDF 파일만 업로드할 수 있어요', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      Toast.show(`파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 해요`, 'error');
      return;
    }

    selectedDocFile = file;
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    document.getElementById('file-drop').classList.add('has-file');
    document.getElementById('file-drop-inner').innerHTML = `
      <div class="file-selected">✓ ${file.name}</div>
      <div class="file-selected-size">${sizeMB} MB</div>
    `;
  },

  async submit() {
    const title = document.getElementById('modal-title').value.trim();
    const role = document.getElementById('modal-role').value.trim();
    const domain = document.getElementById('modal-domain').value.trim();
    const companies = document.getElementById('modal-companies').value.trim();
    const type = document.querySelector('input[name="doc-type"]:checked').value;

    if (!title) return Toast.show('타이틀을 입력해주세요', 'error');
    if (!role) return Toast.show('지원 희망 직무를 입력해주세요', 'error');
    if (!domain) return Toast.show('지원 희망 분야를 입력해주세요', 'error');
    if (!selectedDocFile) return Toast.show('PDF 파일을 업로드해주세요', 'error');

    document.getElementById('modal-overlay').classList.add('hidden');
    Loading.show('서류를 업로드하고 있어요...');

    try {
      await Session.ensureSession();

      // 1. DB에 메타 정보 먼저 저장 (파일 경로 없이)
      const doc = await DocDB.insert({
        type, title,
        file_name: selectedDocFile.name,
        file_size: selectedDocFile.size,
        file_path: '', // 임시
        target_role: role,
        target_domain: domain,
        target_companies: companies || null,
        version: 1,
        is_latest: true
      });

      // 2. 파일 업로드
      const filePath = await DocDB.uploadFile(selectedDocFile, doc.id);

      // 3. 파일 경로 업데이트
      await db.from('job_documents').update({ file_path: filePath }).eq('id', doc.id);

      Loading.show('AI가 서류를 분석하고 있어요...');

      // 4. AI 분석
      const base64 = await fileToBase64(selectedDocFile);
      const feedback = await AI.analyzeDocument({ ...doc, target_role: role, target_domain: domain, target_companies: companies }, base64);

      // 5. 분석 결과 저장
      await DocAnalysisDB.save(doc.id, feedback);

      // 6. UI 업데이트
      selectedDocId = doc.id;
      await Documents.renderList();
      await Documents.refreshAnalysisSelect();
      Documents.renderResult(feedback, new Date().toISOString());
      App.updateStep2Nav();
      Toast.show('서류 등록 및 분석 완료!', 'success');

    } catch (e) {
      console.error(e);
      Toast.show('오류가 발생했어요: ' + e.message, 'error');
    } finally {
      Loading.hide();
      selectedDocFile = null;
    }
  }
};

// ===== AI 분석 (Supabase Edge Function 경유) =====
const AI = {
  async analyzeDocument(doc, pdfBase64) {
    const response = await fetch(`${EDGE_FUNCTION_URL}/analyze-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ doc, pdfBase64 })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'AI 분석 실패');
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.feedback;
  }
};
