// ===== APP.JS — 메인 컨트롤러 =====

// ===== 네비게이션 =====
const App = {
  currentPage: 'documents',

  navigate(page) {
    // 공고 분석은 이력서 등록 후만 가능
    if (page === 'analysis') {
      const select = document.getElementById('analysis-doc-select');
      if (!select.value && select.options.length <= 1) {
        Toast.show('STEP 01에서 이력서를 먼저 등록해주세요', 'error');
        return;
      }
    }

    this.currentPage = page;

    // 페이지 전환
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // 네비게이션 버튼 상태
    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.step === page);
    });
  },

  async init() {
    await Session.ensureSession();
    await Documents.renderList();
    await Documents.refreshAnalysisSelect();
    await Analysis.loadHistory();

    // 드래그앤드롭 설정
    this.setupDragDrop();

    // STEP 02 버튼 상태 설정
    this.updateStep2Nav();
  },

  updateStep2Nav() {
    const select = document.getElementById('analysis-doc-select');
    const navBtn = document.getElementById('nav-analysis');
    if (navBtn) {
      navBtn.disabled = !select.value && select.options.length <= 1;
    }
  },

  setupDragDrop() {
    const dropZone = document.getElementById('file-drop');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent)';
      dropZone.style.background = 'var(--accent-dim)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '';
      dropZone.style.background = '';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      dropZone.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file) {
        // file-input에 할당 후 이벤트 트리거
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('file-input').files = dt.files;
        DocumentModal.handleFile({ target: { files: [file] } });
      }
    });
  }
};

// ===== 로딩 =====
const Loading = {
  show(text = 'AI가 분석하고 있어요...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
  },
  hide() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }
};

// ===== 토스트 =====
const Toast = {
  show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

// ===== 앱 시작 =====
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
