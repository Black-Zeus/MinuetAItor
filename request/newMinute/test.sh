#!/bin/bash
# ============================================================
# test.sh — Prueba del endpoint POST /v1/minutes/generate
#
# Uso:
#   ./test.sh <TOKEN>
#
# Ejemplo:
#   ./test.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
#
# El script envía:
#   - input_json : contenido de input.json (validado contra el schema)
#   - files      : transcripcion.txt + resumen.txt (si existe)
# ============================================================

set -euo pipefail

# ── Parámetro obligatorio: TOKEN ──────────────────────────────────────────────
if [ -z "${1:-}" ]; then
  echo ""
  echo "❌ Error: debes pasar el token JWT como primer argumento."
  echo ""
  echo "   Uso: ./test.sh <TOKEN>"
  echo ""
  exit 1
fi

TOKEN="$1"

# ── Configuración ─────────────────────────────────────────────────────────────
URL="http://localhost/api/v1/minutes/generate"

INPUT_JSON="input.json"
TRANSCRIPCION="transcripcion.txt"
RESUMEN="resumen.txt"

# ── Verificar dependencias ────────────────────────────────────────────────────
if ! command -v jq &> /dev/null; then
  echo "❌ Error: 'jq' no está instalado. Instálalo con: sudo apt install jq"
  exit 1
fi

if ! command -v curl &> /dev/null; then
  echo "❌ Error: 'curl' no está instalado."
  exit 1
fi

# ── Verificar archivos obligatorios ──────────────────────────────────────────
for file in "$INPUT_JSON" "$TRANSCRIPCION"; do
  if [ ! -f "$file" ]; then
    echo "❌ Error: No se encuentra el archivo obligatorio: $file"
    exit 1
  fi
done

# ── Preparar el JSON compacto (sin saltos de línea) ──────────────────────────
JSON_CONTENT=$(jq -c . "$INPUT_JSON")

# ── Validación básica del JSON ────────────────────────────────────────────────
echo ""
echo "📋 Validando input.json..."

REQUIRED_FIELDS=("meetingInfo" "projectInfo" "participants" "profileInfo" "preparedBy")
for field in "${REQUIRED_FIELDS[@]}"; do
  VALUE=$(echo "$JSON_CONTENT" | jq -r ".${field} // empty")
  if [ -z "$VALUE" ]; then
    echo "   ⚠️  Campo requerido ausente o vacío: $field"
  else
    echo "   ✅ $field"
  fi
done

# Verificar que attendees sea array de strings (no de objetos)
ATTENDEES_TYPE=$(echo "$JSON_CONTENT" | jq -r '.participants.attendees[0] | type' 2>/dev/null || echo "null")
if [ "$ATTENDEES_TYPE" = "object" ]; then
  echo ""
  echo "❌ Error: participants.attendees debe ser un array de strings (nombres),"
  echo "   no un array de objetos. Ejemplo correcto:"
  echo '   "attendees": ["Juan Pérez", "María González"]'
  echo ""
  exit 1
fi

# Verificar que preparedBy sea string
PREPARED_BY_TYPE=$(echo "$JSON_CONTENT" | jq -r '.preparedBy | type' 2>/dev/null || echo "null")
if [ "$PREPARED_BY_TYPE" = "object" ]; then
  echo ""
  echo "❌ Error: preparedBy debe ser un string (nombre), no un objeto."
  echo '   Ejemplo correcto: "preparedBy": "Juan Pérez"'
  echo ""
  exit 1
fi

echo ""
echo "📄 Enviando solicitud a: $URL"
echo "📁 Archivos:"
echo "   - $INPUT_JSON (como input_json)"
echo "   - $TRANSCRIPCION"
if [ -f "$RESUMEN" ]; then
  echo "   - $RESUMEN (opcional, encontrado)"
else
  echo "   - $RESUMEN (opcional, NO encontrado — se omitirá)"
fi
echo ""

# ── Construir el comando curl ─────────────────────────────────────────────────
CURL_CMD=(
  curl -X POST "$URL"
  -H "Authorization: Bearer $TOKEN"
  -F "input_json=$JSON_CONTENT"
  -F "files=@$TRANSCRIPCION"
)

# Agregar resumen solo si existe
if [ -f "$RESUMEN" ]; then
  CURL_CMD+=(-F "files=@$RESUMEN")
fi

# Agregar opciones de salida
CURL_CMD+=(
  -s
  -w "\n\n📊 HTTP Status: %{http_code} | Tiempo: %{time_total}s\n"
)

# ── Ejecutar la petición ──────────────────────────────────────────────────────
RESPONSE=$("${CURL_CMD[@]}" 2>&1)
EXIT_CODE=$?

echo "📥 Respuesta del servidor:"
echo "──────────────────────────────────────────"

# Intentar formatear la respuesta JSON
HTTP_BODY=$(echo "$RESPONSE" | head -n -2)
HTTP_STATUS=$(echo "$RESPONSE" | tail -n 1)

if echo "$HTTP_BODY" | jq . > /dev/null 2>&1; then
  echo "$HTTP_BODY" | jq .
else
  echo "$HTTP_BODY"
fi

echo ""
echo "$HTTP_STATUS"
echo "──────────────────────────────────────────"

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Solicitud completada"
else
  echo "❌ Error en curl (código: $EXIT_CODE)"
  exit $EXIT_CODE
fi