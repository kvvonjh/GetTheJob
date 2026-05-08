// ===== ANALYSIS.JS — 공고 분석 =====

let currentPostingMode = 'url';

const PostingInput = {
  switchMode(mode) {
    currentPostingMode = mode;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('posting-url-input').classList.toggle('hidden', mode !== 'url');
    document.getElementById('posting-text-input').classList.toggle('hidden', mode !== 'text');
  }
};

const Analysis = {
  async run() {
    const docId = document.getElementById('analysis-doc-select').value;
    if (!docId) return Toast.show('이력서를 먼저 선택해주세요', 'error');

    let postingContent = '';
    let postingUrl = '';

    if (currentPostingMode === 'url') {
      postingUrl = document.getElementById('posting-url').value.trim();
      if (!postingUrl) return Toast.show('채용 공고 URL을 입력해주세요', 'error');
    } else {
      postingContent = document.getElementById('posting-text').value.trim();
      if (!postingContent) return Toast.show('채용 공고 내용을 입력해주세요', 'error');
    }

    const companyUrl = document.getElementById('company-url').value.trim();

    Loading.show('채용 공고를 분석하고 있어요...');

    try {
      // 이력서 정보 가져오기
      const allDocs = await DocDB.list('resume');
      const doc = allDocs.find(d => d.id === docId);
      if (!doc) throw new Error('이력서를 찾을 수 없어요');

      // 이력서 분석 결과 가져오기
      const docAnalysis = await DocAnalysisDB.getLatest(docId);

      // 이력서 PDF 가져오기
      const fileUrl = await DocDB.getFileUrl(doc.file_path);
      const resp = await fetch(fileUrl);
      const blob = await resp.blob();
      const resumeBase64 = await fileToBase64(new File([blob], doc.file_name, { type: 'application/pdf' }));

      // 채용 공고 텍스트 가져오기
      if (currentPostingMode === 'url') {
        Loading.show('채용 공고 페이지를 불러오고 있어요...');
        try {
          postingContent = await fetchUrlText(postingUrl);
        } catch (e) {
          // URL 파싱 실패시 fallback 안내
          Loading.hide();
          const useManual = confirm('URL에서 공고 내용을 자동으로 불러오지 못했어요. 직접 내용을 붙여넣어 진행할까요?');
          if (useManual) {
            PostingInput.switchMode('text');
            return;
          }
          throw new Error('채용 공고를 불러올 수 없어요. 직접 입력 방식을 사용해주세요.');
        }
      }

      // 회사 홈페이지 내용 (선택)
      let companyContent = '';
      if (companyUrl) {
        Loading.show('회사 정보를 확인하고 있어요...');
        try {
          companyContent = await fetchUrlText(companyUrl);
        } catch {}
      }

      Loading.show('AI가 합격 가능성을 분석하고 있어요...');

      // AI 분석
      const result = await this.runAI({
        doc, docAnalysis,
        resumeBase64,
        postingContent,
        postingUrl,
        companyContent,
        companyUrl
      });

      // 저장
      const saved = await PostingAnalysisDB.save({
        document_id: docId,
        posting_url: postingUrl || null,
        posting_text: postingContent,
        company_url: companyUrl || null,
        company_name: result.company_name || null,
        position_name: result.position_name || null,
        fit_scores: result.fit_scores,
        final_recommendation: result.final_recommendation
      });

      // 렌더링
      this.renderResult(result, saved.created_at);
      await this.loadHistory();
      Toast.show('분석 완료!', 'success');

    } catch (e) {
      console.error(e);
      Toast.show('분석 중 오류가 발생했어요: ' + e.message, 'error');
    } finally {
      Loading.hide();
    }
  },

  async runAI({ doc, docAnalysis, resumeBase64, postingContent, companyContent }) {
    const response = await fetch(`${EDGE_FUNCTION_URL}/analyze-posting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ doc, docAnalysis, resumeBase64, postingContent, companyContent })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'AI 분석 실패');
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  },

  renderResult(result, createdAt) {
    const emptyEl = document.getElementById('analysis-result-empty');
    const contentEl = document.getElementById('analysis-result-content');

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const date = new Date(createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const scores = result.fit_scores || [];
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b.score, 0) / scores.length).toFixed(1) : '-';

    let html = `
      <div class="result-header">
        <div class="result-doc-info">
          <h3>${result.company_name || '회사명 미확인'} · ${result.position_name || '포지션 미확인'}</h3>
          <div class="result-doc-meta">평균 fit 점수: ${avgScore} / 5.0</div>
        </div>
        <div class="result-date">${date}</div>
      </div>

      <div class="score-overview">
        ${scores.map(s => `
          <div class="score-card">
            <div class="score-card-label">${s.category}</div>
            <div class="score-card-value">${s.score}.0</div>
            <div class="star-row">${this.renderStars(s.score)}</div>
          </div>
        `).join('')}
      </div>

      <div class="feedback-section">
        <div class="feedback-section-title">카테고리별 분석</div>
        ${scores.map(s => `
          <div class="feedback-item">
            <div class="feedback-item-header">
              <span class="feedback-item-label">${s.category}</span>
              <span class="feedback-badge ${this.scoreBadge(s.score)}">${s.score}점</span>
            </div>
            <div class="feedback-item-text">${s.comment}</div>
          </div>
        `).join('')}
      </div>

      <div class="final-recommendation">
        <h4>✦ 최종 제안</h4>
        <p>${result.final_recommendation}</p>
      </div>
    `;

    contentEl.innerHTML = html;
  },

  renderStars(score) {
    return Array.from({ length: 5 }, (_, i) =>
      `<span class="star ${i < score ? 'filled' : 'empty'}">★</span>`
    ).join('');
  },

  scoreBadge(score) {
    if (score >= 4) return 'badge-good';
    if (score >= 3) return 'badge-improve';
    return 'badge-critical';
  },

  async loadHistory() {
    const listEl = document.getElementById('history-list');
    try {
      const records = await PostingAnalysisDB.list();
      if (records.length === 0) {
        listEl.innerHTML = '<p class="history-empty">아직 분석 기록이 없어요</p>';
        return;
      }
      listEl.innerHTML = records.map(r => {
        const scores = r.fit_scores || [];
        const avg = scores.length ? (scores.reduce((a, b) => a + b.score, 0) / scores.length).toFixed(1) : '-';
        const date = new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        return `<div class="history-item" onclick="Analysis.loadRecord('${r.id}')">
          <div class="history-item-info">
            <div class="history-item-title">${r.company_name || '?'} · ${r.position_name || '포지션 미확인'}</div>
            <div class="history-item-meta">${date}</div>
          </div>
          <div class="history-item-score">★ ${avg}</div>
        </div>`;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async loadRecord(id) {
    try {
      const record = await PostingAnalysisDB.get(id);
      this.renderResult({
        company_name: record.company_name,
        position_name: record.position_name,
        fit_scores: record.fit_scores,
        final_recommendation: record.final_recommendation
      }, record.created_at);
    } catch (e) {
      Toast.show('기록을 불러오지 못했어요', 'error');
    }
  }
};
