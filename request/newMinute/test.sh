#!/bin/bash
# ============================================================
# test.sh — Prueba completa del pipeline de minutas
#
# Uso:
#   ./test.sh <TOKEN> [opciones]
#
# Opciones:
#   --set     Juego de archivos: mini | simple | extenso  (o pregunta interactiva)
#   --url     URL base del API  (default: http://localhost/api)
#   --poll    Esperar resultado via polling después del 202
#   --status  Consultar estado de una tx existente
#
# Ejemplos:
#   ./test.sh eyJhbG...                          # Pregunta juego de archivos
#   ./test.sh eyJhbG... --set mini               # Usa mini_transcripcion.txt + mini_resumen.txt
#   ./test.sh eyJhbG... --set extenso --poll     # Extenso y espera resultado
#   ./test.sh eyJhbG... --status 86027a7d-...    # Consulta tx existente
#
# Estructura esperada de archivos:
#   input.json
#   mini_transcripcion.txt   mini_resumen.txt
#   simple_transcripcion.txt simple_resumen.txt
#   extenso_transcripcion.txt extenso_resumen.txt
# ============================================================

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Parámetro obligatorio: TOKEN ──────────────────────────────────────────────
if [ -z "${1:-}" ]; then
  echo ""
  echo -e "${RED}❌ Error: debes pasar el token JWT como primer argumento.${NC}"
  echo ""
  echo "   Uso: ./test.sh <TOKEN> [--poll] [--url http://localhost/api]"
  echo "        ./test.sh <TOKEN> --status <transaction_id>"
  echo ""
  exit 1
fi

TOKEN="$1"
shift

# ── Parsear opciones ──────────────────────────────────────────────────────────
BASE_URL="http://localhost/api"
DO_POLL=false
STATUS_TX=""
FILE_SET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)    BASE_URL="$2";   shift 2 ;;
    --poll)   DO_POLL=true;    shift   ;;
    --status) STATUS_TX="$2";  shift 2 ;;
    --set)    FILE_SET="$2";   shift 2 ;;
    *) echo -e "${RED}❌ Opción desconocida: $1${NC}"; exit 1 ;;
  esac
done

GENERATE_URL="${BASE_URL}/v1/minutes/generate"
STATUS_URL_BASE="${BASE_URL}/v1/minutes"

# ── Verificar dependencias ────────────────────────────────────────────────────
for cmd in jq curl; do
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}❌ '$cmd' no está instalado.${NC}"
    exit 1
  fi
done

# ── Modo --status: solo consultar tx existente ────────────────────────────────
if [ -n "$STATUS_TX" ]; then
  echo ""
  echo -e "${CYAN}🔍 Consultando estado de tx: ${BOLD}$STATUS_TX${NC}"
  echo "──────────────────────────────────────────"
  curl -s \
    -H "Authorization: Bearer $TOKEN" \
    "${STATUS_URL_BASE}/${STATUS_TX}/status" | jq .
  echo "──────────────────────────────────────────"
  exit 0
fi

# ── Selección de juego de archivos ───────────────────────────────────────────
INPUT_JSON="input.json"

if [ -z "$FILE_SET" ]; then
  echo ""
  echo -e "${BOLD}📂 ¿Qué juego de archivos usar?${NC}"
  echo -e "   ${CYAN}1)${NC} mini    — reunión corta de ejemplo"
  echo -e "   ${CYAN}2)${NC} simple  — reunión de ~30 minutos"
  echo -e "   ${CYAN}3)${NC} extenso — reunión real de ~1 hora"
  echo ""
  read -p "   Selecciona (1/2/3) o escribe mini/simple/extenso: " SET_INPUT
  case "$SET_INPUT" in
    1|mini)    FILE_SET="mini"    ;;
    2|simple)  FILE_SET="simple"  ;;
    3|extenso) FILE_SET="extenso" ;;
    *) echo -e "${RED}❌ Opción inválida: '$SET_INPUT'${NC}"; exit 1 ;;
  esac
fi

# Validar que el valor sea correcto
case "$FILE_SET" in
  mini|simple|extenso) ;;
  *) echo -e "${RED}❌ --set debe ser: mini | simple | extenso${NC}"; exit 1 ;;
esac

TRANSCRIPCION="${FILE_SET}_transcripcion.txt"
RESUMEN="${FILE_SET}_resumen.txt"

echo ""
echo -e "${BOLD}📂 Juego seleccionado:${NC} ${CYAN}${FILE_SET}${NC}"

for file in "$INPUT_JSON" "$TRANSCRIPCION"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Archivo obligatorio no encontrado: $file${NC}"
    exit 1
  fi
done

# ── Validar input.json ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}📋 Validando input.json...${NC}"

JSON_CONTENT=$(jq -c . "$INPUT_JSON")

REQUIRED_FIELDS=("meetingInfo" "projectInfo" "participants" "profileInfo" "preparedBy")
ALL_OK=true
for field in "${REQUIRED_FIELDS[@]}"; do
  VALUE=$(echo "$JSON_CONTENT" | jq -r ".${field} // empty")
  if [ -z "$VALUE" ]; then
    echo -e "   ${RED}⚠️  Falta campo requerido: $field${NC}"
    ALL_OK=false
  else
    echo -e "   ${GREEN}✅ $field${NC}"
  fi
done

# Validar profileId — advertir si tiene el placeholder
PROFILE_ID=$(echo "$JSON_CONTENT" | jq -r '.profileInfo.profileId')
if [[ "$PROFILE_ID" == "REEMPLAZAR_CON_ID_REAL" ]]; then
  echo ""
  echo -e "${YELLOW}⚠️  profileInfo.profileId tiene el valor placeholder.${NC}"
  echo -e "   Obtén un ID real con:"
  echo -e "   ${CYAN}curl -s -H 'Authorization: Bearer \$TOKEN' ${BASE_URL}/v1/ai-profiles | jq '.result.items[] | {id, name}'${NC}"
  echo ""
  read -p "   ¿Continuar de todas formas? (s/N): " CONFIRM
  [[ "$CONFIRM" =~ ^[sS]$ ]] || exit 0
fi

if [ "$ALL_OK" = false ]; then
  echo -e "${RED}❌ Corrige los campos faltantes antes de continuar.${NC}"
  exit 1
fi

# ── Mostrar resumen de lo que se envía ────────────────────────────────────────
echo ""
echo -e "${BOLD}📤 Enviando a:${NC} $GENERATE_URL"
echo -e "${BOLD}📁 Archivos:${NC}"
echo -e "   - $TRANSCRIPCION ($(wc -c < "$TRANSCRIPCION") bytes)"
if [ -f "$RESUMEN" ]; then
  echo -e "   - $RESUMEN ($(wc -c < "$RESUMEN") bytes) ${GREEN}[opcional, incluido]${NC}"
else
  echo -e "   - resumen.txt ${YELLOW}[opcional, no encontrado — se omite]${NC}"
fi

MEETING_DATE=$(echo "$JSON_CONTENT" | jq -r '.meetingInfo.scheduledDate')
CLIENT=$(echo "$JSON_CONTENT" | jq -r '.projectInfo.client')
echo -e "${BOLD}📅 Reunión:${NC} $MEETING_DATE | ${BOLD}Cliente:${NC} $CLIENT"
echo ""

# ── Ejecutar POST /generate ───────────────────────────────────────────────────
CURL_ARGS=(
  curl -s -X POST "$GENERATE_URL"
  -H "Authorization: Bearer $TOKEN"
  -F "input_json=$JSON_CONTENT"
  -F "files=@$TRANSCRIPCION"
)

if [ -f "$RESUMEN" ]; then
  CURL_ARGS+=(-F "files=@$RESUMEN")
fi

CURL_ARGS+=(-w "\n__STATUS__%{http_code}")

FULL_RESPONSE=$("${CURL_ARGS[@]}" 2>&1)
HTTP_CODE=$(echo "$FULL_RESPONSE" | grep -o '__STATUS__[0-9]*' | grep -o '[0-9]*')
HTTP_BODY=$(echo "$FULL_RESPONSE" | sed 's/__STATUS__[0-9]*$//')

echo -e "${BOLD}📥 Respuesta:${NC}"
echo "──────────────────────────────────────────"
echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"
echo "──────────────────────────────────────────"
echo -e "${BOLD}HTTP Status:${NC} $HTTP_CODE"

# ── Verificar respuesta ───────────────────────────────────────────────────────
if [ "$HTTP_CODE" != "202" ]; then
  echo -e "${RED}❌ Error: se esperaba 202, se recibió $HTTP_CODE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ TX1 completada — job encolado${NC}"

# Extraer IDs
TX_ID=$(echo "$HTTP_BODY" | jq -r '.result.transactionId // empty')
RECORD_ID=$(echo "$HTTP_BODY" | jq -r '.result.recordId // empty')

if [ -n "$TX_ID" ]; then
  echo ""
  echo -e "${BOLD}🔑 transaction_id:${NC} $TX_ID"
  echo -e "${BOLD}📄 record_id:${NC}      $RECORD_ID"
fi

# ── Polling (si --poll) ───────────────────────────────────────────────────────
if [ "$DO_POLL" = true ] && [ -n "$TX_ID" ]; then
  echo ""
  echo -e "${BOLD}⏳ Esperando resultado (polling cada 3s, máx 3 min)...${NC}"
  echo "──────────────────────────────────────────"

  MAX_ATTEMPTS=60
  ATTEMPT=0

  while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))

    STATUS_RESP=$(curl -s \
      -H "Authorization: Bearer $TOKEN" \
      "${STATUS_URL_BASE}/${TX_ID}/status" 2>/dev/null || echo "{}")

    CURRENT_STATUS=$(echo "$STATUS_RESP" | jq -r '.result.status // "unknown"')

    echo -ne "\r   Intento $ATTEMPT/$MAX_ATTEMPTS — status: ${CYAN}${CURRENT_STATUS}${NC}   "

    case "$CURRENT_STATUS" in
      "ready-for-edit"|"completed")
        echo ""
        echo ""
        echo -e "${GREEN}🎉 ¡Minuta generada exitosamente!${NC}"
        echo "──────────────────────────────────────────"
        echo "$STATUS_RESP" | jq .
        echo ""
        echo -e "Para ver el contenido de la minuta:"
        echo -e "   ${CYAN}curl -s -H 'Authorization: Bearer \$TOKEN' ${STATUS_URL_BASE}/${RECORD_ID} | jq .${NC}"
        break
        ;;
      "llm-failed"|"processing-error"|"cancelled")
        echo ""
        echo ""
        echo -e "${RED}❌ La generación falló — status: $CURRENT_STATUS${NC}"
        echo "──────────────────────────────────────────"
        echo "$STATUS_RESP" | jq .
        break
        ;;
    esac
  done

  if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
    echo ""
    echo -e "${YELLOW}⏰ Timeout de polling alcanzado.${NC}"
    echo -e "   Consulta manualmente con:"
    echo -e "   ${CYAN}./test.sh \$TOKEN --status $TX_ID${NC}"
  fi

elif [ -n "$TX_ID" ]; then
  echo ""
  echo -e "Para monitorear el progreso:"
  echo -e "   ${CYAN}./test.sh \$TOKEN --status $TX_ID${NC}"
  echo -e "   ${CYAN}./test.sh \$TOKEN --poll  (relanza con polling)${NC}"
  echo ""
  echo -e "Para escuchar SSE en tiempo real:"
  echo -e "   ${CYAN}curl -N -H 'Authorization: Bearer \$TOKEN' ${STATUS_URL_BASE}/${TX_ID}/events${NC}"
fi