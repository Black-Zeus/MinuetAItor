/**
 * =====================================================
 * MinuetAItor - Modal System
 * Sistema de modales para Nueva Reunión
 * =====================================================
 */

// =====================================================
// ESTADO GLOBAL
// =====================================================
const ModalState = {
  formData: {},
  files: {
    transcripcion: null,
    resumen: null,
    complementos: []
  }
};

// =====================================================
// INICIALIZACIÓN
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
  initModalSystem();
});

// =====================================================
// INICIALIZAR SISTEMA DE MODALES
// =====================================================
function initModalSystem() {
  console.log('✓ Sistema de modales inicializado');
  
  // Usar delegación de eventos para manejar botones de contenido dinámico
  document.addEventListener('click', function(e) {
    console.log('Click detectado en:', e.target);
    
    // Buscar si el elemento clickeado o algún padre es el botón
    const button = e.target.closest('#btnNuevaMinuta');
    if (button) {
      console.log('✓ Botón Nueva Minuta detectado, abriendo modal...');
      e.preventDefault();
      e.stopPropagation();
      openNewMeetingModal();
    }
  });

  // También intentar agregar listener directo después de que el contenido cargue
  setTimeout(() => {
    const btn = document.getElementById('btnNuevaMinuta');
    if (btn) {
      console.log('✓ Botón encontrado directamente:', btn);
      btn.addEventListener('click', function(e) {
        console.log('✓ Click directo en botón Nueva Minuta');
        e.preventDefault();
        e.stopPropagation();
        openNewMeetingModal();
      });
    } else {
      console.warn('⚠ Botón btnNuevaMinuta no encontrado todavía');
    }
  }, 2000);
}

// =====================================================
// MODAL: NUEVA REUNIÓN
// =====================================================
function openNewMeetingModal() {
  console.log('📋 Abriendo modal Nueva Minuta...');
  
  // Obtener usuario logueado (simulado)
  const currentUser = 'John Doe';
  
  const modalHTML = `
    <div class="modal-backdrop" id="newMeetingModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Nueva Minuta</h2>
          <button class="modal-close" onclick="closeModal('newMeetingModal')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <form id="newMeetingForm">
            <!-- Transcripción -->
            <div class="file-upload-section">
              <label class="file-upload-label">Transcripción *</label>
              <div class="file-upload-area" onclick="document.getElementById('transcripcionFile').click()">
                <input type="file" id="transcripcionFile" accept=".txt,.doc,.docx,.pdf" onchange="handleFileUpload(event, 'transcripcion')" required>
                <svg class="file-upload-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p class="file-upload-text">
                  <strong>Haz clic para seleccionar</strong> o arrastra el archivo aquí<br>
                  <small>Formatos: TXT, DOC, DOCX, PDF</small>
                </p>
              </div>
              <div id="transcripcionFileList" class="file-list"></div>
            </div>

            <!-- Resumen -->
            <div class="file-upload-section">
              <label class="file-upload-label">Resumen *</label>
              <div class="file-upload-area" onclick="document.getElementById('resumenFile').click()">
                <input type="file" id="resumenFile" accept=".txt,.doc,.docx,.pdf" onchange="handleFileUpload(event, 'resumen')" required>
                <svg class="file-upload-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="file-upload-text">
                  <strong>Haz clic para seleccionar</strong> o arrastra el archivo aquí<br>
                  <small>Formatos: TXT, DOC, DOCX, PDF</small>
                </p>
              </div>
              <div id="resumenFileList" class="file-list"></div>
            </div>

            <!-- Complementos -->
            <div class="file-upload-section">
              <label class="file-upload-label">Complementos (Opcional)</label>
              <div class="file-upload-area" onclick="document.getElementById('complementosFile').click()">
                <input type="file" id="complementosFile" accept=".pdf,.doc,.docx,.xlsx,.pptx" multiple onchange="handleFileUpload(event, 'complementos')">
                <svg class="file-upload-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <p class="file-upload-text">
                  <strong>Haz clic para seleccionar</strong> o arrastra los archivos aquí<br>
                  <small>Múltiples archivos permitidos</small>
                </p>
              </div>
              <div id="complementosFileList" class="file-list"></div>
            </div>

            <!-- Cliente -->
            <div class="form-group">
              <label for="cliente" class="form-label">Cliente *</label>
              <select id="cliente" name="cliente" class="form-input" required>
                <option value="">Seleccione un cliente</option>
                <option value="cliente1">Acme Corporation</option>
                <option value="cliente2">Tech Solutions Inc.</option>
                <option value="cliente3">Global Industries Ltd.</option>
                <option value="cliente4">Innovation Partners</option>
                <option value="cliente5">Digital Ventures SA</option>
              </select>
            </div>

            <!-- Fechas -->
            <div class="form-grid">
              <div class="form-group">
                <label for="fechaProgramada" class="form-label">Fecha Programada *</label>
                <input type="datetime-local" id="fechaProgramada" name="fechaProgramada" class="form-input" required>
              </div>

              <div class="form-group">
                <label for="fechaInicio" class="form-label">Fecha/Hora Inicio Real *</label>
                <input type="datetime-local" id="fechaInicio" name="fechaInicio" class="form-input" required>
              </div>
            </div>

            <!-- Responsable -->
            <div class="form-group">
              <label for="responsable" class="form-label">Responsable de Redacción *</label>
              <select id="responsable" name="responsable" class="form-input" required>
                <option value="current" selected>${currentUser} (Yo)</option>
                <option value="user1">María Pérez</option>
                <option value="user2">Carlos Rodríguez</option>
                <option value="user3">Ana Silva</option>
                <option value="user4">Luis Martínez</option>
              </select>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal('newMeetingModal')">
            Cancelar
          </button>
          <button type="button" class="btn btn-primary" onclick="validateAndConfirm()">
            Procesar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  console.log('✓ Modal HTML insertado en el DOM');
  
  const modalElement = document.getElementById('newMeetingModal');
  console.log('✓ Modal element:', modalElement);
  
  setTimeout(() => {
    modalElement.classList.add('show');
    console.log('✓ Clase "show" agregada al modal');
  }, 10);

  // Cerrar con ESC
  document.addEventListener('keydown', handleEscapeKey);
}

// =====================================================
// MANEJO DE ARCHIVOS
// =====================================================
function handleFileUpload(event, type) {
  const files = event.target.files;
  
  if (type === 'complementos') {
    // Múltiples archivos
    Array.from(files).forEach(file => {
      ModalState.files.complementos.push(file);
    });
    renderFileList('complementos', ModalState.files.complementos);
  } else {
    // Un solo archivo
    ModalState.files[type] = files[0];
    renderFileList(type, [files[0]]);
  }
}

function renderFileList(type, files) {
  const listId = type + 'FileList';
  const listElement = document.getElementById(listId);
  
  if (!listElement) return;

  listElement.innerHTML = '';
  
  files.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <div class="file-item-info">
        <svg class="file-item-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span class="file-item-name">${file.name}</span>
      </div>
      <button type="button" class="file-item-remove" onclick="removeFile('${type}', ${index})">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;
    listElement.appendChild(fileItem);
  });
}

function removeFile(type, index) {
  if (type === 'complementos') {
    ModalState.files.complementos.splice(index, 1);
    renderFileList('complementos', ModalState.files.complementos);
  } else {
    ModalState.files[type] = null;
    renderFileList(type, []);
    // Limpiar input
    document.getElementById(type + 'File').value = '';
  }
}

// =====================================================
// VALIDACIÓN Y CONFIRMACIÓN
// =====================================================
function validateAndConfirm() {
  const form = document.getElementById('newMeetingForm');
  
  // Validar formulario
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Validar archivos requeridos
  if (!ModalState.files.transcripcion) {
    window.MinuetAItor.showNotification('Debe adjuntar la transcripción', 'error');
    return;
  }

  if (!ModalState.files.resumen) {
    window.MinuetAItor.showNotification('Debe adjuntar el resumen', 'error');
    return;
  }

  // Guardar datos del formulario
  ModalState.formData = {
    cliente: document.getElementById('cliente').value,
    fechaProgramada: document.getElementById('fechaProgramada').value,
    fechaInicio: document.getElementById('fechaInicio').value,
    responsable: document.getElementById('responsable').value
  };

  // Cerrar modal actual y abrir confirmación
  closeModal('newMeetingModal');
  openConfirmationModal();
}

// =====================================================
// MODAL: CONFIRMACIÓN
// =====================================================
function openConfirmationModal() {
  const clienteText = document.getElementById('cliente').selectedOptions[0].text;
  const responsableText = document.getElementById('responsable').selectedOptions[0].text;
  const complementosCount = ModalState.files.complementos.length;

  const modalHTML = `
    <div class="modal-backdrop" id="confirmationModal">
      <div class="modal modal-confirmation">
        <div class="modal-header">
          <h2 class="modal-title">Confirmar Procesamiento</h2>
          <button class="modal-close" onclick="closeConfirmationAndReturn()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="confirmation-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <p class="confirmation-text">
            Se va a procesar la minuta con los siguientes datos:<br><br>
            <strong>Cliente:</strong> ${clienteText}<br>
            <strong>Responsable:</strong> ${responsableText}<br>
            <strong>Archivos:</strong> Transcripción, Resumen${complementosCount > 0 ? ' y ' + complementosCount + ' complemento(s)' : ''}<br><br>
            ¿Está de acuerdo en continuar?
          </p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeConfirmationAndReturn()">
            Cancelar
          </button>
          <button type="button" class="btn btn-primary" onclick="processRequest()">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  setTimeout(() => {
    document.getElementById('confirmationModal').classList.add('show');
  }, 10);
}

function closeConfirmationAndReturn() {
  closeModal('confirmationModal');
  setTimeout(() => {
    openNewMeetingModal();
  }, 200);
}

// =====================================================
// PROCESAMIENTO
// =====================================================
function processRequest() {
  closeModal('confirmationModal');
  
  // Mostrar toast
  window.MinuetAItor.showNotification('Procesamiento iniciado', 'info');
  
  // Abrir modal de procesamiento
  openProcessingModal();
}

// =====================================================
// MODAL: PROCESAMIENTO
// =====================================================
function openProcessingModal() {
  const modalHTML = `
    <div class="modal-backdrop show" id="processingModal">
      <div class="modal modal-processing">
        <div class="modal-body">
          <div class="processing-spinner"></div>
          <p class="processing-text">Procesando minuta...</p>
          <p class="processing-subtext">Será notificado cuando el proceso termine</p>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Cerrar automáticamente después de 5 segundos
  setTimeout(() => {
    closeModal('processingModal');
    
    // Mostrar notificación de éxito
    setTimeout(() => {
      window.MinuetAItor.showNotification('Minuta procesada correctamente. Recibirá una notificación con los resultados.', 'success');
      
      // Limpiar estado
      ModalState.formData = {};
      ModalState.files = {
        transcripcion: null,
        resumen: null,
        complementos: []
      };
    }, 300);
  }, 5000);
}

// =====================================================
// UTILIDADES
// =====================================================
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove('show');
  
  setTimeout(() => {
    modal.remove();
  }, 200);

  // Remover listener de ESC
  document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    // Cerrar el último modal abierto
    const modals = document.querySelectorAll('.modal-backdrop.show');
    if (modals.length > 0) {
      const lastModal = modals[modals.length - 1];
      lastModal.classList.remove('show');
      setTimeout(() => lastModal.remove(), 200);
    }
  }
}

// =====================================================
// EXPORT FUNCTIONS
// =====================================================
window.ModalSystem = {
  openNewMeetingModal,
  closeModal,
  validateAndConfirm,
  processRequest
};