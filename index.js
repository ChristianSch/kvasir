(function() {
    var fs = require('fs'),
        http = require('http'),
        https = require('https'),
        express = require('express')
        bodyparser = require('body-parser'),
        loki = require('lokijs');

    var db = new loki('loki.json'),
        servicesCollection = db.addCollection('services', {indices:['name']});

    /* environment variables */
    var SECURE_PORT = process.env.SECURE_PORT || 3443,
        PORT = process.env.PORT || 8001,
        SECURE_KEY_PATH = process.env.SECURE_KEY_PATH || 'server.key',
        SECURE_CERT_PATH = process.env.SECURE_CERT_PATH || 'server.pem';

    var app = exports.app = express();

    /* middleware */
    app.use(bodyparser.json());
    app.use(bodyparser.urlencoded({
        extended: true
    }));

    /**************************************************************************
     * LokiJS helper functions
     **************************************************************************/

    /**
     * Registers an instance with the given attributes.
     *
     * @param name Name of the microservice. Note: might contain an id appended
     *             to the name, prepended by an `@`.
     * @param host Host of the microservice.
     * @param port Port number the microservice listens at.
     * @param meta Object that contains arbritary information about the
     *             service.
     *
     * @returns Object with the final fields as saved to the database.
    */
    function registerInstance(name, host, port, meta) {
        var version = null,
            _name = null;

        if (name.indexOf('@') >= 0) {
            var t = name.split('@');
            _name = t[0];
            version = t[1];
        }

        var doc = servicesCollection.insert({
            'name': _name || name,
            'host': host,
            'port': port,
            'version': version,
            '_heartbeat': Date.now(),
            'meta': meta
        });

        return {
            'name': doc.name,
            'host': doc.host,
            'port': doc.port,
            'version': doc.version,
            'id': doc.$loki,
            'meta': doc.meta,
            '_heartbeat': doc._heartbeat
        };
    }

    /**
     * Deregisters the given instance.
     *
     * @param instance Instance as returned by `find`, `findOne` or similar.
     *
     * @returns success indicator
     */
    function deregisterInstance(instance) {
        try {
            servicesCollection.remove(instance);
            return true;
        } catch(err) {
            return false;
        }
    }

    /**
     * Deregister instance identified by the id.
     *
     * @param id The `$loki` id.
     *
     * @returns success indicator
     */
    function deregisterInstanceById(id) {
        var res = servicesCollection.find({
            '$loki': id
        });

        return deregisterInstance(res);
    }

    /**
     * Get instance by id (`$loki`).
     *
     * @param id `$loki` value of the instance
     *
     * @returns instance or `null`
     */
    function getInstanceById(id) {
        return servicesCollection.findOne({
            $loki: Number(id)
        });
    }

    /**************************************************************************
     * API routes
     **************************************************************************/

    /**
     * @apiGroup Services
     * @apiName GetIndex
     * @api {GET} /
     * @apiDescription Returns api index
     */
    app.get('/', function(req, res) {
        return res.json({
            'self': '/',
            'services': '/services'
        });
    });

    /**
     * @apiGroup Services
     * @apiName GetServices
     * @api {GET} /services
     * @apiDescription Get all services.
     */
    app.get('/services', function(req, res) {
        var r = servicesCollection.find();

        return res.json(r);
    });

    /**
     * @apiGroup Services
     * @apiName GetServicesByName
     * @api {GET} /services/:name
     * @apiDescription Get all services by name. Has an optional version
     *                 specifier that ought to be given as query parameter.
     * @apiParam {String} version Version the microservices should have.
     */
    app.get('/services/:name', function(req, res) {
        var name = req.params.name,
            version = req.query.version;

        if (version) {
            var r = servicesCollection.find({
                '$and': [{
                    'name': name,
                }, {
                    'version': version
                }]
            });
        } else {
            var r = servicesCollection.find({
                'name': name
            });
        }

        var final = [];

        r.forEach(function(val) {
            final.push({
                'name': val.name,
                'host': val.host,
                'port': val.port,
                'version': val.version
            });
        });

        return res.json(final);
    });

    /**
     * @apiGroup Services
     * @apiName CreateService
     * @api {POST} /services
     * @apiDescription Registers a new service.
     *
     * @apiParam {String} name The name of the microservice. Note: might
     *                         have an appended version specifier prefixed with
     *                         an `@`.
     * @apiParam {Number} port The port of the microservice.
     * @apiParam {String} host Host of the microservice. Note: if not given,
     *                    the remote address of the request issuer is being used.
     *
     * @apiParamExample {json} Request-Example:
     *  {
     *      name: sentimentAnalysis@0.1.4,
     *      host: 172.167.155.21,
     *      port: 18805
     *  }
     *
     * @apiError (501) {String} message Error message.
     */
    app.post('/services/', function(req, res) {
        var name = req.body.name,
            host = req.body.host,
            port = req.body.port,
            meta = req.body.meta;

        if (!host) {
            host = req.ip;
        }

        if (!(name && host && port)) {
            return res.status(400).json({
                'message': 'Either host, port or name missing.'
            });
        }

        var r = registerInstance(name, host, port, meta);

        if (!r) {
            return res.status(400).json({
                'message': 'can\'t register service.'
            });
        }

        return res.status(201).json(r);
    });

    /**
     * @apiGroup Services
     * @apiName ServiceHeartbeat
     * @api {POST} /services/:id
     * @apiDescription Heartbeat functionality that prevents purge of the
     *                 given service.
     *
     * @apiError (404) message Error description.
     */
    app.post('/services/:id', function(req, res) {
        var instance = getInstanceById(req.params.id);

        if (!instance) {
            return res.status(404).json({
                'message': 'No such instance'
            });
        }

        instance._heartbeat = Date.now();
        servicesCollection.update(instance);

        return res.status(202).json({
            'success': true,
            'message': 'heartbeat accepted',
            'doc': instance
        });
    });

    /**
     * @apiGroup Services
     * @apiName DeleteService
     * @api {DELETE} /services/:id
     * @apiDescription Delete a microservice instance identified by the id.
     */
    app.delete('/services/:id', function(req, res) {
        var instance = getInstanceById(req.params.id);

        if (!instance) {
            return res.status(404).json({
                'message': 'No such instance'
            });
        }

        var id = req.params.id,
            r = deregisterInstance(instance);

        return res.json({
            'success': r
        });
    });

    var server = http.createServer(app).listen(8001, function() {
        console.log("server running at http://localhost:" + PORT)
    });

    try {
        // use https
        var key  = fs.readFileSync(SECURE_KEY_PATH, 'utf8'),
            cert = fs.readFileSync(SECURE_CERT_PATH, 'utf8');

        var secureServer = https.createServer({
            key: key,
            cert: cert
        }, app).listen(SECURE_PORT, function() {
            console.log('secure server running at https://localhost:' + SECURE_PORT)
        });
    } catch(err) {
        // use only http
        console.log('could not read ssl cert + key: ', err.message);
    }

})();
