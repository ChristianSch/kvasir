test:
	env PORT="8081" @NODE_ENV=test ./node_modules/.bin/mocha --reporter spec tests/*.js

test-cover:
	istanbul cover _mocha tests/* --report lcovonly -- -R spec \
	&& cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js \
	&& rm -rf ./coverage

doc:
	apidoc -i . -o docs -f *.js -e node_modules/

gen-cert:
	openssl genrsa 1024 > server.key \
	&& openssl req -new -key server.key -out cert.csr \
	&& openssl x509 -req -in cert.csr -signkey server.key -out server.pem
