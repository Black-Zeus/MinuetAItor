#!/bin/bash

# Script para probar el endpoint de generación de minutas
# Uso: ./test.sh

# Configuración
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MWU5NzNiMy0wZmNmLTQxYTgtOWM5YS1iMmQ0NDBiMTQxNjAiLCJleHAiOjE3NzIzMTAwMDMsImp0aSI6Ijk2YWUxMzZkLTU5MjMtNGY0Ny05MDgxLWYyMzlmMTVlYzBjMiIsInJvbGVzIjpbIkFETUlOIl0sInBlcm1pc3Npb25zIjpbImF1ZGl0LnJlYWQiLCJjbGllbnRzLm1hbmFnZSIsInJlY29yZHMuY3JlYXRlIiwicmVjb3Jkcy5oYXJkX2RlbGV0ZSIsInJlY29yZHMucHVibGlzaCIsInJlY29yZHMucmVhZCIsInJlY29yZHMuc29mdF9kZWxldGUiLCJyZWNvcmRzLnVwZGF0ZSIsInVzZXJzLm1hbmFnZSJdfQ.FTNENa-jcyMUktgLwlVmYibzK9-QI7Ci8Kli8gx4ITE"
URL="http://localhost/api/v1/minutes/generate"

# Archivos de entrada
INPUT_JSON="input.json"
RESUMEN_TXT="resumen.txt"
TRANSCRIPCION_TXT="transcripcion.txt"

# Verificar que los archivos existan
for file in "$INPUT_JSON" "$RESUMEN_TXT" "$TRANSCRIPCION_TXT"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: No se encuentra el archivo $file"
        exit 1
    fi
done

echo "📄 Enviando solicitud a $URL"
echo "📁 Archivos:"
echo "   - $INPUT_JSON (como string JSON)"
echo "   - $RESUMEN_TXT"
echo "   - $TRANSCRIPCION_TXT"
echo ""

# Leer el contenido del input.json (eliminando saltos de línea para que sea un string continuo)
JSON_CONTENT=$(cat "$INPUT_JSON" | jq -c .)

# Realizar la petición curl
curl -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -F "input_json=$JSON_CONTENT" \
  -F "files=@$RESUMEN_TXT" \
  -F "files=@$TRANSCRIPCION_TXT" \
  -w "\n\n📊 Código de respuesta: %{http_code}\n"

# Verificar el resultado
if [ $? -eq 0 ]; then
    echo "✅ Solicitud completada exitosamente"
else
    echo "❌ Error en la solicitud"
    exit 1
fi