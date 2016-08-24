(function() {
    'use strict';

    var request = require('supertest'),
        express = require('express'),
        should = require('chai').should(),
        expect = require('chai').expect,
        assert = require('chai').assert;

    var app = require('../').app;

    var serviceRaw = {
        _name: 'web@1.2.3',
        __name: 'web',
        _version: '1.2.3',
        _port: 18803,
        _host: '127.0.0.1'
    };

    var serviceRaw2 = {
        _name: 'web@0.1.1',
        __name: 'web',
        _version: '0.1.1',
        _port: 18803,
        _host: '127.0.0.1'
    };

    describe('REST API:', function() {
        describe('Get /: GET /', function() {
            it('should return index', function(done) {
                request(app)
                    .get('/')
                    .expect(200)
                    .end(function(err, res) {
                        done(err);
                    });
            });
        });

        describe('Get Services: GET /services', function() {
            it('should return no services', function(done) {
                request(app)
                    .get('/services')
                    .expect(200)
                    .end(function(err, res) {
                        expect(res.body).to.deep.equal([]);
                        done(err);
                    });
            });
        });

        describe('Register Service: POST /services', function() {
            it('should return bad request due to missing mandatory fields: port (host automatically filled)', function(done) {
                request(app)
                    .post('/services')
                    .expect(400)
                    .send({
                        name: serviceRaw.name
                    })
                    .end(function(err, res) {
                        done();
                    });
            });

            it('should return bad request due to missing mandatory fields: name (host automatically filled)', function(done) {
                request(app)
                    .post('/services')
                    .expect(400)
                    .send({
                        port: serviceRaw.port
                    })
                    .end(function(err, res) {
                        done();
                    });
            });

            it('should return bad request due to missing mandatory fields: name', function(done) {
                request(app)
                    .post('/services')
                    .expect(400)
                    .send({
                        port: serviceRaw.port,
                        host: serviceRaw.host
                    })
                    .end(function(err, res) {
                        done();
                    });
            });

            it('should register service with automatically filled host field', function(done) {
                request(app)
                    .post('/services')
                    .expect(201)
                    .send({
                        name: serviceRaw._name,
                        port: serviceRaw._port
                    })
                    .end(function(err, res) {
                        expect(res.body.name).to.equal(serviceRaw.__name);
                        expect(res.body.port).to.equal(serviceRaw._port);
                        expect(res.body.version).to.equal(serviceRaw._version);
                        res.body.id.should.be.ok;
                        res.body.host.should.be.ok;

                        // these are parsed or automatically filled from the
                        // server
                        serviceRaw.host = res.body.host;
                        serviceRaw.id = res.body.id;

                        done(err);
                    });
            });

            it('should register service', function(done) {
                request(app)
                    .post('/services')
                    .expect(201)
                    .send({
                        name: serviceRaw2._name,
                        port: serviceRaw2._port,
                        host: serviceRaw2._host
                    })
                    .end(function(err, res) {
                        expect(res.body.name).to.equal(serviceRaw2.__name);
                        expect(res.body.port).to.equal(serviceRaw2._port);
                        expect(res.body.host).to.equal(serviceRaw2._host);
                        expect(res.body.version).to.equal(serviceRaw2._version);
                        res.body.id.should.be.ok;

                        // these are parsed or automatically filled from the
                        // server
                        serviceRaw2.id = res.body.id;

                        done(err);
                    });
            });
        });

        describe('Get Service: GET /services', function() {
            it('should return 2 services', function(done) {
                request(app)
                    .get('/services')
                    .expect(200)
                    .end(function(err, res) {
                        expect(res.body.length).to.equal(2);
                        done(err);
                    });
            });

            it('should return no service', function(done) {
                request(app)
                    .get('/services/notexistent')
                    .expect(200)
                    .end(function(err, res) {
                        expect(res.body).to.deep.equal([]);
                        done(err);
                    });
            });

            it('should return two services with name ' + serviceRaw2.__name, function(done) {
                request(app)
                    .get('/services/' + serviceRaw2.__name)
                    .expect(200)
                    .end(function(err, res) {
                        expect(res.body.length).to.equal(2);
                        done(err);
                    });
            });

            it('should return one service with version number ' + serviceRaw2._version, function(done) {
                request(app)
                    .get('/services/' + serviceRaw2.__name + '?version=' + serviceRaw2._version)
                    .expect(200)
                    .end(function(err, res) {
                        expect(res.body.length).to.equal(1);
                        expect(res.body[0].version).to.equal(serviceRaw2._version);
                        done(err);
                    });
            });
        });

        describe('Deregister Service: DELETE /service/', function() {
            it('should return 404', function(done) {
                request(app)
                    .del('/services/999')
                    .expect(404)
                    .end(function(err, res) {
                        expect(res.body.success).not.to.be.ok;
                        done();
                    });
            });

            it('should deregister the service', function(done) {
                request(app)
                    .del('/services/' + serviceRaw.id)
                    .expect(200)
                    .end(function(err, res) {
                        expect(res.body.success).to.be.ok;
                        done(err);
                    });
            });
        });
    });
})();
