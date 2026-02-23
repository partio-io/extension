.PHONY: build dev package lint clean install

build:
	npm run build

dev:
	npm run dev

package:
	npm run package

lint:
	npm run lint

clean:
	rm -rf dist partio-extension.zip

install:
	npm install
