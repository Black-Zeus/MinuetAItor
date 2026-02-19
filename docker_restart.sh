#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# restart-docker-stack.sh
# EndeavourOS/Arch: reinicia Docker Engine + Docker Desktop
# - Soporta Docker system-wide (systemctl) y rootless (systemctl --user)
# - Soporta Docker Desktop como binario o Flatpak
# ------------------------------------------------------------

log()  { printf "\n\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[ERR ]\033[0m %s\n" "$*"; }

have() { command -v "$1" >/dev/null 2>&1; }

SUDO=""
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  if have sudo; then
    SUDO="sudo"
  else
    warn "No eres root y no existe sudo. Algunas acciones pueden fallar."
  fi
fi

# Detecta si docker CLI existe
if ! have docker; then
  warn "docker CLI no está disponible en PATH. ¿Docker está instalado?"
fi

# Helper: verifica si una unidad systemd existe
unit_exists_system() {
  systemctl list-unit-files "$1" >/dev/null 2>&1
}
unit_exists_user() {
  systemctl --user list-unit-files "$1" >/dev/null 2>&1
}

restart_docker_engine() {
  log "Reiniciando Docker Engine (daemon)..."

  # 1) Intento system-wide (docker.service)
  if have systemctl && unit_exists_system docker.service; then
    log "Detectado docker.service (system-wide). Reiniciando..."
    $SUDO systemctl daemon-reload || true
    $SUDO systemctl restart docker.service

    # Si existe docker.socket, lo reiniciamos también (algunas instalaciones lo usan)
    if unit_exists_system docker.socket; then
      log "Reiniciando docker.socket..."
      $SUDO systemctl restart docker.socket || true
    fi

    $SUDO systemctl --no-pager --full status docker.service || true
    return 0
  fi

  # 2) Intento rootless (usuario)
  if have systemctl && unit_exists_user docker.service; then
    log "Detectado docker.service (rootless / user). Reiniciando..."
    systemctl --user daemon-reload || true
    systemctl --user restart docker.service

    if unit_exists_user docker.socket; then
      log "Reiniciando docker.socket (user)..."
      systemctl --user restart docker.socket || true
    fi

    systemctl --user --no-pager --full status docker.service || true
    return 0
  fi

  warn "No se detectó docker.service (system-wide ni user). Intentando reinicio por proceso (fallback)..."

  # Fallback: matar dockerd si existiera (no siempre aplica)
  if pgrep -x dockerd >/dev/null 2>&1; then
    warn "dockerd está corriendo sin unidad systemd visible; intentando terminarlo..."
    $SUDO pkill -TERM dockerd || true
    sleep 2
  fi

  warn "Sin unidad systemd no puedo garantizar el reinicio del daemon. Revisa tu instalación."
  return 0
}

stop_docker_desktop_process() {
  # Cierra el proceso Docker Desktop si está abierto (Linux)
  if pgrep -f "docker-desktop" >/dev/null 2>&1; then
    log "Cerrando procesos de Docker Desktop..."
    pkill -TERM -f "docker-desktop" || true
    sleep 2
    if pgrep -f "docker-desktop" >/dev/null 2>&1; then
      warn "Docker Desktop no cerró con TERM; forzando..."
      pkill -KILL -f "docker-desktop" || true
      sleep 1
    fi
  else
    log "No se detectan procesos 'docker-desktop' en ejecución."
  fi
}

restart_docker_desktop_service_if_any() {
  # Algunas instalaciones crean unidad systemd "docker-desktop"
  if have systemctl && unit_exists_system docker-desktop.service; then
    log "Detectado docker-desktop.service (system-wide). Reiniciando..."
    $SUDO systemctl restart docker-desktop.service || true
    $SUDO systemctl --no-pager --full status docker-desktop.service || true
    return 0
  fi

  if have systemctl && unit_exists_user docker-desktop.service; then
    log "Detectado docker-desktop.service (user). Reiniciando..."
    systemctl --user restart docker-desktop.service || true
    systemctl --user --no-pager --full status docker-desktop.service || true
    return 0
  fi

  log "No se detectó unidad systemd docker-desktop.service."
  return 0
}

start_docker_desktop_app() {
  # 1) Binario directo
  if have docker-desktop; then
    log "Iniciando Docker Desktop (binario docker-desktop) en background..."
    nohup docker-desktop >/dev/null 2>&1 &
    disown || true
    return 0
  fi

  # 2) Flatpak (común en Linux)
  if have flatpak; then
    # App ID típico: com.docker.desktop
    if flatpak info com.docker.desktop >/dev/null 2>&1; then
      log "Iniciando Docker Desktop vía Flatpak (com.docker.desktop) en background..."
      nohup flatpak run com.docker.desktop >/dev/null 2>&1 &
      disown || true
      return 0
    fi
  fi

  warn "No encuentro cómo iniciar Docker Desktop (ni binario docker-desktop ni Flatpak com.docker.desktop)."
  warn "Si lo instalaste por otro método, dime cómo (AUR, paquete oficial, flatpak) y lo adapto."
  return 0
}

verify_docker() {
  if ! have docker; then
    warn "No puedo verificar: docker CLI no está disponible."
    return 0
  fi

  log "Verificando estado Docker..."
  if docker info >/dev/null 2>&1; then
    log "Docker responde correctamente: OK"
  else
    warn "docker info falló. Para diagnóstico rápido:"
    echo "  - (system-wide)  sudo journalctl -u docker --no-pager -n 200"
    echo "  - (rootless)     journalctl --user -u docker --no-pager -n 200"
    echo "  - socket perms   ls -l /var/run/docker.sock"
    echo "  - contexto       docker context ls"
  fi
}

main() {
  log "Inicio: reinicio Docker Engine + Docker Desktop (EndeavourOS/Arch)"
  restart_docker_engine

  log "Docker Desktop: cierre + reinicio (si aplica)"
  stop_docker_desktop_process
  restart_docker_desktop_service_if_any
  start_docker_desktop_app

  verify_docker
  log "Listo."
}

main "$@"
