/**
 * MinuetAItor - Sistema de Modales SIMPLE
 */

// Estado global
const ModalState = {
  formData: {},
  files: {
    transcripcion: null,
    resumen: null,
    complementos: []
  }
};

// =====================================================
// FUNCIÓN PRINCIPAL - ABRIR MODAL NUEVA MINUTA
// =====================================================
function abrirModalNuevaMinuta() {
  console.log('Abriendo modal Nueva Minuta...');
  
  const modalHTML = `
    <div class="modal-backdrop show" id="modalNuevaMinuta">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Nueva Minuta</h2>
          <button class="modal-close" onclick="cerrarModal('modalNuevaMinuta')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <form id="formNuevaMinuta">
            <!-- Transcripción -->
            <div class="form-group">
              <label class="form-label">Transcripción *</label>
              <div class="file-upload-compact" onclick="document.getElementById('archivoTranscripcion').click()">
                <input type="file" id="archivoTranscripcion" accept=".txt,.doc,.docx,.pdf" style="display:none" required>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 20px; height: 20px; flex-shrink: 0;">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span style="flex: 1;">Seleccionar archivo</span>
                <span style="font-size: 12px; color: var(--text-muted);">TXT, DOC, PDF</span>
              </div>
              <div id="listaTranscripcion" class="file-list"></div>
            </div>

            <!-- Resumen -->
            <div class="form-group">
              <label class="form-label">Resumen *</label>
              <div class="file-upload-compact" onclick="document.getElementById('archivoResumen').click()">
                <input type="file" id="archivoResumen" accept=".txt,.doc,.docx,.pdf" style="display:none" required>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 20px; height: 20px; flex-shrink: 0;">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span style="flex: 1;">Seleccionar archivo</span>
                <span style="font-size: 12px; color: var(--text-muted);">TXT, DOC, PDF</span>
              </div>
              <div id="listaResumen" class="file-list"></div>
            </div>

            <!-- Complementos -->
            <div class="form-group">
              <label class="form-label">Complementos (Opcional)</label>
              <div class="file-upload-compact" onclick="document.getElementById('archivoComplementos').click()">
                <input type="file" id="archivoComplementos" accept=".pdf,.doc,.docx,.xlsx,.pptx" multiple style="display:none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 20px; height: 20px; flex-shrink: 0;">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span style="flex: 1;">Seleccionar archivos</span>
                <span style="font-size: 12px; color: var(--text-muted);">Múltiples</span>
              </div>
              <div id="listaComplementos" class="file-list"></div>
            </div>

            <!-- Cliente -->
            <div class="form-group">
              <label for="cliente" class="form-label">Cliente *</label>
              <select id="cliente" class="form-input" required>
                <option value="">Seleccione un cliente</option>
                <option value="cliente1">Acme Corporation</option>
                <option value="cliente2">Tech Solutions Inc.</option>
                <option value="cliente3">Global Industries Ltd.</option>
                <option value="cliente4">Innovation Partners</option>
                <option value="cliente5">Digital Ventures SA</option>
              </select>
            </div>

            <!-- Fechas Programadas -->
            <div class="form-grid">
              <div class="form-group">
                <label for="fechaInicioProg" class="form-label">Fecha Inicio Programada *</label>
                <input type="date" id="fechaInicioProg" class="form-input" required>
              </div>
              <div class="form-group">
                <label for="horaInicioProg" class="form-label">Hora Inicio *</label>
                <input type="time" id="horaInicioProg" class="form-input" required>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label for="fechaTerminoProg" class="form-label">Fecha Término Programada *</label>
                <input type="date" id="fechaTerminoProg" class="form-input" required>
              </div>
              <div class="form-group">
                <label for="horaTerminoProg" class="form-label">Hora Término *</label>
                <input type="time" id="horaTerminoProg" class="form-input" required>
              </div>
            </div>

            <!-- Fecha Inicio Real -->
            <div class="form-grid">
              <div class="form-group">
                <label for="fechaInicioReal" class="form-label">Fecha Inicio Real *</label>
                <input type="date" id="fechaInicioReal" class="form-input" required>
              </div>
              <div class="form-group">
                <label for="horaInicioReal" class="form-label">Hora Inicio Real *</label>
                <input type="time" id="horaInicioReal" class="form-input" required>
              </div>
            </div>

            <!-- Responsable -->
            <div class="form-group">
              <label for="responsable" class="form-label">Responsable de Redacción *</label>
              <select id="responsable" class="form-input" required>
                <option value="current" selected>John Doe (Yo)</option>
                <option value="user1">María Pérez</option>
                <option value="user2">Carlos Rodríguez</option>
                <option value="user3">Ana Silva</option>
                <option value="user4">Luis Martínez</option>
              </select>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="cerrarModal('modalNuevaMinuta')">Cancelar</button>
          <button type="button" class="btn btn-primary" onclick="validarYConfirmar()">Procesar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Listeners para archivos
  document.getElementById('archivoTranscripcion').onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      ModalState.files.transcripcion = file;
      mostrarArchivo('listaTranscripcion', file);
    }
  };
  
  document.getElementById('archivoResumen').onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      ModalState.files.resumen = file;
      mostrarArchivo('listaResumen', file);
    }
  };
  
  document.getElementById('archivoComplementos').onchange = function(e) {
    const newFiles = Array.from(e.target.files);
    ModalState.files.complementos.push(...newFiles);
    mostrarArchivos('listaComplementos', ModalState.files.complementos);
  };
  
  console.log('Modal insertado y visible');
}

// =====================================================
// CERRAR MODAL
// =====================================================
function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
}

// =====================================================
// MOSTRAR ARCHIVOS
// =====================================================
function mostrarArchivo(containerId, file) {
  const container = document.getElementById(containerId);
  if (!file || !container) return;
  
  container.innerHTML = `
    <div class="file-item">
      <div class="file-item-info">
        <svg class="file-item-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="file-item-name">${file.name}</span>
      </div>
      <button type="button" class="file-item-remove" onclick="eliminarArchivo('${containerId}')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `;
}

function mostrarArchivos(containerId, files) {
  const container = document.getElementById(containerId);
  if (!files || !container) return;
  
  container.innerHTML = files.map((file, index) => `
    <div class="file-item">
      <div class="file-item-info">
        <svg class="file-item-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="file-item-name">${file.name}</span>
      </div>
      <button type="button" class="file-item-remove" onclick="eliminarArchivoComplemento(${index})">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `).join('');
}

// Eliminar archivo único (transcripción o resumen)
function eliminarArchivo(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
  
  // Limpiar el input correspondiente
  if (containerId === 'listaTranscripcion') {
    document.getElementById('archivoTranscripcion').value = '';
    ModalState.files.transcripcion = null;
  } else if (containerId === 'listaResumen') {
    document.getElementById('archivoResumen').value = '';
    ModalState.files.resumen = null;
  }
}

// Eliminar complemento específico
function eliminarArchivoComplemento(index) {
  ModalState.files.complementos.splice(index, 1);
  mostrarArchivos('listaComplementos', ModalState.files.complementos);
}

// =====================================================
// VALIDAR Y CONFIRMAR
// =====================================================
function validarYConfirmar() {
  const form = document.getElementById('formNuevaMinuta');
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const transcripcion = document.getElementById('archivoTranscripcion').files[0];
  const resumen = document.getElementById('archivoResumen').files[0];
  
  if (!transcripcion) {
    mostrarNotificacion('Debe adjuntar el archivo de transcripción', 'error');
    return;
  }

  if (!resumen) {
    mostrarNotificacion('Debe adjuntar el archivo de resumen', 'error');
    return;
  }

  // Guardar datos
  ModalState.formData = {
    cliente: document.getElementById('cliente').value,
    fechaInicioProg: document.getElementById('fechaInicioProg').value,
    horaInicioProg: document.getElementById('horaInicioProg').value,
    fechaTerminoProg: document.getElementById('fechaTerminoProg').value,
    horaTerminoProg: document.getElementById('horaTerminoProg').value,
    fechaInicioReal: document.getElementById('fechaInicioReal').value,
    horaInicioReal: document.getElementById('horaInicioReal').value,
    responsable: document.getElementById('responsable').value,
    clienteText: document.getElementById('cliente').selectedOptions[0].text,
    responsableText: document.getElementById('responsable').selectedOptions[0].text
  };

  ModalState.files.transcripcion = transcripcion;
  ModalState.files.resumen = resumen;

  // Cerrar modal actual
  cerrarModal('modalNuevaMinuta');
  
  // Esperar a que se cierre antes de abrir el siguiente
  setTimeout(() => {
    abrirModalConfirmacion();
  }, 300);
}

// =====================================================
// MODAL CONFIRMACIÓN
// =====================================================
function abrirModalConfirmacion() {
  const data = ModalState.formData;
  const complementosCount = ModalState.files.complementos.length;
  
  const modalHTML = `
    <div class="modal-backdrop show" id="modalConfirmacion">
      <div class="modal modal-confirmation">
        <div class="modal-header">
          <h2 class="modal-title">Confirmar Procesamiento</h2>
          <button class="modal-close" onclick="volverAlFormulario()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="confirmation-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <p class="confirmation-title">¿Procesar esta minuta?</p>
          
          <div class="confirmation-details">
            <div class="detail-row">
              <div class="detail-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div class="detail-content">
                <span class="detail-label">Cliente</span>
                <span class="detail-value">${data.clienteText}</span>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="detail-content">
                <span class="detail-label">Responsable</span>
                <span class="detail-value">${data.responsableText}</span>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div class="detail-content">
                <span class="detail-label">Archivos</span>
                <span class="detail-value">Transcripción, Resumen${complementosCount > 0 ? ' + ' + complementosCount + ' complemento(s)' : ''}</span>
              </div>
            </div>

            <div class="detail-divider"></div>

            <div class="detail-row">
              <div class="detail-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="detail-content">
                <span class="detail-label">Programada</span>
                <span class="detail-value">${formatearFecha(data.fechaInicioProg)} ${data.horaInicioProg} - ${formatearFecha(data.fechaTerminoProg)} ${data.horaTerminoProg}</span>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="detail-content">
                <span class="detail-label">Inicio Real</span>
                <span class="detail-value">${formatearFecha(data.fechaInicioReal)} ${data.horaInicioReal}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="volverAlFormulario()">Cancelar</button>
          <button type="button" class="btn btn-primary" onclick="procesarMinuta()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 18px; height: 18px; margin-right: 8px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Aceptar y Procesar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Formatear fecha para mejor visualización
function formatearFecha(fecha) {
  const [year, month, day] = fecha.split('-');
  return `${day}/${month}/${year}`;
}

function volverAlFormulario() {
  cerrarModal('modalConfirmacion');
  abrirModalNuevaMinuta();
}

// =====================================================
// PROCESAR MINUTA
// =====================================================
function procesarMinuta() {
  cerrarModal('modalConfirmacion');
  
  // Toast
  mostrarNotificacion('Procesamiento iniciado', 'info');
  
  // Modal de procesamiento
  const modalHTML = `
    <div class="modal-backdrop show" id="modalProcesando">
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

  setTimeout(() => {
    cerrarModal('modalProcesando');
    mostrarNotificacion('Minuta procesada correctamente. Recibirá una notificación con los resultados.', 'success');
  }, 5000);
}

// =====================================================
// NOTIFICACIÓN TOAST
// =====================================================
function mostrarNotificacion(mensaje, tipo = 'info') {
  const colores = {
    success: 'var(--color-success-600)',
    error: 'var(--color-danger-600)',
    warning: 'var(--color-warning-600)',
    info: 'var(--color-info-600)'
  };

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background-color: var(--bg-surface);
    color: var(--text-primary);
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    border-left: 4px solid ${colores[tipo]};
    z-index: 9999;
    max-width: 400px;
    font-size: 14px;
  `;

  notification.textContent = mensaje;
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 3000);
}