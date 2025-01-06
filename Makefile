# Variables
NODE_SCRIPT = $(CURDIR)/src/node/main.js
CHECK_SQLITE_FILES = $(CURDIR)/data/bgg.sqlite
SQLITE_FILES = $(CURDIR)/data/bgg.sqlite $(CURDIR)/data/esporton.sqlite
COMMIT_MSG = $(shell date +"%Y%m%d - partidas actualizadas")

# Tarea principal
all: run-node check-changes

# Ejecutar el script Node.js
run-node:
	/usr/local/bin/node $(NODE_SCRIPT)

# Comprobar cambios en los archivos SQLite y hacer commit/push
check-changes:
	@if git status --porcelain $(CHECK_SQLITE_FILES) | grep '^ M'; then \
		date; \
		git add $(SQLITE_FILES); \
		git commit -m "$(COMMIT_MSG)"; \
		git push origin; \
	else \
		date; \
		echo "No hay cambios en $(SQLITE_FILES)"; \
	fi
