# Deployment

Deployment target: Synology DS220+ with Container Manager, on the company LAN.

Recommended topology:
Browser → web frontend → Node API → SQL Server (`OracleDB`)

Do not expose SQL Server to the public internet. Keep database credentials in local deployment environment configuration and do not commit real `.env` files. Add the actual Compose stack after local API/frontend tests pass and resource usage is measured.
