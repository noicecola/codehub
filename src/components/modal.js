class ModalManager {
  constructor() {
    this.activeModal = null;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) this.close(this.activeModal);
    });
  }

  open(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    this.activeModal = modal;
  }

  close(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    if (this.activeModal === modal) this.activeModal = null;
  }

  closeById(id) {
    this.close(document.getElementById(id));
  }

  init() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close(modal);
      });
    });
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeById(btn.dataset.close));
    });
  }
}

window.modalManager = new ModalManager();
