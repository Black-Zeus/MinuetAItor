MinIO - Notas
- API: 9000
- Console: 9001

Si usas MinIO detrás de Nginx por PATH (/minio y /minio-console),
probablemente necesitarás configurar:
- MINIO_SERVER_URL
- MINIO_BROWSER_REDIRECT_URL

En PRD se recomienda subdominios (s3.domain / minio.domain) para evitar issues.