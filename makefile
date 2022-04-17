
addonName := unduplicate
srcFolder := src

.PHONY: build debug clean

build: clean addProductionFiles

debug: build addTestFiles

clean: 
	rm -f $(addonName).xpi

addTestFiles:
	cd $(srcFolder) && \
	zip -r ../$(addonName).xpi ./tests/

addProductionFiles:
	cd $(srcFolder) && \
	zip -r ../$(addonName).xpi ./ -x "tests/*" -x "backups/*"

