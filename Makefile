JPM_FIREFOX_BINARY=/Applications/FirefoxDeveloperEdition.app/Contents/MacOS/firefox

install:
	npm install

xpi: install
	jpm xpi

lint:
	node_modules/.bin/eslint 'lib/**' 'data/**'

run:
	jpm run

.PHONY = install
