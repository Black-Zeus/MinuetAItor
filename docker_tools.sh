#!/bin/bash

# Función para leer PROJECT_NAME desde .env
read_project_name() {
    local env_file=".env"
    
    if [[ -f "$env_file" ]]; then
        local project_line=$(grep "^PROJECT_NAME=" "$env_file" 2>/dev/null)
        if [[ -n "$project_line" ]]; then
            echo "$project_line" | cut -d'=' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//'
        else
            echo ""
        fi
    else
        echo ""
    fi
}


# Variables iniciales
ENV="dev"

# Leer PROJECT_NAME desde .env, usar "Inventario" como fallback
PROJECT_NAME=$(read_project_name)
STACK="${PROJECT_NAME:-NoExiteStackName}"

LABEL_FILTER="stack=${STACK}"
COMPOSE_FILE=""
CURRENT_IP=""

#############################################################
###                      Banners
#############################################################
banner_menu_ambiente(){
  local current_ip
  if [[ -n "$CURRENT_IP" ]]; then
    current_ip="$CURRENT_IP"
  else
    current_ip=$(get_current_ip)
    if [[ -n "$current_ip" ]]; then
      CURRENT_IP="$current_ip"
    else
      current_ip="No detectada"
    fi
  fi

  local git_branch="No es repositorio Git"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  fi

  echo "Archivo de configuración: $COMPOSE_FILE"
  echo "Stack: $STACK"
  echo "Entorno: $ENV"
  echo "IP Actual: $current_ip"
  echo "Rama Git: $git_branch"
}

#############################################################
###                      Menus
#############################################################

# Menú principal
menu() {
  clear
  define_compose_file
  
  echo "======================================="
  echo "Docker Tools - Menu Principal"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. 📋 MANEJADOR DE CONTENEDORES"
  echo " 2. 📊 MONITOREO Y DIAGNÓSTICO"
  echo " 3. 🧹 LIMPIEZA Y MANTENIMIENTO"
  echo " 4. ⚙️ CONFIGURACIÓN DEL SISTEMA"
  echo " 5. 📱 HERRAMIENTAS EXPO"
  echo " 6. 📄 GESTIÓN DE TEMPLATES .ENV"
  echo " 7. 🐳 ESTADO Y SERVICIOS DOCKER"
  echo " 8. 🧰 PORTAINER"
  echo ""
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-8, S]: " choice

  case "$choice" in
    1) menu_contenedores ;;
    2) menu_monitoreo ;;
    3) menu_limpieza ;;
    4) menu_configuracion ;;
    5) menu_expo ;;
    6) menu_templates ;;
    7) menu_docker_services ;;
    8) menu_portainer ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu
      ;;
  esac
}

# Submenú: Portainer (VERSIÓN LINUX COMPLETA)
menu_portainer() {
  clear
  echo "======================================="
  echo "🧰 PORTAINER (Linux)"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. ▶️ Iniciar/Crear Portainer"
  echo " 2. ⏹️ Detener Portainer"
  echo " 3. 🔄 Reiniciar Portainer"
  echo " 4. 🌐 Abrir en navegador"
  echo " 5. 📋 Ver logs"
  echo " 6. ♻️ Recrear Portainer (nuevo contenedor)"
  echo " 7. 🗑️ Eliminar contenedor (con opción de borrar datos)"
  echo " 8. ℹ️ Información detallada"
  echo ""
  echo " V. ⬅️ Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-8, V, S]: " choice

  case "$choice" in
    1) portainer_start ;;
    2) portainer_stop ;;
    3) portainer_restart ;;
    4) portainer_open_browser ;;
    5) portainer_logs ;;
    6) portainer_recreate ;;
    7) portainer_destroy ;;
    8) portainer_info ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_portainer
      ;;
  esac
}

# Submenú: Manejador de Contenedores
menu_contenedores() {
  clear
  echo "======================================="
  echo "📋 MANEJADOR DE CONTENEDORES"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. 🚀 Iniciar contenedores y construir imagenes"
  echo " 2. 🛑 Detener y eliminar contenedores"
  echo " 3. 🔄 Reiniciar contenedores"
  echo " 4. 🔃 Reiniciar contenedor unico"
  echo " 5. 🔨 Construir imágenes"
  echo ""
  echo " V. ⬅️  Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-5, V, S]: " choice

  case "$choice" in
    1) up ;;
    2) down ;;
    3) restart ;;
    4) restart_single_container ;;
    5) build ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_contenedores
      ;;
  esac
}

# Submenú: Monitoreo y Diagnóstico
menu_monitoreo() {
  clear
  echo "======================================="
  echo "📊 MONITOREO Y DIAGNÓSTICO"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. 📋 Ver logs"
  echo " 2. 📊 Estado de los contenedores"
  echo " 3. 📦 Listar contenedores de stack"
  echo " 4. 💻 Abrir terminal en contenedor de stack"
  echo ""
  echo " V. ⬅️  Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-4, V, S]: " choice

  case "$choice" in
    1) logs ;;
    2) ps ;;
    3) list_stack ;;
    4) exec_stack ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_monitoreo
      ;;
  esac
}

# Submenú: Limpieza y Mantenimiento
menu_limpieza() {
  clear
  echo "======================================="
  echo "🧹 LIMPIEZA Y MANTENIMIENTO"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. 🧹 Limpiar contenedores, redes y volúmenes"
  echo " 2. 🖼️ Limpiar imágenes no utilizadas"
  echo " 3. 💾 Limpiar volúmenes no utilizados"
  echo " 4. 🗑️ Limpiar todo (contenedores, imágenes y volúmenes)"
  echo " 5. 🔥 Eliminar Persistencias"
  echo ""
  echo " V. ⬅️  Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-5, V, S]: " choice

  case "$choice" in
    1) clean ;;
    2) clean_images ;;
    3) clean_volumes ;;
    4) clean_all ;;
    5) drop_persistence ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_limpieza
      ;;
  esac
}

# Submenú: Configuración del Sistema
menu_configuracion() {
  clear
  echo "======================================="
  echo "⚙️  CONFIGURACIÓN DEL SISTEMA"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. 🔧 Cambiar entorno (dev, qa, prd)"
  echo " 2. 🌐 Actualizar IP en Docker Compose"
  echo " 3. 🔍 Verificar IP actual"
  echo " 4. 📋 Listar variables de entorno (contenedor)"
  echo ""
  echo " V. ⬅️  Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-4, V, S]: " choice

  case "$choice" in
    1) change_env ;;
    2) update_ip_menu ;;
    3) check_ip_menu ;;
    4) validate_container_env ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_configuracion
      ;;
  esac
}

# Submenú: Herramientas Expo
menu_expo() {
  clear
  echo "======================================="
  echo "📱 HERRAMIENTAS EXPO"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo "1) 🚀 Iniciar Expo Development Server"
  echo "2) 🏗️ EAS Build (Generar APK/AAB)"
  echo ""
  echo " V. ⬅️  Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-4, V, S]: " choice

  case "$choice" in
    1) iniciar_expo ;;
    2) 
      eas_build_expo
      ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_expo
      ;;
  esac
}

# Submenú: Gestión de Templates
menu_templates() {
    clear
    echo "======================================="
    echo "📄 GESTIÓN DE TEMPLATES .ENV"
    banner_menu_ambiente
    echo "======================================="
    echo ""
    echo " 1. 🔨 Generar .env.template desde archivos"
    echo " 2. 📋 Generar archivos .env desde template"
    echo " 3. 🔍 Verificar archivos .env existentes"
    echo ""
    echo " V. ⬅️  Volver al menú principal"
    echo " S. 🚪 Salir"
    echo "======================================="
    read -p "👉 Seleccione una opción [1-3, V, S]: " choice

    case "$choice" in
        1) generate_env_template ;;
        2) generate_env_from_template ;;
        3) verify_env_files ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo "❌ Opción inválida. Inténtelo de nuevo."
            sleep 3
            menu_templates
            ;;
    esac
}

# Submenú: Estado y Servicios Docker
menu_docker_services() {
  clear
  echo "======================================="
  echo "🐳 ESTADO Y SERVICIOS DOCKER"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. 🔍 Estado Docker Engine"
  echo " 2. 🖥️ Estado Docker Desktop"
  echo " 3. 🔄 Reiniciar Docker Engine"
  echo " 4. 🔄 Reiniciar Docker Desktop"
  echo " 5. ♻️ Reiniciar Ambos (Engine + Desktop)"
  echo ""
  echo " V. ⬅️  Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-5, V, S]: " choice

  case "$choice" in
    1) docker_status_engine ;;
    2) docker_status_desktop ;;
    3) docker_restart_engine ;;
    4) docker_restart_desktop ;;
    5) docker_restart_all ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_docker_services
      ;;
  esac
}

# Submenú: Portainer (VERSIÓN LINUX)
menu_portainer() {
  clear
  echo "======================================="
  echo "🧰 PORTAINER (Linux)"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  echo " 1. ▶️  Iniciar/Crear Portainer"
  echo " 2. ⏹️  Detener Portainer"
  echo " 3. 🔄 Reiniciar Portainer"
  echo " 4. 🌐 Abrir en navegador"
  echo " 5. 📋 Ver logs"
  echo " 6. ♻️  Recrear Portainer (nuevo contenedor)"
  echo " 7. 🗑️  Eliminar contenedor (con opción de borrar datos)"
  echo " 8. ℹ️  Información detallada"
  echo ""
  echo " V. ⬅️  Volver al menú principal"
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-8, V, S]: " choice

  case "$choice" in
    1) portainer_start ;;
    2) portainer_stop ;;
    3) portainer_restart ;;
    4) portainer_open_browser ;;
    5) portainer_logs ;;
    6) portainer_recreate ;;
    7) portainer_destroy ;;
    8) portainer_info ;;
    [Vv]) menu ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu_portainer
      ;;
  esac
}


#############################################################
###          Funciones - menu_contenedores
#############################################################
up() {
  clear
  echo "======================================="
  echo "Docker Tools - Iniciando Contenedores"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV up -d --build
  pause
  menu_contenedores
}

down() {
  clear
  echo "======================================="
  echo "Docker Tools - Deteniendo y eliminando contenedores"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV --profile tools down
  pause
  menu_contenedores
}

restart() {
  clear
  echo "======================================="
  echo "Docker Tools - Reiniciando contenedores"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV --profile tools down
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV up -d --build
  pause
  menu_contenedores
}

restart_single_container() {
  clear
  echo "======================================="
  echo "Docker Tools - Reiniciar Contenedor Único"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}} {{.Status}}")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "No se encontraron contenedores activos con la etiqueta $LABEL_FILTER."
    sleep 3
    menu
  fi

  echo " # | ID               | NOMBRE                          | IMAGEN                              | ESTADO"
  echo "---|------------------|---------------------------------|-------------------------------------|------------"

  for i in "${!containers[@]}"; do
    container=(${containers[$i]})
    printf "%2d | %-16s | %-31s | %-35s | %-10s\n" \
        $((i+1)) \
        "$(truncate_text "${container[0]}" 16)" \
        "$(truncate_text "${container[1]}" 31)" \
        "$(truncate_text "${container[2]}" 35)" \
        "$(truncate_text "${container[3]}" 10)"
  done

  echo
  read -p "Seleccione el índice del contenedor a reiniciar: " index

  if ! [[ "$index" =~ ^[0-9]+$ ]] || [ "$index" -lt 1 ] || [ "$index" -gt ${#containers[@]} ]; then
    echo "Índice inválido."
    sleep 3
    menu_contenedores
  fi

  container_id=$(echo ${containers[$((index-1))]} | awk '{print $1}')
  container_name=$(echo ${containers[$((index-1))]} | awk '{print $2}')

  echo ""
  echo "Reiniciando el contenedor $container_name..."
  docker restart "$container_id" > /dev/null 2>&1 && \
    echo "Contenedor $container_name reiniciado correctamente." || \
    echo "Error al reiniciar el contenedor $container_name."

  pause
  menu_contenedores
}

build() {
  clear
  echo "======================================="
  echo "Docker Tools - Construyendo imágenes"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV build
  pause
  menu_contenedores
}

#############################################################
###          Funciones - menu_monitoreo
#############################################################
logs() {
  clear
  echo "======================================="
  echo "Docker Tools - Visualizar Logs"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV logs -f
  pause
  menu_monitoreo
}

ps() {
  clear
  echo "======================================="
  echo "Docker Tools - Estado Contenedores"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}}#{{.Names}}#{{.Image}}#{{.Ports}}#{{.Command}}")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "No se encontraron contenedores activos con la etiqueta $LABEL_FILTER."
    sleep 3
    menu_monitoreo
  fi

  echo " # | SERVICIO                 | IMAGEN                                | PUERTO(S)                 | COMANDO"
  echo "---|--------------------------|---------------------------------------|---------------------------|-------------------------------"

  for i in "${!containers[@]}"; do
      IFS="#" read -r id name image ports command <<< "${containers[$i]}"

      formatted_name=$(truncate_text "$name" 24)
      formatted_image=$(truncate_text "$image" 37)
      formatted_ports=$(truncate_text "$ports" 25)
      formatted_command=$(truncate_text "$command" 30)

      printf "%2d | %-24s | %-37s | %-25s | %-30s\n" \
        $((i+1)) "$formatted_name" "$formatted_image" "${formatted_ports:-"N/A"}" "${formatted_command:-"N/A"}"
  done

  pause
  menu_monitoreo
}

list_stack() {
  clear
  echo "======================================="
  echo "Docker Tools - Listar Contenedores"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}} {{.Status}}")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "No se encontraron contenedores activos con la etiqueta $LABEL_FILTER."
    sleep 3
    menu_monitoreo
  fi

  echo "  # | ID               | NOMBRE                          | IMAGEN                              | ESTADO"
  echo "----|------------------|---------------------------------|-------------------------------------|------------"

  for i in "${!containers[@]}"; do
    container=(${containers[$i]})
    printf "%3d | %-16s | %-31s | %-35s | %-10s\n" \
        $((i+1)) \
        "$(truncate_text "${container[0]}" 16)" \
        "$(truncate_text "${container[1]}" 31)" \
        "$(truncate_text "${container[2]}" 35)" \
        "$(truncate_text "${container[3]}" 10)"
  done

  pause
  menu_monitoreo
}

exec_stack() {
  clear
  echo "======================================="
  echo "Docker Tools - Acceso Shell Contenedor"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}} {{.Status}}")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "No se encontraron contenedores con la etiqueta $LABEL_FILTER."
    sleep 3
    menu_monitoreo
  fi

  echo " # | ID               | NOMBRE                          | IMAGEN                              | ESTADO"
  echo "---|------------------|---------------------------------|-------------------------------------|------------"

  for i in "${!containers[@]}"; do
    container=(${containers[$i]})
    printf "%2d | %-16s | %-31s | %-35s | %-10s\n" \
        $((i+1)) \
        "$(truncate_text "${container[0]}" 16)" \
        "$(truncate_text "${container[1]}" 31)" \
        "$(truncate_text "${container[2]}" 35)" \
        "$(truncate_text "${container[3]}" 10)"
  done

  exit_index=$(( ${#containers[@]} + 1 ))
  echo "-----------------------------------------------------------------------------------------------------------"
  printf "%2d | %-40s\n" "$exit_index"  "$(truncate_text "     << Volver al menú >>" 30) " 
  echo
  read -p "Seleccione el índice del contenedor (o $exit_index para volver): " index

  if [[ "$index" == "$exit_index" ]]; then
      menu_monitoreo
  fi

  if ! [[ "$index" =~ ^[0-9]+$ ]] || [ "$index" -lt 1 ] || [ "$index" -gt ${#containers[@]} ]; then
    echo "Índice inválido."
    sleep 3
    menu_monitoreo
  fi

  container_id=$(echo ${containers[$((index-1))]} | awk '{print $1}')
  container_name=$(echo ${containers[$((index-1))]} | awk '{print $2}')

  echo ""
  echo "Conectando al contenedor $container_name..."

  echo "Verificando shell disponible..."
  if docker exec "$container_id" bash -c "echo Bash disponible" &>/dev/null; then
    echo "Abriendo terminal con bash..."
    echo ""
    docker exec -it "$container_id" bash
  elif docker exec "$container_id" sh -c "echo SH disponible" &>/dev/null; then
    echo "Bash no disponible. Abriendo terminal con sh..."
    echo ""
    docker exec -it "$container_id" sh
  else
    echo "No se pudo abrir una terminal en el contenedor $container_name."
  fi
  pause
  menu_monitoreo
}

#############################################################
###          Funciones - menu_limpieza
#############################################################
clean() {
  clear
  echo "======================================="
  echo "Docker Tools - Limpieza"
  echo "Limpiando contenedores, redes y volúmenes"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV --profile tools down --volumes --remove-orphans
  pause
  menu_limpieza
}

clean_volumes() {
  clear
  echo "======================================="
  echo "Docker Tools - Limpieza"
  echo "Limpiando volúmenes no utilizados"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  docker volume prune -f
  pause
  menu_limpieza
}

clean_images() {
  clear
  echo "======================================="
  echo "Docker Tools - Limpieza"
  echo "Limpiando imágenes"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  
  GREEN="\e[32m"
  YELLOW="\e[33m"
  RED="\e[31m"
  CYAN="\e[36m"
  BLUE="\e[34m"
  NC="\e[0m"

  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}LIMPIEZA DE IMÁGENES DOCKER${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""

  local dangling_images_count=$(docker images --filter "dangling=true" -q | wc -l)
  mapfile -t base_images < <(docker images --format "{{.Repository}}:{{.Tag}}" | grep -v "^${PROJECT_NAME}/" | grep -v "<none>")
  mapfile -t project_images < <(docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${PROJECT_NAME}/")

  echo "📊 Resumen actual de imágenes:"
  echo "   🗑️  Imágenes huérfanas (<none>): $dangling_images_count"
  echo "   📦 Imágenes Base (Grupo 1): ${#base_images[@]}"
  echo "   🏗️  Imágenes del Proyecto (Grupo 2): ${#project_images[@]}"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""

  if [[ $dangling_images_count -gt 0 ]]; then
    echo -e "${YELLOW}🗑️  IMÁGENES HUÉRFANAS (<none>)${NC}"
    echo "   Imágenes sin nombre ni tag, generalmente restos de builds"
    echo ""
    docker images --filter "dangling=true" --format "   * {{.ID}} ({{.Size}}, creada: {{.CreatedSince}})"
    echo ""
    read -p "¿Deseas eliminar las imágenes huérfanas? (s/n): " clean_dangling
    if [[ "$clean_dangling" =~ ^[Ss]$ ]]; then
      echo -e "${GREEN}Eliminando imágenes huérfanas...${NC}"
      docker image prune -f
      echo -e "${GREEN}✅ Imágenes huérfanas eliminadas${NC}"
    else
      echo -e "${BLUE}⏭️  Imágenes huérfanas conservadas${NC}"
    fi
    echo ""
    echo -e "${CYAN}───────────────────────────────────────────────────────────${NC}"
    echo ""
  fi

  if [[ ${#base_images[@]} -gt 0 ]]; then
    echo -e "${YELLOW}📦 GRUPO 1: Imágenes Base (Externas)${NC}"
    echo "   Imágenes oficiales descargadas de registros públicos"
    echo "   Ejemplos: mariadb, minio, redis, nginx, node, etc."
    echo ""
    for image in "${base_images[@]}"; do
      local size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
      echo -e "   ${RED}*${NC} $image ${CYAN}(${size})${NC}"
    done
    echo ""
    read -p "¿Deseas eliminar las imágenes BASE (Grupo 1)? (s/n): " confirm_base
    if [[ "$confirm_base" =~ ^[Ss]$ ]]; then
      echo -e "${YELLOW}Eliminando imágenes base...${NC}"
      local deleted_count=0
      for image in "${base_images[@]}"; do
        echo "  Eliminando: $image"
        if docker rmi -f "$image" 2>/dev/null; then
          ((deleted_count++))
        fi
      done
      echo -e "${GREEN}✅ Imágenes base eliminadas: $deleted_count de ${#base_images[@]}${NC}"
    else
      echo -e "${BLUE}⏭️  Imágenes base conservadas (${#base_images[@]} imágenes)${NC}"
    fi
    echo ""
    echo -e "${CYAN}───────────────────────────────────────────────────────────${NC}"
    echo ""
  else
    echo -e "${GREEN}✅ No hay imágenes base para eliminar${NC}"
    echo ""
  fi

  if [[ ${#project_images[@]} -gt 0 ]]; then
    echo -e "${YELLOW}🏗️  GRUPO 2: Imágenes del Proyecto (Construidas)${NC}"
    echo "   Imágenes construidas desde Dockerfiles locales"
    echo "   Prefijo del proyecto: ${PROJECT_NAME}/"
    echo ""
    for image in "${project_images[@]}"; do
      local size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
      echo -e "   ${RED}*${NC} $image ${CYAN}(${size})${NC}"
    done
    echo ""
    read -p "¿Deseas eliminar las imágenes del PROYECTO (Grupo 2)? (s/n): " confirm_project
    if [[ "$confirm_project" =~ ^[Ss]$ ]]; then
      echo -e "${YELLOW}Eliminando imágenes del proyecto...${NC}"
      local deleted_count=0
      for image in "${project_images[@]}"; do
        echo "  Eliminando: $image"
        if docker rmi -f "$image" 2>/dev/null; then
          ((deleted_count++))
        fi
      done
      echo -e "${GREEN}✅ Imágenes del proyecto eliminadas: $deleted_count de ${#project_images[@]}${NC}"
    else
      echo -e "${BLUE}⏭️  Imágenes del proyecto conservadas (${#project_images[@]} imágenes)${NC}"
    fi
    echo ""
  else
    echo -e "${GREEN}✅ No hay imágenes del proyecto para eliminar${NC}"
    echo ""
  fi

  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ Proceso de limpieza de imágenes completado${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

  pause
  menu_limpieza
}

clean_all() {
  clear
  echo "======================================="
  echo "Docker Tools - Limpieza"
  echo "Limpieza Completa"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  GREEN="\e[32m"
  YELLOW="\e[33m"
  RED="\e[31m"
  CYAN="\e[36m"
  BLUE="\e[34m"
  NC="\e[0m"

  echo "======================================="
  echo "Limpiando contenedores, redes y volúmenes del stack..."
  echo "======================================="
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV --profile tools down --volumes --remove-orphans

  echo "======================================="
  echo "Verificando volúmenes huérfanos relacionados con el stack..."
  echo "======================================="
  mapfile -t stack_volumes < <(docker volume ls --filter "dangling=true" --filter "label=$LABEL_FILTER" --format "{{.Name}}")

  if [ ${#stack_volumes[@]} -gt 0 ]; then
    echo "Los siguientes volúmenes serán eliminados:"
    for volume in "${stack_volumes[@]}"; do
      echo " - $volume"
    done
    for volume in "${stack_volumes[@]}"; do
      docker volume rm "$volume"
    done
  else
    echo "No se encontraron volúmenes huérfanos relacionados con el stack."
  fi

  echo ""
  echo "======================================="
  echo "Limpiando imágenes..."
  echo "======================================="
  echo ""
  
  local dangling_images_count=$(docker images --filter "dangling=true" -q | wc -l)
  mapfile -t base_images < <(docker images --format "{{.Repository}}:{{.Tag}}" | grep -v "^${PROJECT_NAME}/" | grep -v "<none>")
  mapfile -t project_images < <(docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${PROJECT_NAME}/")

  echo "📊 Resumen de imágenes:"
  echo "   🗑️  Imágenes huérfanas: $dangling_images_count"
  echo "   📦 Imágenes Base: ${#base_images[@]}"
  echo "   🏗️  Imágenes del Proyecto: ${#project_images[@]}"
  echo ""

  if [[ $dangling_images_count -gt 0 ]]; then
    echo -e "${YELLOW}🗑️  IMÁGENES HUÉRFANAS${NC}"
    docker images --filter "dangling=true" --format "   * {{.ID}} ({{.Size}})"
    echo ""
    read -p "¿Eliminar imágenes huérfanas? (s/n): " clean_dangling
    if [[ "$clean_dangling" =~ ^[Ss]$ ]]; then
      docker image prune -f
      echo -e "${GREEN}✅ Imágenes huérfanas eliminadas${NC}"
    else
      echo -e "${BLUE}⏭️  Imágenes huérfanas conservadas${NC}"
    fi
    echo ""
  fi

  if [[ ${#base_images[@]} -gt 0 ]]; then
    echo -e "${YELLOW}📦 GRUPO 1: Imágenes Base (Externas)${NC}"
    echo "   Imágenes oficiales descargadas de registros públicos"
    echo ""
    for image in "${base_images[@]}"; do
      local size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
      echo -e "   ${RED}*${NC} $image ${CYAN}(${size})${NC}"
    done
    echo ""
    read -p "¿Eliminar imágenes BASE (Grupo 1)? (s/n): " confirm_base
    if [[ "$confirm_base" =~ ^[Ss]$ ]]; then
      echo -e "${YELLOW}Eliminando imágenes base...${NC}"
      for image in "${base_images[@]}"; do
        docker rmi -f "$image" 2>/dev/null
      done
      echo -e "${GREEN}✅ Imágenes base eliminadas${NC}"
    else
      echo -e "${BLUE}⏭️  Imágenes base conservadas${NC}"
    fi
    echo ""
  fi

  if [[ ${#project_images[@]} -gt 0 ]]; then
    echo -e "${YELLOW}🏗️  GRUPO 2: Imágenes del Proyecto${NC}"
    echo "   Prefijo: ${PROJECT_NAME}/"
    echo ""
    for image in "${project_images[@]}"; do
      local size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
      echo -e "   ${RED}*${NC} $image ${CYAN}(${size})${NC}"
    done
    echo ""
    read -p "¿Eliminar imágenes del PROYECTO (Grupo 2)? (s/n): " confirm_project
    if [[ "$confirm_project" =~ ^[Ss]$ ]]; then
      echo -e "${YELLOW}Eliminando imágenes del proyecto...${NC}"
      for image in "${project_images[@]}"; do
        docker rmi -f "$image" 2>/dev/null
      done
      echo -e "${GREEN}✅ Imágenes del proyecto eliminadas${NC}"
    else
      echo -e "${BLUE}⏭️  Imágenes del proyecto conservadas${NC}"
    fi
    echo ""
  fi

  echo "======================================="
  echo "Limpiando caché de builds generadas..."
  echo "======================================="
  docker builder prune -af

  echo ""
  echo "======================================="
  echo -e "${GREEN}✅ Limpieza completada.${NC}"
  echo "======================================="
  pause
  menu_limpieza
}

drop_persistence() {
  clear
  echo "======================================="
  echo "Docker Tools - Limpieza"
  banner_menu_ambiente
  echo "⚠️  ADVERTENCIA: Esta acción eliminará las persistencias de los contenedores."
  echo "   Se borrarán los datos almacenados de los siguientes Servicios/Contenedores,"
  echo "   solo si no están en ejecución:"
  echo "======================================="
  echo " - mailpit"
  echo " - mariadb"
  echo " - minio"
  echo " - rabbitmq"
  echo " - redis"
  echo " - redisinsight"
  echo " - frontend (node_modules, package-lock.json)"
  echo ""

  GREEN="\e[32m"
  RED="\e[31m"
  NC="\e[0m"

  read -p "¿Seguro que deseas continuar? (S/N): " confirm
  case "$confirm" in
    [sS]) 
      echo "Verificando contenedores en ejecución..."
      
      mapfile -t active_containers < <(docker ps --format "{{.Names}}")

      for service in mailpit mariadb minio rabbitmq redis redisinsight; do
        if printf "%s\n" "${active_containers[@]}" | grep -q "$service"; then
          echo -e "⏳ ${service} está en ejecución. ${RED}[NO SE ELIMINA]${NC}"
        else
          echo -n "Eliminando persistencia servicio/contenedor: ${service}..."
          if [ -d "volumes/$service" ]; then
            rm -rf "volumes/$service" 2>/dev/null
            if [ $? -eq 0 ]; then
              echo -e " ${GREEN}[OK]${NC}"
            else
              echo -e " ${RED}[Error al eliminar]${NC}"
            fi
          else
            echo -e " ${RED}[No existe]${NC}"
          fi
        fi
      done

      echo -n "Eliminando carpetas node_modules..."
      found=$(find . -type d -name "node_modules")
      if [ -n "$found" ]; then
        find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null
        if [ $? -eq 0 ]; then
          echo -e " ${GREEN}[OK]${NC}"
        else
          echo -e " ${RED}[Error al eliminar]${NC}"
        fi
      else
        echo -e " ${RED}[No se encontraron]${NC}"
      fi

      echo -n "Eliminando archivos package-lock.json..."
      found=$(find . -type f -name "package-lock.json")
      if [ -n "$found" ]; then
        find . -type f -name "package-lock.json" -exec rm -f {} + 2>/dev/null
        if [ $? -eq 0 ]; then
          echo -e " ${GREEN}[OK]${NC}"
        else
          echo -e " ${RED}[Error al eliminar]${NC}"
        fi
      else
        echo -e " ${RED}[No se encontraron]${NC}"
      fi

      echo -n "Eliminando carpetas __pycache__..."
      found=$(find . -type d -name "__pycache__")
      if [ -n "$found" ]; then
        find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
        if [ $? -eq 0 ]; then
          echo -e " ${GREEN}[OK]${NC}"
        else
          echo -e " ${RED}[Error al eliminar]${NC}"
        fi
      else
        echo -e " ${RED}[No se encontraron]${NC}"
      fi

      echo ""
      echo "======================================="
      echo -e "${GREEN}✅ Limpieza completada.${NC}"
      echo "======================================="
      pause
      menu_limpieza
      ;;
    *)
      echo "Operación cancelada."
      pause
      menu_limpieza
      ;;
  esac
}

#############################################################
###          Funciones - menu_configuracion
#############################################################
change_env() {
  clear
  echo "======================================="
  echo "Docker Tools - Configuraciones"
  echo "Cambiar entorno actual (dev, qa, prd)"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  read -p "Ingrese el nuevo entorno: " new_env
  if [ -z "$new_env" ]; then
    echo "El entorno no puede estar vacío."
    sleep 3
    menu_configuracion
  fi
  ENV="$new_env"
  define_compose_file
  echo "Entorno cambiado a: $ENV"
  sleep 3
  menu_configuracion
}

update_ip_menu() {
  clear  
  echo "======================================="
  echo "Docker Tools - Configuraciones"
  echo "Actulizar Direccion IP"
  banner_menu_ambiente
  echo "======================================="
  echo ""
    
  local current_ip=$(get_current_ip)
  local env_file=".env"
    
  if [[ ! -f "$env_file" ]]; then
    echo "❌ El archivo $env_file no existe."
    echo "❌ OPERACIÓN DETENIDA: No se puede continuar sin el archivo .env"
    echo ""
    echo "💡 Cree el archivo .env antes de ejecutar esta opción."
    pause
    menu_configuracion
    return 1
  fi
    
  if [[ -z "$current_ip" ]]; then
    echo "❌ No se pudo detectar la IP actual del equipo."
    echo "Puede intentar configurarla manualmente."
    echo ""
    read -p "¿Desea ingresar la IP manualmente? (S/N): " manual_ip
    if [[ $manual_ip =~ ^[Ss]$ ]]; then
      read -p "Ingrese la IP: " manual_ip_value
      if [[ -n "$manual_ip_value" ]]; then
        update_ip_in_compose "$manual_ip_value"
        if [[ $? -ne 0 ]]; then
          echo "❌ Error al actualizar la IP"
        fi
      else
        echo "❌ IP vacía. Operación cancelada."
      fi
    fi
  else
    echo "🌐 IP actual detectada: $current_ip"
    echo ""
    local compose_ip=$(get_ip_from_env)
    echo "📄 IP en $env_file: ${compose_ip:-'No configurada'}"
    echo ""
    if [[ -n "$compose_ip" && "$compose_ip" == "$current_ip" ]]; then
      echo "✅ Las IPs coinciden. No es necesario actualizar."
    else
      if [[ -n "$compose_ip" ]]; then
        echo "⚠️  Las IPs no coinciden."
      else
        echo "⚠️  IP no configurada en .env."
      fi
      read -p "¿Desea actualizar la IP en $env_file? (S/N): " confirm
      if [[ $confirm =~ ^[Ss]$ ]]; then
        update_ip_in_compose "$current_ip"
        if [[ $? -ne 0 ]]; then
          echo "❌ Error al actualizar la IP"
        fi
      else
        echo "Operación cancelada."
      fi
    fi
  fi
    
  pause
  menu_configuracion
}

validate_container_env() {
    
  echo "======================================="
  echo "Docker Tools - Configuraciones"
  echo "Validar Variables de Entorno"
  banner_menu_ambiente
  echo "======================================="

  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}}")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "❌ No se encontraron contenedores activos con la etiqueta $LABEL_FILTER."
    pause
    menu_configuracion
    return 1
  fi

  local container_id
  local container_name
  local index

  if [ ${#containers[@]} -eq 1 ]; then
    container_id=$(echo ${containers[0]} | awk '{print $1}')
    container_name=$(echo ${containers[0]} | awk '{print $2}')
    echo "✅ Contenedor seleccionado automáticamente: $container_name"
    echo ""
  else
    echo "Contenedores disponibles:"
    for i in "${!containers[@]}"; do
      container=(${containers[$i]})
      printf "%2d | %-30s\n" $((i+1)) "$(truncate_text "${container[1]}" 30)"
    done
    echo
    read -p "Seleccione el índice del contenedor: " index
    if ! [[ "$index" =~ ^[0-9]+$ ]] || [ "$index" -lt 1 ] || [ "$index" -gt ${#containers[@]} ]; then
      echo "❌ Índice inválido."
      pause
      menu_configuracion
      return 1
    fi
    container_id=$(echo ${containers[$((index-1))]} | awk '{print $1}')
    container_name=$(echo ${containers[$((index-1))]} | awk '{print $2}')
  fi

  echo "📋 Variables de entorno en: $container_name"
  echo "============================================"
  
  local env_vars=$(docker exec "$container_id" env 2>/dev/null | sort)
  local var_count=$(echo "$env_vars" | wc -l)
  
  if [[ -n "$env_vars" ]]; then
    echo "Total de variables: $var_count"
    echo ""
    local counter=1
    while IFS= read -r line; do
      printf "%3d | %s\n" "$counter" "$line"
      ((counter++))
    done <<< "$env_vars"
  else
    echo "❌ No se pudieron obtener las variables del contenedor"
  fi

  pause
  menu_configuracion
}

get_ip_from_env() {
  local env_file=".env"
  if [[ -f "$env_file" ]]; then
    local ip_line=$(grep "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file" 2>/dev/null)
    if [[ -n "$ip_line" ]]; then
      echo "$ip_line" | cut -d'=' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//'
    else
      echo ""
    fi
  else
    echo ""
  fi
}

update_ip_in_compose() {
  local new_ip="$1"
  if [[ -z "$new_ip" ]]; then
    echo "❌ No se proporcionó una IP válida."
    return 1
  fi
  if [[ ! "$new_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "❌ Formato de IP inválido: $new_ip"
    return 1
  fi
  local env_file=".env"
  if [[ ! -f "$env_file" ]]; then
    echo "❌ El archivo $env_file no existe."
    echo "❌ OPERACIÓN DETENIDA: No se puede continuar sin el archivo .env"
    return 1
  fi
  local backup_file="${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$env_file" "$backup_file"
  echo "📋 Backup creado: $backup_file"
  if grep -q "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file" 2>/dev/null; then
    sed -i "s/^REACT_NATIVE_PACKAGER_HOSTNAME=.*/REACT_NATIVE_PACKAGER_HOSTNAME=$new_ip/" "$env_file"
    echo "✅ IP actualizada a $new_ip en $env_file"
  else
    echo "REACT_NATIVE_PACKAGER_HOSTNAME=$new_ip" >> "$env_file"
    echo "✅ Variable REACT_NATIVE_PACKAGER_HOSTNAME=$new_ip agregada a $env_file"
  fi
  return 0
}

show_network_interfaces() {
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
    if command -v powershell.exe &> /dev/null; then
      powershell.exe -Command '
      $adapters = Get-NetAdapter | Where-Object Status -eq "Up"
      foreach ($adapter in $adapters) {
          $ip = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "*.1"}
          if ($ip) {
              $type = "Otro"
              if ($adapter.Name -like "*Wi-Fi*" -or $adapter.Name -like "*Wireless*") { $type = "WiFi" }
              elseif ($adapter.Name -like "*Ethernet*") { $type = "Ethernet" }
              elseif ($adapter.Name -like "*WSL*" -or $adapter.Name -like "*vEthernet*") { $type = "WSL/Virtual" }
              Write-Output "   [$type] $($ip.IPAddress) - $($adapter.Name)"
          }
      }' 2>/dev/null | tr -d '\r'
    elif command -v ipconfig &> /dev/null; then
      echo "   Interfaces detectadas:"
      ipconfig 2>/dev/null | grep -a "IPv4" | grep -v "127.0.0.1" | while IFS= read -r line; do
        local ip_addr=$(echo "$line" | sed 's/.*[: ]\([0-9]*\.[0-9]*\.[0-9]*\.[0-9]*\).*/\1/' | tr -d '\r')
        if [[ "$ip_addr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] && [[ ! "$ip_addr" =~ \.1$ ]]; then
          echo "   $ip_addr"
        fi
      done
    else
      echo "   No se pueden mostrar las interfaces de red en Windows"
    fi
  else
    if command -v ip &> /dev/null; then
      ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | while read -r line; do
        local ip_addr=$(echo "$line" | awk '{print $2}' | cut -d'/' -f1)
        local interface=$(echo "$line" | awk '{print $NF}')
        if [[ ! "$ip_addr" =~ \.1$ ]]; then
          echo "   $ip_addr - $interface"
        fi
      done
    elif command -v ifconfig &> /dev/null; then
      ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | while read -r line; do
        local ip_addr=$(echo "$line" | awk '{print $2}')
        if [[ ! "$ip_addr" =~ \.1$ ]]; then
          echo "   $ip_addr"
        fi
      done
    else
      echo "   No se pueden mostrar las interfaces de red"
    fi
  fi
}

get_current_ip() {
  local ip=""
  local temp_ip=""
  
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
    if command -v powershell.exe &> /dev/null; then
      temp_ip=$(powershell.exe -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {\$_.IPAddress -ne '127.0.0.1' -and \$_.IPAddress -notlike '*.1' -and \$_.PrefixOrigin -eq 'Dhcp'} | Select-Object -First 1 | ForEach-Object {\$_.IPAddress}" 2>/dev/null | tr -d '\r\n ')
      if [[ -n "$temp_ip" ]]; then ip="$temp_ip"; fi
    fi
    if [[ -z "$ip" ]] && command -v ipconfig &> /dev/null; then
      while IFS= read -r line; do
        temp_ip=$(echo "$line" | sed 's/.*[: ]\([0-9]*\.[0-9]*\.[0-9]*\.[0-9]*\).*/\1/' | tr -d '\r')
        if [[ "$temp_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] && [[ ! "$temp_ip" =~ \.1$ ]]; then
          ip="$temp_ip"
          break
        fi
      done < <(ipconfig 2>/dev/null | grep -a "IPv4" | grep -v "127.0.0.1")
    fi
  else
    if command -v ip &> /dev/null; then
      temp_ip=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
      if [[ -n "$temp_ip" && ! "$temp_ip" =~ \.1$ ]]; then ip="$temp_ip"; fi
    fi
    if [[ -z "$ip" ]] && command -v hostname &> /dev/null; then
      while read -r temp_ip; do
        if [[ -n "$temp_ip" && ! "$temp_ip" =~ \.1$ ]]; then
          ip="$temp_ip"
          break
        fi
      done < <(hostname -I 2>/dev/null | tr ' ' '\n')
    fi
    if [[ -z "$ip" ]] && command -v ifconfig &> /dev/null; then
      while read -r temp_ip; do
        if [[ -n "$temp_ip" && ! "$temp_ip" =~ \.1$ ]]; then
          ip="$temp_ip"
          break
        fi
      done < <(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}')
    fi
  fi
  
  ip=$(echo "$ip" | tr -d '\r\n ' | grep -o '^[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*$')
  echo "$ip"
}

check_ip_menu() {
  clear
  echo "======================================="
  echo "Docker Tools - Configuraciones"
  echo "Verificar IP"
  banner_menu_ambiente
  echo "======================================="
  echo ""
    
  local current_ip=$(get_current_ip)
  
  if [[ -n "$current_ip" ]]; then
    echo "🌐 IP actual del equipo: $current_ip"
    echo ""
    echo "📡 Información de red:"
    if command -v hostname &> /dev/null; then
      echo "   Hostname: $(hostname 2>/dev/null || echo 'No disponible')"
    fi
    local env_file=".env"
    if [[ -f "$env_file" ]]; then
      local compose_ip=$(get_ip_from_env)
      echo "📄 IP en $env_file: ${compose_ip:-'No configurada'}"
      if [[ -n "$compose_ip" && "$compose_ip" == "$current_ip" ]]; then
        echo "✅ Estado: Las IPs coinciden"
      elif [[ -n "$compose_ip" ]]; then
        echo "⚠️  Estado: Las IPs NO coinciden"
        echo "   Considere actualizar la IP usando la opción 2 del menú de configuración."
      else
        echo "⚠️  Estado: IP no configurada en .env"
        echo "   Considere configurar la IP usando la opción 2 del menú de configuración."
      fi
    else
      echo "❌ El archivo $env_file no existe."
    fi
    echo ""
    echo "🔍 Interfaces de red disponibles:"
    show_network_interfaces
  else
    echo "❌ No se pudo detectar la IP actual del equipo."
    echo ""
    echo "💡 Métodos de detección probados:"
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
      echo "   - ipconfig (Windows)"
      echo "   - PowerShell Get-NetIPAddress"
    else
      echo "   - ip route"
      echo "   - ifconfig"
    fi
    echo ""
    echo "Puede configurar la IP manualmente usando la opción 2 del menú de configuración."
  fi
    
  pause
  menu_configuracion
}

#############################################################
###          Funciones - menu_expo
#############################################################
iniciar_expo() {
  clear
  echo "======================================="
  echo "Docker Tools - Expo"
  echo "Iniciar Expo Manualmente"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}}" | grep -i "expo")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "❌ No se encontraron contenedores relacionados con Expo."
    pause
    menu_expo
  fi

  if [ ${#containers[@]} -gt 1 ]; then
    echo "Se encontraron múltiples contenedores relacionados con Expo:"
    for i in "${!containers[@]}"; do
      container=(${containers[$i]})
      printf "%2d | %-16s | %-30s\n" \
        $((i+1)) "$(truncate_text "${container[0]}" 16)" "$(truncate_text "${container[1]}" 30)"
    done
    echo
    read -p "Seleccione el índice del contenedor: " index
    if ! [[ "$index" =~ ^[0-9]+$ ]] || [ "$index" -lt 1 ] || [ "$index" -gt ${#containers[@]} ]; then
      echo "❌ Índice inválido."
      pause
      menu_expo
    fi
    container_id=$(echo "${containers[$((index-1))]}" | awk '{print $1}')
    container_name=$(echo "${containers[$((index-1))]}" | awk '{print $2}')
  else
    container_id=$(echo "${containers[0]}" | awk '{print $1}')
    container_name=$(echo "${containers[0]}" | awk '{print $2}')
    echo "✅ Contenedor encontrado: $container_name"
  fi

  echo
  echo "🔍 Verificando shell disponible en $container_name..."

  if docker exec "$container_id" bash -c "echo Bash disponible" &>/dev/null; then
    shell="bash"
  elif docker exec "$container_id" sh -c "echo SH disponible" &>/dev/null; then
    shell="sh"
  else
    echo "❌ No se pudo determinar una shell disponible en el contenedor."
    pause
    menu_expo
  fi

  echo "✅ Shell detectada: $shell"
  echo
  echo "🚀 Ejecutando /scripts/start-expo.sh en $container_name..."
  echo
  echo "    docker exec -it $container_name $shell -c \"bash /scripts/start-expo.sh\""
  echo

  docker exec -it "$container_id" $shell -c "bash /scripts/start-expo.sh"

  pause
  menu_expo
}

eas_build_expo() {
  clear
  echo "======================================="
  echo "Docker Tools - Expo"
  echo "EAS Build (APK/AAB)"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}}" | grep -i "expo")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "❌ No se encontraron contenedores relacionados con Expo."
    pause
    menu_expo
  fi

  if [ ${#containers[@]} -gt 1 ]; then
    echo "Se encontraron múltiples contenedores relacionados con Expo:"
    for i in "${!containers[@]}"; do
      container=(${containers[$i]})
      printf "%2d | %-16s | %-30s\n" \
        $((i+1)) "$(truncate_text "${container[0]}" 16)" "$(truncate_text "${container[1]}" 30)"
    done
    echo
    read -p "Seleccione el índice del contenedor: " index
    if ! [[ "$index" =~ ^[0-9]+$ ]] || [ "$index" -lt 1 ] || [ "$index" -gt ${#containers[@]} ]; then
      echo "❌ Índice inválido."
      pause
      menu_expo
    fi
    container_id=$(echo "${containers[$((index-1))]}" | awk '{print $1}')
    container_name=$(echo "${containers[$((index-1))]}" | awk '{print $2}')
  else
    container_id=$(echo "${containers[0]}" | awk '{print $1}')
    container_name=$(echo "${containers[0]}" | awk '{print $2}')
    echo "✅ Contenedor encontrado: $container_name"
  fi

  echo
  echo "🔍 Verificando shell disponible en $container_name..."

  if docker exec "$container_id" bash -c "echo Bash disponible" &>/dev/null; then
    shell="bash"
  elif docker exec "$container_id" sh -c "echo SH disponible" &>/dev/null; then
    shell="sh"
  else
    echo "❌ No se pudo determinar una shell disponible en el contenedor."
    pause
    menu_expo
  fi

  echo "✅ Shell detectada: $shell"
  echo
  
  if ! docker exec "$container_id" $shell -c "test -f /scripts/eas-build.sh" &>/dev/null; then
    echo "❌ El script /scripts/eas-build.sh no existe en el contenedor."
    echo "   Asegúrate de que el script esté montado en el volumen."
    pause
    menu_expo
  fi

  if ! docker exec "$container_id" $shell -c "test -n \"\$EXPO_TOKEN\"" &>/dev/null; then
    echo "⚠️  ADVERTENCIA: La variable EXPO_TOKEN no está configurada."
    echo "   El build podría fallar sin esta variable."
    echo
    read -p "¿Continuar de todas formas? [y/N]: " continuar
    if [[ ! "$continuar" =~ ^[Yy]$ ]]; then
      echo "❌ Build cancelado."
      pause
      menu_expo
    fi
  fi

  echo "🏗️  Ejecutando EAS Build en $container_name..."
  echo
  echo "    docker exec -it $container_name $shell -c \"bash /scripts/eas-build.sh\""
  echo "═══════════════════════════════════════════════════════════════════"
  echo

  docker exec -it "$container_id" $shell -c "bash /scripts/eas-build.sh"
  
  build_exit_code=$?
  echo
  echo "═══════════════════════════════════════════════════════════════════"
  
  if [ $build_exit_code -eq 0 ]; then
    echo "✅ EAS Build completado exitosamente!"
    echo "📱 Revisa tu dashboard de Expo para descargar el APK/AAB:"
    echo "   https://expo.dev/accounts/blackzeus/projects/Ambrosia/builds"
  else
    echo "❌ EAS Build falló (código de salida: $build_exit_code)"
    echo "   Revisa los errores anteriores para más detalles."
  fi

  echo
  pause
  menu_expo
}

#############################################################
###          Funciones - menu_templates
#############################################################
generate_env_template() {
  clear
  echo "======================================="
  echo "Docker Tools - ENV"
  echo "Generar .env.template"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  local template_file=".env.template"
  local ignore_file="ignore.json"
  local env_files=(".env" ".env.dev" ".env.qa" ".env.prd")
  
  local missing_files=()
  for file in "${env_files[@]}"; do
    if [[ ! -f "$file" ]]; then
      missing_files+=("$file")
    fi
  done
  
  if [[ ${#missing_files[@]} -gt 0 ]]; then
    echo "❌ Los siguientes archivos no existen:"
    for file in "${missing_files[@]}"; do
      echo "   - $file"
    done
    echo ""
    echo "💡 Cree los archivos faltantes antes de generar el template."
    pause
    return 1
  fi

  local sensitive_vars=()
  if [[ -f "$ignore_file" ]]; then
    echo "📋 Cargando variables sensibles desde $ignore_file..."
    mapfile -t sensitive_vars < <(grep -o '"[^"]*"' "$ignore_file" | grep -v "sensitive_variables\|description" | tr -d '"')
    echo "✅ Variables sensibles encontradas: ${#sensitive_vars[@]}"
  else
    echo "⚠️  Archivo $ignore_file no encontrado. Se omitirán variables por defecto."
    sensitive_vars=("API_SECRET_KEY" "API_SECRET_KEY_REFRESH" "BACKEND_API_SECRET_KEY" "BACKEND_API_SECRET_KEY_REFRESH" "EXPO_TOKEN")
  fi

  echo ""
  echo "🔨 Generando $template_file..."
  
  if [[ -f "$template_file" ]]; then
    local backup_file="${template_file}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$template_file" "$backup_file"
    echo "📋 Backup creado: $backup_file"
  fi

  > "$template_file"

  for env_file in "${env_files[@]}"; do
    echo "📄 Procesando $env_file..."
    if [[ "$env_file" != ".env" ]]; then
      echo "## ================ Corte ======================" >> "$template_file"
    fi
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        echo "$line" >> "$template_file"
        continue
      fi
      if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        local var_name=$(echo "$line" | cut -d'=' -f1)
        local is_sensitive=false
        for sensitive_var in "${sensitive_vars[@]}"; do
          if [[ "$var_name" == "$sensitive_var" ]]; then
            is_sensitive=true
            break
          fi
        done
        if [[ "$is_sensitive" == true ]]; then
          echo "# $var_name= # Variable sensible omitida" >> "$template_file"
        else
          echo "$line" >> "$template_file"
        fi
      else
        echo "$line" >> "$template_file"
      fi
    done < "$env_file"
  done

  echo ""
  echo "✅ Template generado exitosamente: $template_file"
  echo "📊 Resumen:"
  echo "   - Archivos procesados: ${#env_files[@]}"
  echo "   - Variables sensibles omitidas: ${#sensitive_vars[@]}"
  local total_lines=$(wc -l < "$template_file")
  echo "   - Líneas totales en template: $total_lines"
  
  menu_templates
  pause
}

generate_env_from_template() {
  clear
  echo "======================================="
  echo "Docker Tools - ENV"
  echo "Regenerar .env DEV/QA/PRD"
  banner_menu_ambiente
  echo "======================================="

  local template_file=".env.template"
  
  if [[ ! -f "$template_file" ]]; then
    echo "❌ El archivo $template_file no existe."
    echo "💡 Genere primero el template usando la opción anterior."
    pause
    return 1
  fi

  echo "📋 Opciones de generación:"
  echo " 1. Generar solo .env"
  echo " 2. Generar solo .env.dev"
  echo " 3. Generar solo .env.qa"
  echo " 4. Generar solo .env.prd"
  echo " 5. Generar todos los archivos"
  echo ""
  read -p "Seleccione una opción [1-5]: " choice

  local files_to_generate=()
  case "$choice" in
    1) files_to_generate=(".env") ;;
    2) files_to_generate=(".env.dev") ;;
    3) files_to_generate=(".env.qa") ;;
    4) files_to_generate=(".env.prd") ;;
    5) files_to_generate=(".env" ".env.dev" ".env.qa" ".env.prd") ;;
    *)
      echo "❌ Opción inválida."
      pause
      return 1
      ;;
  esac

  echo ""
  echo "🔨 Generando archivos desde template..."

  local current_section=""
  local current_file=""
  local line_count=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    ((line_count++))
    if [[ "$line" =~ ^##[[:space:]]*=[[:space:]]*Corte[[:space:]]*=[[:space:]]*## ]]; then
      current_section=""
      current_file=""
      continue
    fi
    if [[ "$line" =~ ^#[[:space:]]*Archivo[[:space:]]*de[[:space:]]*configuración:[[:space:]]*(.env[^[:space:]]*) ]]; then
      local detected_file=$(echo "$line" | sed 's/.*configuración:[[:space:]]*\([^[:space:]]*\).*/\1/')
      current_section="$detected_file"
      current_file=""
      for target_file in "${files_to_generate[@]}"; do
        if [[ "$target_file" == "$detected_file" ]]; then
          current_file="$target_file"
          break
        fi
      done
      continue
    fi
    if [[ -z "$current_section" && -n "$line" ]]; then
      for target_file in "${files_to_generate[@]}"; do
        if [[ "$target_file" == ".env" ]]; then
          current_file=".env"
          break
        fi
      done
    fi
    if [[ -n "$current_file" ]]; then
      if [[ ! -f "$current_file.new" ]]; then
        > "$current_file.new"
        echo "📄 Generando $current_file..."
      fi
      echo "$line" >> "$current_file.new"
    fi
  done < "$template_file"

  local generated_count=0
  for target_file in "${files_to_generate[@]}"; do
    if [[ -f "$target_file.new" ]]; then
      if [[ -f "$target_file" ]]; then
        local backup_file="${target_file}.backup.$(date +%Y%m%d_%H%M%S)"
        mv "$target_file" "$backup_file"
        echo "📋 Backup creado: $backup_file"
      fi
      mv "$target_file.new" "$target_file"
      echo "✅ Generado: $target_file"
      ((generated_count++))
    else
      echo "⚠️  No se pudo generar: $target_file (sección no encontrada en template)"
    fi
  done

  echo ""
  echo "✅ Proceso completado!"
  echo "📊 Archivos generados: $generated_count de ${#files_to_generate[@]}"
  echo ""
  echo "⚠️  IMPORTANTE: Revise los archivos generados y configure las variables sensibles manualmente."
  
  pause
}

verify_env_files() {
  clear
  echo "======================================="
  echo "Docker Tools - ENV"
  echo "Verificar Archivos Env"
  banner_menu_ambiente
  echo "======================================="

  local env_files=(".env" ".env.dev" ".env.qa" ".env.prd" ".env.template")
  
  echo "📋 Estado de archivos .env:"
  echo "================================"
  
  for file in "${env_files[@]}"; do
    if [[ -f "$file" ]]; then
      local size=$(du -h "$file" | cut -f1)
      local lines=$(wc -l < "$file")
      local vars=$(grep -c "^[A-Za-z_][A-Za-z0-9_]*=" "$file" 2>/dev/null || echo "0")
      printf "✅ %-15s | %6s | %3d líneas | %2d variables\n" "$file" "$size" "$lines" "$vars"
    else
      printf "❌ %-15s | No existe\n" "$file"
    fi
  done
  
  echo ""
  echo "📄 ignore.json:"
  if [[ -f "ignore.json" ]]; then
    local sensitive_count=$(grep -o '"[^"]*"' "ignore.json" | grep -v "sensitive_variables\|description" | wc -l)
    echo "✅ ignore.json | Variables sensibles configuradas: $sensitive_count"
  else
    echo "❌ ignore.json | No existe"
  fi
  
  pause
  menu_templates
}

#############################################################
###          Funciones - menu_docker_services
#############################################################

# Helpers internos
_docker_have() { command -v "$1" >/dev/null 2>&1; }

_docker_sudo() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]] && _docker_have sudo; then
    echo "sudo"
  else
    echo ""
  fi
}

_unit_exists_system() {
  systemctl list-unit-files "$1" >/dev/null 2>&1
}

_unit_exists_user() {
  systemctl --user list-unit-files "$1" >/dev/null 2>&1
}

# ---------- Estado Docker Engine ----------
docker_status_engine() {
  clear
  echo "======================================="
  echo "🐳 ESTADO Y SERVICIOS DOCKER"
  echo "Estado Docker Engine"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  local SUDO=$(_docker_sudo)

  if ! _docker_have systemctl; then
    echo "❌ systemctl no disponible en este sistema."
    pause; menu_docker_services; return
  fi

  if _unit_exists_system docker.service; then
    echo "📋 [System-wide] docker.service:"
    $SUDO systemctl --no-pager --full status docker.service || true
  elif _unit_exists_user docker.service; then
    echo "📋 [Rootless/User] docker.service:"
    systemctl --user --no-pager --full status docker.service || true
  else
    echo "⚠️  No se detectó docker.service (system-wide ni user)."
  fi

  echo ""
  if _docker_have docker; then
    echo "🔍 Verificación docker info:"
    if docker info >/dev/null 2>&1; then
      echo "✅ Docker responde correctamente."
    else
      echo "❌ docker info falló. Diagnóstico:"
      echo "   sudo journalctl -u docker --no-pager -n 50"
      echo "   ls -l /var/run/docker.sock"
      echo "   docker context ls"
    fi
  else
    echo "⚠️  docker CLI no está disponible en PATH."
  fi

  pause; menu_docker_services
}

# ---------- Estado Docker Desktop ----------
docker_status_desktop() {
  clear
  echo "======================================="
  echo "🐳 ESTADO Y SERVICIOS DOCKER"
  echo "Estado Docker Desktop"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  local SUDO=$(_docker_sudo)

  if pgrep -f "docker-desktop" >/dev/null 2>&1; then
    echo "✅ Proceso docker-desktop: EN EJECUCIÓN"
    echo ""
    echo "   PIDs detectados:"
    pgrep -fa "docker-desktop" | head -10 | sed 's/^/   /'
  else
    echo "⚪ Proceso docker-desktop: NO está en ejecución."
  fi

  echo ""

  if _docker_have systemctl; then
    if _unit_exists_system docker-desktop.service; then
      echo "📋 [System-wide] docker-desktop.service:"
      $SUDO systemctl --no-pager --full status docker-desktop.service || true
    elif _unit_exists_user docker-desktop.service; then
      echo "📋 [User] docker-desktop.service:"
      systemctl --user --no-pager --full status docker-desktop.service || true
    else
      echo "ℹ️  No se detectó unidad systemd docker-desktop.service."
    fi
  fi

  echo ""

  if _docker_have docker-desktop; then
    echo "✅ Binario docker-desktop: disponible en PATH."
  elif _docker_have flatpak && flatpak info com.docker.desktop >/dev/null 2>&1; then
    echo "✅ Docker Desktop disponible vía Flatpak (com.docker.desktop)."
  else
    echo "⚠️  No se detectó docker-desktop (ni binario ni Flatpak)."
  fi

  pause; menu_docker_services
}

# ---------- Reiniciar Docker Engine ----------
docker_restart_engine() {
  clear
  echo "======================================="
  echo "🐳 ESTADO Y SERVICIOS DOCKER"
  echo "Reiniciar Docker Engine"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  local SUDO=$(_docker_sudo)

  read -p "⚠️  ¿Confirma reinicio de Docker Engine? (S/N): " confirm
  if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
    echo "Operación cancelada."
    pause; menu_docker_services; return
  fi

  if ! _docker_have systemctl; then
    echo "❌ systemctl no disponible."
    pause; menu_docker_services; return
  fi

  if _unit_exists_system docker.service; then
    echo "🔄 Reiniciando docker.service (system-wide)..."
    $SUDO systemctl daemon-reload || true
    $SUDO systemctl restart docker.service
    if _unit_exists_system docker.socket; then
      echo "🔄 Reiniciando docker.socket..."
      $SUDO systemctl restart docker.socket || true
    fi
    echo ""
    $SUDO systemctl --no-pager --full status docker.service || true

  elif _unit_exists_user docker.service; then
    echo "🔄 Reiniciando docker.service (rootless/user)..."
    systemctl --user daemon-reload || true
    systemctl --user restart docker.service
    if _unit_exists_user docker.socket; then
      echo "🔄 Reiniciando docker.socket (user)..."
      systemctl --user restart docker.socket || true
    fi
    echo ""
    systemctl --user --no-pager --full status docker.service || true

  else
    echo "⚠️  docker.service no detectado vía systemd."
    if pgrep -x dockerd >/dev/null 2>&1; then
      echo "   Intentando terminar dockerd (proceso directo)..."
      $SUDO pkill -TERM dockerd || true
      sleep 2
    fi
    echo "❌ Sin unidad systemd no es posible garantizar el reinicio del daemon."
  fi

  echo ""
  if _docker_have docker; then
    sleep 1
    if docker info >/dev/null 2>&1; then
      echo "✅ Docker Engine responde correctamente tras el reinicio."
    else
      echo "⚠️  docker info aún falla. Espera unos segundos y vuelve a verificar."
    fi
  fi

  pause; menu_docker_services
}

# ---------- Reiniciar Docker Desktop ----------
docker_restart_desktop() {
  clear
  echo "======================================="
  echo "🐳 ESTADO Y SERVICIOS DOCKER"
  echo "Reiniciar Docker Desktop"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  local SUDO=$(_docker_sudo)

  read -p "⚠️  ¿Confirma reinicio de Docker Desktop? (S/N): " confirm
  if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
    echo "Operación cancelada."
    pause; menu_docker_services; return
  fi

  if pgrep -f "docker-desktop" >/dev/null 2>&1; then
    echo "🛑 Cerrando procesos docker-desktop..."
    pkill -TERM -f "docker-desktop" || true
    sleep 2
    if pgrep -f "docker-desktop" >/dev/null 2>&1; then
      echo "   Forzando cierre (SIGKILL)..."
      pkill -KILL -f "docker-desktop" || true
      sleep 1
    fi
    echo "✅ Procesos detenidos."
  else
    echo "ℹ️  No se detectaron procesos docker-desktop en ejecución."
  fi

  echo ""

  if _docker_have systemctl; then
    if _unit_exists_system docker-desktop.service; then
      echo "🔄 Reiniciando docker-desktop.service (system-wide)..."
      $SUDO systemctl restart docker-desktop.service || true
      $SUDO systemctl --no-pager --full status docker-desktop.service || true
      pause; menu_docker_services; return
    elif _unit_exists_user docker-desktop.service; then
      echo "🔄 Reiniciando docker-desktop.service (user)..."
      systemctl --user restart docker-desktop.service || true
      systemctl --user --no-pager --full status docker-desktop.service || true
      pause; menu_docker_services; return
    fi
  fi

  if _docker_have docker-desktop; then
    echo "🚀 Iniciando Docker Desktop (binario) en background..."
    nohup docker-desktop >/dev/null 2>&1 &
    disown || true
    echo "✅ Docker Desktop iniciado."
  elif _docker_have flatpak && flatpak info com.docker.desktop >/dev/null 2>&1; then
    echo "🚀 Iniciando Docker Desktop vía Flatpak en background..."
    nohup flatpak run com.docker.desktop >/dev/null 2>&1 &
    disown || true
    echo "✅ Docker Desktop iniciado vía Flatpak."
  else
    echo "⚠️  No se encontró forma de iniciar Docker Desktop."
    echo "   Métodos soportados: binario 'docker-desktop', Flatpak 'com.docker.desktop', systemd."
  fi

  pause; menu_docker_services
}

# ---------- Reiniciar ambos ----------
docker_restart_all() {
  clear
  echo "======================================="
  echo "🐳 ESTADO Y SERVICIOS DOCKER"
  echo "Reiniciar Docker Engine + Docker Desktop"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  read -p "⚠️  ¿Confirma reinicio de Docker Engine Y Docker Desktop? (S/N): " confirm
  if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
    echo "Operación cancelada."
    pause; menu_docker_services; return
  fi

  local SUDO=$(_docker_sudo)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 [1/2] Reiniciando Docker Engine..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if _docker_have systemctl; then
    if _unit_exists_system docker.service; then
      $SUDO systemctl daemon-reload || true
      $SUDO systemctl restart docker.service
      _unit_exists_system docker.socket && $SUDO systemctl restart docker.socket || true
      echo "✅ Docker Engine (system-wide) reiniciado."
    elif _unit_exists_user docker.service; then
      systemctl --user daemon-reload || true
      systemctl --user restart docker.service
      _unit_exists_user docker.socket && systemctl --user restart docker.socket || true
      echo "✅ Docker Engine (rootless) reiniciado."
    else
      echo "⚠️  docker.service no detectado vía systemd."
    fi
  else
    echo "⚠️  systemctl no disponible."
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 [2/2] Reiniciando Docker Desktop..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if pgrep -f "docker-desktop" >/dev/null 2>&1; then
    echo "   Cerrando procesos docker-desktop..."
    pkill -TERM -f "docker-desktop" || true
    sleep 2
    pgrep -f "docker-desktop" >/dev/null 2>&1 && pkill -KILL -f "docker-desktop" || true
    sleep 1
    echo "   Procesos detenidos."
  fi

  if _docker_have systemctl; then
    if _unit_exists_system docker-desktop.service; then
      $SUDO systemctl restart docker-desktop.service || true
      echo "✅ Docker Desktop (system-wide) reiniciado."
    elif _unit_exists_user docker-desktop.service; then
      systemctl --user restart docker-desktop.service || true
      echo "✅ Docker Desktop (user) reiniciado."
    elif _docker_have docker-desktop; then
      nohup docker-desktop >/dev/null 2>&1 & disown || true
      echo "✅ Docker Desktop (binario) iniciado en background."
    elif _docker_have flatpak && flatpak info com.docker.desktop >/dev/null 2>&1; then
      nohup flatpak run com.docker.desktop >/dev/null 2>&1 & disown || true
      echo "✅ Docker Desktop (Flatpak) iniciado en background."
    else
      echo "⚠️  No se encontró forma de iniciar Docker Desktop."
    fi
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  sleep 2
  if _docker_have docker && docker info >/dev/null 2>&1; then
    echo "✅ Docker responde correctamente."
  else
    echo "⚠️  Docker aún no responde. Espera unos segundos y verifica el estado."
  fi

  pause; menu_docker_services
}

#############################################################
###          Feature - Portainer (VERSIÓN LINUX COMPLETA)
#############################################################

# Configuración Portainer
PORTAINER_NAME="${PORTAINER_NAME:-portainer}"
PORTAINER_IMAGE="${PORTAINER_IMAGE:-portainer/portainer-ce:latest}"
PORTAINER_PORT="${PORTAINER_PORT:-9000}"
PORTAINER_PORT_HTTPS="${PORTAINER_PORT_HTTPS:-9443}"
PORTAINER_VOLUME="portainer_data"

# =========================================================
# FUNCIONES AUXILIARES (VERIFICACIÓN DE PUERTOS)
# =========================================================

# Verifica si un puerto está disponible en Linux
_port_is_free_linux() {
    local port="$1"
    
    # Usar ss (Linux moderno) - más rápido y confiable
    if command -v ss >/dev/null 2>&1; then
        if ss -ltn | grep -q ":${port} "; then
            return 1 # Ocupado
        else
            return 0 # Libre
        fi
    fi
    
    # Fallback: netstat (Linux)
    if command -v netstat >/dev/null 2>&1; then
        if netstat -ltn | grep -q ":${port} "; then
            return 1 # Ocupado
        else
            return 0 # Libre
        fi
    fi
    
    # Fallback: lsof (Linux/macOS)
    if command -v lsof >/dev/null 2>&1; then
        if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            return 1 # Ocupado
        else
            return 0 # Libre
        fi
    fi
    
    return 2 # No se pudo determinar
}

# Obtiene información de quién ocupa un puerto en Linux
_port_owner_hint_linux() {
    local port="$1"
    
    # Buscar en contenedores Docker (más probable)
    if command -v docker >/dev/null 2>&1; then
        # Buscar específicamente el contenedor que usa el puerto
        local container_info
        container_info=$(docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep ":${port}->" | head -1)
        if [[ -n "$container_info" ]]; then
            echo "Contenedor: $container_info"
            return 0
        fi
    fi
    
    # Linux: lsof para proceso
    if command -v lsof >/dev/null 2>&1; then
        local process_info
        process_info=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print "Proceso: " $1 " (PID " $2 ")"}')
        if [[ -n "$process_info" ]]; then
            echo "$process_info"
            return 0
        fi
    fi
    
    # Linux: ss con proceso
    if command -v ss >/dev/null 2>&1 && command -v awk >/dev/null 2>&1; then
        local process_name
        process_name=$(ss -ltnp 2>/dev/null | grep ":${port} " | awk -F 'users:' '{print $2}' | cut -d'"' -f2)
        if [[ -n "$process_name" ]]; then
            echo "Proceso: $process_name"
            return 0
        fi
    fi
    
    echo "desconocido (puerto en uso)"
    return 1
}

# Encuentra el primer puerto libre a partir de un rango (evitando 9000-9099)
_find_free_port_linux() {
    local start_port="$1"
    local avoid_range_start=9000
    local avoid_range_end=9099
    
    # Si el puerto solicitado está en rango conflictivo, empezar desde otro lado
    if [[ $start_port -ge $avoid_range_start ]] && [[ $start_port -le $avoid_range_end ]]; then
        start_port=9100
        echo "⚠️  Evitando rango 9000-9099 (usado por Minio, etc.)" >&2
    fi
    
    local max_attempts=100
    for ((i=0; i<max_attempts; i++)); do
        local test_port=$((start_port + i))
        
        # Saltar el rango completo de 9000-9099
        if [[ $test_port -ge 9000 ]] && [[ $test_port -le 9099 ]]; then
            test_port=9100
        fi
        
        _port_is_free_linux "$test_port"
        if [[ $? -eq 0 ]]; then
            echo "$test_port"
            return 0
        fi
    done
    
    # Último recurso: puerto aleatorio
    echo $(( RANDOM % 10000 + 10000 ))
}

# Verifica y configura el puerto para Portainer
_configure_portainer_port_linux() {
    local default_port="$1"
    local suggested_port
    local selected_port
    
    echo "🔍 Verificando disponibilidad del puerto $default_port..."
    echo "   (Nota: Minio usa comúnmente el puerto 9000)"
    
    _port_is_free_linux "$default_port"
    local rc=$?
    
    if [[ $rc -eq 0 ]]; then
        echo "✅ Puerto $default_port está disponible"
        PORTAINER_PORT="$default_port"
        return 0
    elif [[ $rc -eq 2 ]]; then
        echo "⚠️  No se pudo verificar el puerto. Se usará $default_port"
        PORTAINER_PORT="$default_port"
        return 0
    fi
    
    # Puerto ocupado - mostrar información detallada
    local owner
    owner=$(_port_owner_hint_linux "$default_port")
    echo "❌ Puerto $default_port NO está disponible"
    echo "   └─ $owner"
    echo ""
    
    # Mostrar contenedores que usan puertos similares
    echo "📊 Puertos en uso por contenedores:"
    docker ps --format '   └─ {{.Names}}: {{.Ports}}' | grep -E ":[0-9]+->" | head -5
    echo ""
    
    # Buscar puerto sugerido (evitando el rango 9000-9099)
    suggested_port=$(_find_free_port_linux 9100)
    echo "📌 Puertos sugeridos (evitando rango 9000-9099):"
    echo "   - Alternativa 1: $suggested_port (automático)"
    echo "   - Alternativa 2: 9443 (HTTPS UI - puede estar libre)"
    echo "   - Alternativa 3: Puerto personalizado"
    echo ""
    
    while true; do
        read -p "👉 Ingrese puerto para Portainer [$suggested_port]: " selected_port
        selected_port="${selected_port:-$suggested_port}"
        
        # Validación
        if ! [[ "$selected_port" =~ ^[0-9]+$ ]] || [[ "$selected_port" -lt 1024 ]] || [[ "$selected_port" -gt 65535 ]]; then
            echo "❌ Puerto inválido. Use puerto > 1024 (no privilegiado) y < 65536"
            continue
        fi
        
        # Advertencia si está en rango conflictivo
        if [[ $selected_port -ge 9000 ]] && [[ $selected_port -le 9099 ]]; then
            echo "⚠️  ADVERTENCIA: El rango 9000-9099 es usado comúnmente por:"
            echo "   - Minio (9000)"
            echo "   - Portainer (9000)"
            echo "   - Otros servicios"
            read -p "   ¿Continuar de todas formas? (s/N): " confirm_range
            if [[ ! "$confirm_range" =~ ^[Ss]$ ]]; then
                continue
            fi
        fi
        
        # Verificar disponibilidad
        _port_is_free_linux "$selected_port"
        local check_rc=$?
        
        if [[ $check_rc -eq 0 ]]; then
            PORTAINER_PORT="$selected_port"
            echo "✅ Puerto $selected_port disponible y seleccionado"
            return 0
        elif [[ $check_rc -eq 2 ]]; then
            PORTAINER_PORT="$selected_port"
            echo "⚠️  Usando puerto $selected_port (no se pudo verificar disponibilidad)"
            return 0
        else
            owner=$(_port_owner_hint_linux "$selected_port")
            echo "❌ Puerto $selected_port ocupado por: $owner"
            echo "   Intente con otro puerto"
        fi
    done
}

# =========================================================
# FUNCIONES PRINCIPALES DE PORTAINER
# =========================================================

# Obtiene el puerto publicado actual de Portainer
_get_portainer_mapped_port() {
    local container="$1"
    docker port "$container" 9000/tcp 2>/dev/null | head -1 | awk -F: '{print $NF}' | tr -d '\n'
}

# Inicia Portainer (crea si no existe, inicia si está detenido)
portainer_start() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Iniciar (Linux)"
    banner_menu_ambiente
    echo "======================================="
    echo ""

    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }

    # Verificar Docker daemon
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker daemon no está en ejecución"
        pause
        menu_portainer
        return 1
    fi

    # Mostrar puertos actuales en uso
    echo "📊 Puertos actualmente en uso por contenedores:"
    docker ps --format '   └─ {{.Names}}: {{.Ports}}' | head -3
    echo ""

    # Verificar si el contenedor existe
    if docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        # Contenedor existe
        echo "📦 Contenedor '$PORTAINER_NAME' encontrado"
        
        if docker ps --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
            # Está en ejecución
            local mapped_port
            mapped_port=$(_get_portainer_mapped_port "$PORTAINER_NAME")
            
            echo "✅ Portainer ya está EN EJECUCIÓN"
            if [[ -n "$mapped_port" ]]; then
                echo "   └─ UI: http://localhost:${mapped_port}"
                echo "   └─ HTTPS: https://localhost:${PORTAINER_PORT_HTTPS}"
            else
                echo "⚠️  Contenedor sin puerto publicado"
                echo "   Recomendación: Use opción 6 (Recrear)"
            fi
        else
            # Está detenido
            echo "⏸️  Contenedor detenido"
            echo ""
            read -p "¿Iniciar contenedor existente? (S/N): " start_confirm
            if [[ "$start_confirm" =~ ^[Ss]$ ]]; then
                echo "▶️  Iniciando $PORTAINER_NAME..."
                if docker start "$PORTAINER_NAME" >/dev/null 2>&1; then
                    echo "✅ Contenedor iniciado"
                    sleep 2
                    local mapped_port=$(_get_portainer_mapped_port "$PORTAINER_NAME")
                    [[ -n "$mapped_port" ]] && echo "   └─ UI: http://localhost:${mapped_port}"
                else
                    echo "❌ Error al iniciar"
                fi
            fi
        fi
        
        pause
        menu_portainer
        return 0
    fi

    # Contenedor no existe - crear nuevo
    echo "📦 No existe contenedor Portainer"
    echo "   Creando nueva instancia..."
    echo ""

    # CONFIGURAR PUERTO (con detección de Minio)
    if ! _configure_portainer_port_linux "9000"; then
        echo "❌ Error en configuración de puerto"
        pause
        menu_portainer
        return 1
    fi

    # Verificar que el puerto seleccionado esté realmente libre
    _port_is_free_linux "$PORTAINER_PORT"
    if [[ $? -eq 1 ]]; then
        echo "❌ El puerto $PORTAINER_PORT se ocupó entre la verificación y ahora"
        owner=$(_port_owner_hint_linux "$PORTAINER_PORT")
        echo "   Ocupado por: $owner"
        pause
        menu_portainer
        return 1
    fi

    # Crear volumen persistente
    if ! docker volume ls --format '{{.Name}}' | grep -qx "$PORTAINER_VOLUME"; then
        echo "📦 Creando volumen persistente: $PORTAINER_VOLUME"
        docker volume create "$PORTAINER_VOLUME" >/dev/null || {
            echo "❌ Error al crear volumen"
            pause
            menu_portainer
            return 1
        }
    fi

    # Crear contenedor
    echo "🚀 Creando contenedor Portainer (puerto $PORTAINER_PORT)..."
    echo ""

    local run_cmd="docker run -d \
        --name $PORTAINER_NAME \
        --restart unless-stopped \
        -p ${PORTAINER_PORT}:9000 \
        -p ${PORTAINER_PORT_HTTPS}:9443 \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v $PORTAINER_VOLUME:/data \
        $PORTAINER_IMAGE"

    # Ejecutar y capturar salida para diagnóstico
    local output
    output=$(eval "$run_cmd" 2>&1)
    local exit_code=$?

    if [[ $exit_code -eq 0 ]] && [[ -n "$output" ]] && [[ "$output" =~ ^[a-f0-9]{64}$ ]]; then
        echo "✅ Portainer creado exitosamente"
        echo ""
        echo "   ┌─────────────────────────────────────┐"
        echo "   │  🌐 UI: http://localhost:${PORTAINER_PORT}  │"
        echo "   │  🔒 HTTPS: https://localhost:${PORTAINER_PORT_HTTPS} │"
        echo "   └─────────────────────────────────────┘"
        echo ""
        echo "⏳ Esperando 3 segundos para inicialización..."
        sleep 3
        
        # Verificar que el contenedor esté corriendo
        if docker ps --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
            echo "✅ Contenedor en ejecución"
        else
            echo "⚠️  Contenedor creado pero no está corriendo"
            echo "   Revise logs: docker logs $PORTAINER_NAME"
        fi
    else
        echo "❌ Error al crear Portainer"
        echo "   └─ $output"
        echo ""
        echo "📋 Diagnóstico:"
        echo "   └─ Puerto $PORTAINER_PORT: $(ss -ltn | grep -q ":${PORTAINER_PORT} " && echo "OCUPADO" || echo "libre")"
        echo "   └─ Docker: $(docker info >/dev/null 2>&1 && echo "OK" || echo "ERROR")"
    fi

    pause
    menu_portainer
}

# Detiene Portainer
portainer_stop() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Detener"
    banner_menu_ambiente
    echo "======================================="
    echo ""

    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }

    if ! docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "ℹ️  El contenedor '$PORTAINER_NAME' no existe"
        pause
        menu_portainer
        return 0
    fi

    if docker ps --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "⏹️  Deteniendo Portainer..."
        if docker stop "$PORTAINER_NAME" >/dev/null 2>&1; then
            echo "✅ Portainer detenido correctamente"
        else
            echo "❌ Error al detener Portainer"
        fi
    else
        echo "ℹ️  Portainer ya está detenido"
    fi

    pause
    menu_portainer
}

# Reinicia Portainer
portainer_restart() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Reiniciar"
    banner_menu_ambiente
    echo "======================================="
    echo ""

    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }

    if ! docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "ℹ️  El contenedor '$PORTAINER_NAME' no existe"
        echo "   Se creará uno nuevo..."
        pause
        portainer_start
        return $?
    fi

    echo "🔄 Reiniciando Portainer..."
    if docker restart "$PORTAINER_NAME" >/dev/null 2>&1; then
        echo "✅ Portainer reiniciado correctamente"
        
        local mapped_port
        mapped_port=$(_get_portainer_mapped_port "$PORTAINER_NAME")
        
        if [[ -n "$mapped_port" ]]; then
            echo "   └─ UI: http://localhost:${mapped_port}"
        else
            echo "⚠️  Contenedor reiniciado pero sin puerto publicado"
            echo "   Recomendación: Use opción 6 (Recrear) para corregir el mapeo"
        fi
    else
        echo "❌ Error al reiniciar Portainer"
    fi

    pause
    menu_portainer
}

# Recrea Portainer (destruye y crea nuevo)
portainer_recreate() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Recrear (Linux)"
    banner_menu_ambiente
    echo "======================================="
    echo ""
    
    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }
    
    echo "⚠️  Esta acción eliminará el contenedor actual"
    echo "   El volumen '$PORTAINER_VOLUME' con los datos se conservará"
    echo ""
    echo "📊 Estado actual:"
    if docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "   └─ Contenedor: EXISTE"
        docker ps -a --filter "name=$PORTAINER_NAME" --format "      Estado: {{.Status}}"
    else
        echo "   └─ Contenedor: NO EXISTE"
    fi
    
    # Mostrar si Minio está usando el puerto
    if command -v ss >/dev/null 2>&1; then
        if ss -ltn | grep -q ":9000 "; then
            echo "   └─ Puerto 9000: OCUPADO"
        fi
    fi
    echo ""
    
    read -p "¿Confirmar recreación? (S/N): " confirm
    if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
        echo "Operación cancelada"
        pause
        menu_portainer
        return 0
    fi
    
    # Configurar puerto
    if ! _configure_portainer_port_linux "9000"; then
        echo "❌ Error en configuración de puerto"
        pause
        menu_portainer
        return 1
    fi
    
    # Eliminar contenedor si existe
    if docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "🛑 Eliminando contenedor existente..."
        docker stop "$PORTAINER_NAME" >/dev/null 2>&1
        docker rm "$PORTAINER_NAME" >/dev/null 2>&1
        echo "   ✅ Contenedor eliminado"
    fi
    
    # Crear volumen si no existe
    if ! docker volume ls --format '{{.Name}}' | grep -qx "$PORTAINER_VOLUME"; then
        echo "📦 Creando volumen persistente..."
        docker volume create "$PORTAINER_VOLUME" >/dev/null
    fi
    
    # Crear nuevo contenedor
    echo "🚀 Creando nuevo contenedor (puerto $PORTAINER_PORT)..."
    echo ""
    
    local run_cmd="docker run -d \
        --name $PORTAINER_NAME \
        --restart unless-stopped \
        -p ${PORTAINER_PORT}:9000 \
        -p ${PORTAINER_PORT_HTTPS}:9443 \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v $PORTAINER_VOLUME:/data \
        $PORTAINER_IMAGE"
    
    local output
    output=$(eval "$run_cmd" 2>&1)
    
    if [[ $? -eq 0 ]] && [[ -n "$output" ]]; then
        echo "✅ Portainer recreado exitosamente"
        echo ""
        echo "   ┌─────────────────────────────────────┐"
        echo "   │  🌐 UI: http://localhost:${PORTAINER_PORT}  │"
        echo "   │  🔒 HTTPS: https://localhost:${PORTAINER_PORT_HTTPS} │"
        echo "   └─────────────────────────────────────┘"
        echo ""
        echo "⏳ Esperando 3 segundos..."
        sleep 3
    else
        echo "❌ Error al crear el contenedor"
        echo "   └─ $output"
    fi
    
    pause
    menu_portainer
}

# Elimina el contenedor de Portainer (con opción de eliminar persistencia)
portainer_destroy() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Eliminar Contenedor"
    banner_menu_ambiente
    echo "======================================="
    echo ""
    
    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }
    
    if ! docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "ℹ️  El contenedor '$PORTAINER_NAME' no existe"
        pause
        menu_portainer
        return 0
    fi
    
    echo "⚠️  ADVERTENCIA: Esta acción eliminará el contenedor '$PORTAINER_NAME'"
    echo ""
    
    # Preguntar por el volumen
    local delete_volume=false
    if docker volume ls --format '{{.Name}}' | grep -qx "$PORTAINER_VOLUME"; then
        echo "📦 Se detectó el volumen persistente: $PORTAINER_VOLUME"
        echo "   Este volumen contiene TODAS las configuraciones de Portainer"
        read -p "¿Desea eliminar TAMBIÉN el volumen con TODOS LOS DATOS? (s/N): " confirm_volume
        if [[ "$confirm_volume" =~ ^[Ss]$ ]]; then
            delete_volume=true
            echo "⚠️  ¡ATENCIÓN! Se eliminarán TODAS las configuraciones de Portainer"
        fi
    fi
    
    echo ""
    read -p "¿Confirmar eliminación del contenedor? (S/N): " confirm
    if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
        echo "Operación cancelada"
        pause
        menu_portainer
        return 0
    fi
    
    echo "🛑 Deteniendo contenedor..."
    docker stop "$PORTAINER_NAME" >/dev/null 2>&1
    
    echo "🗑️  Eliminando contenedor..."
    if docker rm "$PORTAINER_NAME" >/dev/null 2>&1; then
        echo "✅ Contenedor eliminado exitosamente"
    else
        echo "❌ Error al eliminar el contenedor"
        pause
        menu_portainer
        return 1
    fi
    
    # Eliminar volumen si se solicitó
    if [[ "$delete_volume" == true ]]; then
        echo ""
        echo "🗑️  Eliminando volumen $PORTAINER_VOLUME..."
        if docker volume rm "$PORTAINER_VOLUME" >/dev/null 2>&1; then
            echo "✅ Volumen eliminado exitosamente"
        else
            echo "❌ Error al eliminar el volumen"
        fi
    else
        echo ""
        echo "📦 El volumen '$PORTAINER_VOLUME' conserva los datos"
        echo "   Para eliminarlo manualmente: docker volume rm $PORTAINER_VOLUME"
    fi
    
    pause
    menu_portainer
}

# Abrir Portainer en navegador
portainer_open_browser() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Abrir en navegador"
    banner_menu_ambiente
    echo "======================================="
    echo ""

    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }

    if ! docker ps --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "❌ Portainer no está en ejecución"
        echo "   Inícielo primero (opción 1)"
        pause
        menu_portainer
        return 1
    fi

    local mapped_port
    mapped_port=$(_get_portainer_mapped_port "$PORTAINER_NAME")
    
    if [[ -z "$mapped_port" ]]; then
        echo "❌ No se detectó puerto publicado para Portainer"
        echo "   Use la opción 6 (Recrear) para corregir esto"
        pause
        menu_portainer
        return 1
    fi

    local url="http://localhost:${mapped_port}"
    echo "🌐 Abriendo: $url"
    
    # Abrir navegador en Linux
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1
        echo "✅ Navegador abierto"
    elif command -v gnome-open >/dev/null 2>&1; then
        gnome-open "$url" >/dev/null 2>&1
    elif command -v kde-open >/dev/null 2>&1; then
        kde-open "$url" >/dev/null 2>&1
    else
        echo "⚠️  No se pudo abrir el navegador automáticamente"
        echo "   Abra manualmente: $url"
    fi

    pause
    menu_portainer
}

# Ver logs de Portainer
portainer_logs() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Ver Logs"
    banner_menu_ambiente
    echo "======================================="
    echo ""

    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }

    if ! docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "❌ El contenedor '$PORTAINER_NAME' no existe"
        pause
        menu_portainer
        return 1
    fi

    echo "📋 Últimos 50 logs de Portainer:"
    echo "────────────────────────────────────────────────────────"
    docker logs --tail 50 "$PORTAINER_NAME" 2>&1
    echo "────────────────────────────────────────────────────────"
    echo ""
    echo "💡 Para ver logs en tiempo real: docker logs -f $PORTAINER_NAME"
    echo "   Para salir: Ctrl+C"

    pause
    menu_portainer
}

# Ver información detallada de Portainer
portainer_info() {
    clear
    echo "======================================="
    echo "🧰 PORTAINER - Información Detallada"
    banner_menu_ambiente
    echo "======================================="
    echo ""

    command -v docker >/dev/null 2>&1 || { 
        echo "❌ docker CLI no disponible."
        pause
        menu_portainer
        return 1
    }

    if ! docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
        echo "❌ El contenedor '$PORTAINER_NAME' no existe"
        pause
        menu_portainer
        return 1
    fi

    echo "📊 ESTADO DEL CONTENEDOR:"
    echo "────────────────────────────────────────────────────────"
    docker ps -a --filter "name=$PORTAINER_NAME" --format "   Nombre: {{.Names}}\n   Estado: {{.Status}}\n   Imagen: {{.Image}}\n   Creado: {{.CreatedAt}}\n   Puerto: {{.Ports}}"
    echo ""

    local mapped_port
    mapped_port=$(_get_portainer_mapped_port "$PORTAINER_NAME")
    
    if [[ -n "$mapped_port" ]]; then
        echo "🌐 URL DE ACCESO:"
        echo "   └─ http://localhost:${mapped_port}"
        echo "   └─ https://localhost:${PORTAINER_PORT_HTTPS}"
    else
        echo "⚠️  No hay puerto publicado para la UI"
    fi
    
    echo ""
    echo "📦 VOLUMEN PERSISTENTE:"
    echo "   └─ Nombre: $PORTAINER_VOLUME"
    
    if docker volume ls --format '{{.Name}}' | grep -qx "$PORTAINER_VOLUME"; then
        echo "   └─ Estado: ✅ Existe"
        local volume_info=$(docker volume inspect "$PORTAINER_VOLUME" --format '   └─ Mountpoint: {{.Mountpoint}}' 2>/dev/null)
        if [[ -n "$volume_info" ]]; then
            echo "$volume_info"
        fi
    else
        echo "   └─ Estado: ❌ No existe"
    fi
    
    echo ""
    echo "🔧 COMANDOS ÚTILES:"
    echo "   └─ Ver logs: docker logs $PORTAINER_NAME"
    echo "   └─ Shell: docker exec -it $PORTAINER_NAME sh"
    echo "   └─ Detener: docker stop $PORTAINER_NAME"
    echo "   └─ Iniciar: docker start $PORTAINER_NAME"
    echo "   └─ Eliminar: docker rm $PORTAINER_NAME"

    pause
    menu_portainer
}


#############################################################
###       Funciones generales   
#############################################################
truncate_text() {
  local text="$1"
  local length="$2"
  if [[ ${#text} -gt $length ]]; then
    echo "${text:0:$(($length-3))}..."
  else
    printf "%-${length}s" "$text"
  fi
}

define_compose_file() {
  case "$ENV" in
    "dev")
      COMPOSE_FILE="docker-compose-dev.yml"
      ;;
    "qa")
      COMPOSE_FILE="docker-compose-qa.yml"
      ;;
    "prd")
      COMPOSE_FILE="docker-compose.yml"
      ;;
    *)
      echo "Entorno no válido. Se usará el archivo por defecto: docker-compose-dev.yml"
      COMPOSE_FILE="docker-compose-dev.yml"
      ;;
  esac
}

exit_script() {
  clear
  echo "======================================="
  echo "Gracias por usar Docker Tools v1."
  echo "Todos los procesos han sido cerrados correctamente."
  echo "======================================="
  exit 0
}

pause() {
  read -p "Presione Enter para continuar..."
}


#############################################################
###       Punto de entrada principal  
#############################################################
menu
