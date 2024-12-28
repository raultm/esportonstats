# Variables
NODE_SCRIPT = ./src/node/main.js
SQLITE_FILES = ./data/bgg.sqlite ./data/esporton.sqlite
COMMIT_MSG = $(shell date +"%Y%m%d - partidas actualizadas")

# Tarea principal
all: run-node check-changes

# Ejecutar el script Node.js
run-node:
	node $(NODE_SCRIPT)

# Comprobar cambios en los archivos SQLite y hacer commit/push
check-changes:
	@if git status --porcelain $(SQLITE_FILES) | grep '^ M'; then \
		git add $(SQLITE_FILES); \
		git commit -m "$(COMMIT_MSG)"; \
		git push origin; \
	else \
		echo "No hay cambios en $(SQLITE_FILES)"; \
	fi
