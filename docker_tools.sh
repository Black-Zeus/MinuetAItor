#!/bin/bash

# Función para leer PROJECT_NAME desde .env
read_project_name() {
    local env_file=".env"
    
    if [[ -f "$env_file" ]]; then
        # Buscar la línea que contiene PROJECT_NAME y extraer el valor
        local project_line=$(grep "^PROJECT_NAME=" "$env_file" 2>/dev/null)
        if [[ -n "$project_line" ]]; then
            # Extraer el valor después del =, removiendo espacios y comillas
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
  # Usar IP global si está disponible, sino detectarla
  local current_ip
  if [[ -n "$CURRENT_IP" ]]; then
    current_ip="$CURRENT_IP"
  else
    current_ip=$(get_current_ip)
    # Si se detecta IP, guardarla globalmente para evitar futuras detecciones
    if [[ -n "$current_ip" ]]; then
      CURRENT_IP="$current_ip"
    else
      current_ip="No detectada"
    fi
  fi

  # Detectar rama de Git (si aplica)
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
  echo " 4. ⚙️  CONFIGURACIÓN DEL SISTEMA"
  echo " 5. 📱 HERRAMIENTAS EXPO"
  echo " 6. 📄 GESTIÓN DE TEMPLATES .ENV"
  echo ""
  echo " S. 🚪 Salir"
  echo "======================================="
  read -p "👉 Seleccione una opción [1-6, S]: " choice

  case "$choice" in
    1) menu_contenedores ;;
    2) menu_monitoreo ;;
    3) menu_limpieza ;;
    4) menu_configuracion ;;
    5) menu_expo ;;
    6) menu_templates ;;
    [Ss]) exit_script ;;
    *)
      echo "❌ Opción inválida. Inténtelo de nuevo."
      sleep 3
      menu
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
  echo " 2. 🖼️  Limpiar imágenes no utilizadas"
  echo " 3. 💾 Limpiar volúmenes no utilizados"
  echo " 4. 🗑️  Limpiar todo (contenedores, imágenes y volúmenes)"
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
  echo "2) 🏗️  EAS Build (Generar APK/AAB)"
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
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV down
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
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV down
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

  # Listar contenedores activos con la etiqueta del stack
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
    #printf "%2d | %-16s | %-31s | %-35s | %-10s\n" $((i+1)) "${container[0]}" "${container[1]}" "${container[2]}" "${container[3]}"
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

  # Obtener la lista de contenedores con el separador personalizado
  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}}#{{.Names}}#{{.Image}}#{{.Ports}}#{{.Command}}")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "No se encontraron contenedores activos con la etiqueta $LABEL_FILTER."
    sleep 3
    menu_monitoreo
  fi

  # Encabezado de la tabla
  echo " # | SERVICIO                 | IMAGEN                                | PUERTO(S)                 | COMANDO"
  echo "---|--------------------------|---------------------------------------|---------------------------|-------------------------------"

  # Iterar sobre los contenedores y mostrarlos con índices
  for i in "${!containers[@]}"; do
      # Dividir la información del contenedor usando el separador #
      IFS="#" read -r id name image ports command <<< "${containers[$i]}"

      # Truncar los textos si exceden el tamaño máximo
      formatted_name=$(truncate_text "$name" 24)
      formatted_image=$(truncate_text "$image" 37)
      formatted_ports=$(truncate_text "$ports" 25)
      formatted_command=$(truncate_text "$command" 30)

      # Imprimir fila formateada
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

  # Obtener la lista de contenedores en formato personalizado
  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}} {{.Status}}")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "No se encontraron contenedores activos con la etiqueta $LABEL_FILTER."
    sleep 3
    menu_monitoreo
  fi

  # Encabezado de la tabla
  echo "  # | ID               | NOMBRE                          | IMAGEN                              | ESTADO"
  echo "----|------------------|---------------------------------|-------------------------------------|------------"

  # Iterar sobre los contenedores y mostrarlos con índices
  for i in "${!containers[@]}"; do
    container=(${containers[$i]})
    #printf "%3d | %-16s | %-31s | %-35s | %-10s\n" $((i+1)) "${container[0]}" "${container[1]}" "${container[2]}" "${container[3]}"
    # Aplicar truncamiento a cada campo según el tamaño definido en printf
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

    # Aplicar truncamiento a cada campo según el tamaño definido en printf
    printf "%2d | %-16s | %-31s | %-35s | %-10s\n" \
        $((i+1)) \
        "$(truncate_text "${container[0]}" 16)" \
        "$(truncate_text "${container[1]}" 31)" \
        "$(truncate_text "${container[2]}" 35)" \
        "$(truncate_text "${container[3]}" 10)"
  done

  # Agregar opción para volver al menú con formato alineado
  exit_index=$(( ${#containers[@]} + 1 ))
  echo "-----------------------------------------------------------------------------------------------------------"
  printf "%2d | %-40s\n" "$exit_index"  "$(truncate_text "     << Volver al menú >>" 30) " 
  echo
  read -p "Seleccione el índice del contenedor (o $exit_index para volver): " index

  # Si el usuario elige la opción de salir, volver al menú
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
  #docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV down --rmi all --volumes --remove-orphans
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV down --volumes --remove-orphans
  pause
  menu_limpieza
}

clean_images() {
  clear
  echo "======================================="
  echo "Docker Tools - Limpieza"
  echo "Limpiando imágenes no utilizadas"
  banner_menu_ambiente
  echo "======================================="
  echo ""
  
  # Solicitar confirmación antes de proceder
  read -p "¿Estás seguro de que deseas eliminar las imágenes no utilizadas? (s/n): " confirmacion

  # Comprobar la respuesta
  if [[ "$confirmacion" =~ ^[Ss]$ ]]; then
    docker image prune -af
    echo "Las imágenes no utilizadas han sido eliminadas."
  else
    echo "Operación cancelada. No se eliminaron las imágenes."
  fi

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

clean_all() {
  clear
  echo "======================================="
  echo "Docker Tools - Limpieza"
  echo "Limpieza Completa"
  banner_menu_ambiente
  echo "======================================="
  echo ""

  # Limpiar contenedores, imágenes, redes y volúmenes relacionados con el stack
  echo "======================================="
  echo "Limpiando contenedores, redes y volúmenes del stack..."
  echo "======================================="
  #docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV down --rmi all --volumes --remove-orphans
  docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.$ENV down --volumes --remove-orphans

  # Verificar y eliminar volúmenes huérfanos
  echo "======================================="
  echo "Verificando volúmenes huérfanos relacionados con el stack..."
  echo "======================================="
  mapfile -t stack_volumes < <(docker volume ls --filter "dangling=true" --filter "label=$LABEL_FILTER" --format "{{.Name}}")

  if [ ${#stack_volumes[@]} -gt 0 ]; then
    echo "Los siguientes volúmenes serán eliminados:"
    for volume in "${stack_volumes[@]}"; do
      echo " - $volume"
    done

    # Eliminar volúmenes relacionados con el stack
    for volume in "${stack_volumes[@]}"; do
      docker volume rm "$volume"
    done
  else
    echo "No se encontraron volúmenes huérfanos relacionados con el stack."
  fi

  # Eliminar imágenes no utilizadas
  echo "======================================="
  echo "Limpiando imágenes no utilizadas..."
  echo "======================================="

  # Solicitar confirmación antes de proceder
  read -p "¿Estás seguro de que deseas eliminar las imágenes no utilizadas? (s/n): " confirmacion

  # Comprobar la respuesta
  if [[ "$confirmacion" =~ ^[Ss]$ ]]; then
    docker image prune -af
    echo "Las imágenes no utilizadas han sido eliminadas."
  else
    echo "Operación cancelada. No se eliminaron las imágenes."
  fi

  # Eliminar caché de builds generadas
  echo "======================================="
  echo "Limpiando caché de builds generadas..."
  echo "======================================="
  docker builder prune -af

  echo ""
  echo "======================================="
  echo "Limpieza completada."
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

  # Definir colores
  GREEN="\e[32m"
  RED="\e[31m"
  NC="\e[0m"  # Reset color

  read -p "¿Seguro que deseas continuar? (S/N): " confirm
  case "$confirm" in
    [sS]) 
      echo "Verificando contenedores en ejecución..."
      
      # Obtener la lista de nombres de contenedores activos
      mapfile -t active_containers < <(docker ps --format "{{.Names}}")

      for service in mailpit mariadb minio rabbitmq redis redisinsight; do
        # Buscar si hay algún contenedor cuyo nombre contenga el nombre del servicio
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

      # Eliminar carpetas node_modules en todo el proyecto
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

      # Eliminar archivos package-lock.json en todo el proyecto
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


      # Eliminar carpetas __pycache__ en todo el proyecto
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
    
  # Verificar que existe .env antes de continuar
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
        
      # Verificar IP actual en el .env usando función corregida
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

   # Listar contenedores activos del stack
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

    # Si hay solo 1 contenedor, seleccionarlo automáticamente
    if [ ${#containers[@]} -eq 1 ]; then
        container_id=$(echo ${containers[0]} | awk '{print $1}')
        container_name=$(echo ${containers[0]} | awk '{print $2}')
        echo "✅ Contenedor seleccionado automáticamente: $container_name"
        echo ""
    else
        # Si hay múltiples contenedores, mostrar opciones
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
    
    # Obtener todas las variables, ordenarlas alfabéticamente y mostrarlas
    local env_vars=$(docker exec "$container_id" env 2>/dev/null | sort)
    local var_count=$(echo "$env_vars" | wc -l)
    
    if [[ -n "$env_vars" ]]; then
        echo "Total de variables: $var_count"
        echo ""
        
        # Mostrar todas las variables con numeración
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

# Función para obtener IP desde archivo .env
get_ip_from_env() {
    local env_file=".env"
    
    if [[ -f "$env_file" ]]; then
        # Buscar la línea que contiene REACT_NATIVE_PACKAGER_HOSTNAME y extraer el valor
        local ip_line=$(grep "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file" 2>/dev/null)
        if [[ -n "$ip_line" ]]; then
            # Extraer el valor después del =, removiendo espacios y comillas
            echo "$ip_line" | cut -d'=' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//'
        else
            echo ""
        fi
    else
        echo ""
    fi
}

# Función para actualizar la IP en el archivo .env
update_ip_in_compose() {
    local new_ip="$1"
    
    if [[ -z "$new_ip" ]]; then
        echo "❌ No se proporcionó una IP válida."
        return 1
    fi
    
    # Validar formato de IP
    if [[ ! "$new_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "❌ Formato de IP inválido: $new_ip"
        return 1
    fi
    
    # Siempre usar el archivo .env (base) como prioridad
    local env_file=".env"
    
    # Verificar si existe el archivo .env base - ERROR SI NO EXISTE
    if [[ ! -f "$env_file" ]]; then
        echo "❌ El archivo $env_file no existe."
        echo "❌ OPERACIÓN DETENIDA: No se puede continuar sin el archivo .env"
        return 1
    fi
    
    # Crear backup del archivo original con timestamp
    local backup_file="${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$env_file" "$backup_file"
    echo "📋 Backup creado: $backup_file"
    
    # Verificar si la variable ya existe en el archivo
    if grep -q "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file" 2>/dev/null; then
        # Actualizar la IP en el archivo
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
            # Windows Git Bash
            sed -i "s/^REACT_NATIVE_PACKAGER_HOSTNAME=.*/REACT_NATIVE_PACKAGER_HOSTNAME=$new_ip/" "$env_file"
        else
            # Linux
            sed -i "s/^REACT_NATIVE_PACKAGER_HOSTNAME=.*/REACT_NATIVE_PACKAGER_HOSTNAME=$new_ip/" "$env_file"
        fi
        echo "✅ IP actualizada a $new_ip en $env_file"
    else
        # Agregar la variable al final del archivo
        echo "REACT_NATIVE_PACKAGER_HOSTNAME=$new_ip" >> "$env_file"
        echo "✅ Variable REACT_NATIVE_PACKAGER_HOSTNAME=$new_ip agregada a $env_file"
    fi
    
    return 0
}

# Función para mostrar interfaces de red disponibles
show_network_interfaces() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
        # Windows con Git Bash
        if command -v powershell.exe &> /dev/null; then
            # Usar PowerShell para obtener información detallada, omitiendo IPs que terminen en .1
            powershell.exe -Command '
            $adapters = Get-NetAdapter | Where-Object Status -eq "Up"
            foreach ($adapter in $adapters) {
                $ip = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "*.1"}
                if ($ip) {
                    $type = "Otro"
                    if ($adapter.Name -like "*Wi-Fi*" -or $adapter.Name -like "*Wireless*") {
                        $type = "WiFi"
                    } elseif ($adapter.Name -like "*Ethernet*") {
                        $type = "Ethernet"
                    } elseif ($adapter.Name -like "*WSL*" -or $adapter.Name -like "*vEthernet*") {
                        $type = "WSL/Virtual"
                    }
                    Write-Output "   [$type] $($ip.IPAddress) - $($adapter.Name)"
                }
            }' 2>/dev/null | tr -d '\r'
        elif command -v ipconfig &> /dev/null; then
            # Fallback con ipconfig - extraer solo las IPs que no terminen en .1
            echo "   Interfaces detectadas:"
            ipconfig 2>/dev/null | grep -a "IPv4" | grep -v "127.0.0.1" | while IFS= read -r line; do
                local ip_addr=$(echo "$line" | sed 's/.*[: ]\([0-9]*\.[0-9]*\.[0-9]*\.[0-9]*\).*/\1/' | tr -d '\r')
                # Verificar que sea una IP válida y no termine en .1
                if [[ "$ip_addr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] && [[ ! "$ip_addr" =~ \.1$ ]]; then
                    echo "   $ip_addr"
                fi
            done
        else
            echo "   No se pueden mostrar las interfaces de red en Windows"
        fi
    else
        # Linux
        if command -v ip &> /dev/null; then
            # Usar ip addr para mostrar interfaces con nombres, omitiendo IPs que terminen en .1
            ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | while read -r line; do
                local ip_addr=$(echo "$line" | awk '{print $2}' | cut -d'/' -f1)
                local interface=$(echo "$line" | awk '{print $NF}')
                # Verificar que no termine en .1
                if [[ ! "$ip_addr" =~ \.1$ ]]; then
                    echo "   $ip_addr - $interface"
                fi
            done
        elif command -v ifconfig &> /dev/null; then
            # Fallback con ifconfig, omitiendo IPs que terminen en .1
            ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | while read -r line; do
                local ip_addr=$(echo "$line" | awk '{print $2}')
                # Verificar que no termine en .1
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
    
    # Detectar si estamos en Windows con Git Bash
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
        # Windows con Git Bash
        
        # Método 1: Usar PowerShell
        if command -v powershell.exe &> /dev/null; then
            # Obtener múltiples IPs y filtrar las que no terminen en .1
            temp_ip=$(powershell.exe -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {\$_.IPAddress -ne '127.0.0.1' -and \$_.IPAddress -notlike '*.1' -and \$_.PrefixOrigin -eq 'Dhcp'} | Select-Object -First 1 | ForEach-Object {\$_.IPAddress}" 2>/dev/null | tr -d '\r\n ')
            if [[ -n "$temp_ip" ]]; then
                ip="$temp_ip"
            fi
        fi
        
        # Método 2: Usar ipconfig como respaldo
        if [[ -z "$ip" ]] && command -v ipconfig &> /dev/null; then
            # Obtener todas las IPs y filtrar las que no terminen en .1
            while IFS= read -r line; do
                temp_ip=$(echo "$line" | sed 's/.*[: ]\([0-9]*\.[0-9]*\.[0-9]*\.[0-9]*\).*/\1/' | tr -d '\r')
                # Verificar que sea una IP válida y no termine en .1
                if [[ "$temp_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] && [[ ! "$temp_ip" =~ \.1$ ]]; then
                    ip="$temp_ip"
                    break
                fi
            done < <(ipconfig 2>/dev/null | grep -a "IPv4" | grep -v "127.0.0.1")
        fi
        
    else
        # Linux
        
        # Método 1: Usar ip route
        if command -v ip &> /dev/null; then
            temp_ip=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
            # Verificar que no termine en .1
            if [[ -n "$temp_ip" && ! "$temp_ip" =~ \.1$ ]]; then
                ip="$temp_ip"
            fi
        fi
        
        # Método 2: Usar hostname como respaldo
        if [[ -z "$ip" ]] && command -v hostname &> /dev/null; then
            # Obtener todas las IPs y filtrar
            while read -r temp_ip; do
                if [[ -n "$temp_ip" && ! "$temp_ip" =~ \.1$ ]]; then
                    ip="$temp_ip"
                    break
                fi
            done < <(hostname -I 2>/dev/null | tr ' ' '\n')
        fi
        
        # Método 3: Usar ifconfig como último recurso
        if [[ -z "$ip" ]] && command -v ifconfig &> /dev/null; then
            while read -r temp_ip; do
                if [[ -n "$temp_ip" && ! "$temp_ip" =~ \.1$ ]]; then
                    ip="$temp_ip"
                    break
                fi
            done < <(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}')
        fi
    fi
    
    # Limpiar y validar la IP final
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
        
        # Mostrar información de red adicional
        echo ""
        echo "📡 Información de red:"
        if command -v hostname &> /dev/null; then
            echo "   Hostname: $(hostname 2>/dev/null || echo 'No disponible')"
        fi
        
        # Verificar IP en archivo .env usando la función corregida
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
        
        # Mostrar interfaces de red disponibles
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

  # Buscar contenedores relacionados con Expo
  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}}" | grep -i "expo")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "❌ No se encontraron contenedores relacionados con Expo."
    pause
    menu_expo
  fi

  # Si hay más de un contenedor, permitir selección
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

  # Buscar contenedores relacionados con Expo
  mapfile -t containers < <(docker ps --filter "label=$LABEL_FILTER" --format "{{.ID}} {{.Names}} {{.Image}}" | grep -i "expo")

  if [ ${#containers[@]} -eq 0 ]; then
    echo "❌ No se encontraron contenedores relacionados con Expo."
    pause
    menu_expo
  fi

  # Si hay más de un contenedor, permitir selección
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
  
  # Verificar que el script eas-build.sh existe
  if ! docker exec "$container_id" $shell -c "test -f /scripts/eas-build.sh" &>/dev/null; then
    echo "❌ El script /scripts/eas-build.sh no existe en el contenedor."
    echo "   Asegúrate de que el script esté montado en el volumen."
    pause
    menu_expo
  fi

  # Verificar que EXPO_TOKEN esté configurado
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

  # Ejecutar el script de build
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
# Función para generar .env.template desde los archivos .env
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
    
    # Verificar que existen los archivos necesarios
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

    # Verificar si existe ignore.json
    local sensitive_vars=()
    if [[ -f "$ignore_file" ]]; then
        echo "📋 Cargando variables sensibles desde $ignore_file..."
        # Extraer variables sensibles del JSON (método simple)
        mapfile -t sensitive_vars < <(grep -o '"[^"]*"' "$ignore_file" | grep -v "sensitive_variables\|description" | tr -d '"')
        echo "✅ Variables sensibles encontradas: ${#sensitive_vars[@]}"
    else
        echo "⚠️  Archivo $ignore_file no encontrado. Se omitirán variables por defecto."
        sensitive_vars=("API_SECRET_KEY" "API_SECRET_KEY_REFRESH" "BACKEND_API_SECRET_KEY" "BACKEND_API_SECRET_KEY_REFRESH" "EXPO_TOKEN")
    fi

    echo ""
    echo "🔨 Generando $template_file..."
    
    # Crear backup si existe el template
    if [[ -f "$template_file" ]]; then
        local backup_file="${template_file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$template_file" "$backup_file"
        echo "📋 Backup creado: $backup_file"
    fi

    # Inicializar el archivo template
    > "$template_file"

    # Procesar cada archivo .env
    for env_file in "${env_files[@]}"; do
        echo "📄 Procesando $env_file..."
        
        # Agregar separador y header del archivo
        if [[ "$env_file" != ".env" ]]; then
            echo "## ================ Corte ======================" >> "$template_file"
        fi
        
        # Procesar línea por línea
        while IFS= read -r line || [[ -n "$line" ]]; do
            # Si es una línea vacía o comentario, agregarla tal como está
            if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
                echo "$line" >> "$template_file"
                continue
            fi
            
            # Si es una variable, verificar si es sensible
            if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
                local var_name=$(echo "$line" | cut -d'=' -f1)
                local is_sensitive=false
                
                # Verificar si la variable es sensible
                for sensitive_var in "${sensitive_vars[@]}"; do
                    if [[ "$var_name" == "$sensitive_var" ]]; then
                        is_sensitive=true
                        break
                    fi
                done
                
                # Si es sensible, omitir o limpiar el valor
                if [[ "$is_sensitive" == true ]]; then
                    echo "# $var_name= # Variable sensible omitida" >> "$template_file"
                else
                    echo "$line" >> "$template_file"
                fi
            else
                # Línea que no es variable, agregarla
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

# Función para generar archivos .env desde .env.template
generate_env_from_template() {
  clear
  echo "======================================="
  echo "Docker Tools - ENV"
  echo "Regenerar .env DEV/QA/PRD"
  banner_menu_ambiente
  echo "======================================="

    local template_file=".env.template"
    
    # Verificar que existe el template
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

    # Variables para el proceso
    local current_section=""
    local current_file=""
    local line_count=0

    # Leer el template línea por línea
    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_count++))
        
        # Detectar separadores de sección
        if [[ "$line" =~ ^##[[:space:]]*=[[:space:]]*Corte[[:space:]]*=[[:space:]]*## ]]; then
            current_section=""
            current_file=""
            continue
        fi
        
        # Detectar headers de archivos
        if [[ "$line" =~ ^#[[:space:]]*Archivo[[:space:]]*de[[:space:]]*configuración:[[:space:]]*(.env[^[:space:]]*) ]]; then
            local detected_file=$(echo "$line" | sed 's/.*configuración:[[:space:]]*\([^[:space:]]*\).*/\1/')
            current_section="$detected_file"
            current_file=""
            
            # Verificar si este archivo debe ser generado
            for target_file in "${files_to_generate[@]}"; do
                if [[ "$target_file" == "$detected_file" ]]; then
                    current_file="$target_file"
                    break
                fi
            done
            continue
        fi
        
        # Si es la primera sección (antes del primer corte), corresponde a .env
        if [[ -z "$current_section" && -n "$line" ]]; then
            for target_file in "${files_to_generate[@]}"; do
                if [[ "$target_file" == ".env" ]]; then
                    current_file=".env"
                    break
                fi
            done
        fi
        
        # Escribir línea al archivo correspondiente si está en la lista
        if [[ -n "$current_file" ]]; then
            # Si es la primera línea del archivo, inicializarlo
            if [[ ! -f "$current_file.new" ]]; then
                > "$current_file.new"
                echo "📄 Generando $current_file..."
            fi
            
            echo "$line" >> "$current_file.new"
        fi
    done < "$template_file"

    # Mover archivos temporales a definitivos
    local generated_count=0
    for target_file in "${files_to_generate[@]}"; do
        if [[ -f "$target_file.new" ]]; then
            # Crear backup si existe el archivo original
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

# Función auxiliar para verificar archivos .env
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