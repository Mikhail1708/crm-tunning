#!/bin/bash

BACKUP_DIR="/opt/crm-swap38/backups"
RETENTION_DAYS=10
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="crm_backup_${TIMESTAMP}"

mkdir -p ${BACKUP_DIR}

# Backup database
docker exec crm-db pg_dump -U postgres crm_db > ${BACKUP_DIR}/${BACKUP_NAME}.sql

# Backup volumes
docker run --rm -v crm-swap38_postgres_data:/data -v ${BACKUP_DIR}:/backup alpine tar czf /backup/${BACKUP_NAME}_volumes.tar.gz -C /data .

# Backup .env
cp /opt/crm-swap38/.env ${BACKUP_DIR}/${BACKUP_NAME}.env

# Clean old backups (older than 10 days)
find ${BACKUP_DIR} -name "crm_backup_*.sql" -mtime +${RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "crm_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "crm_backup_*.env" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup created: ${BACKUP_NAME}" >> ${BACKUP_DIR}/backup.log