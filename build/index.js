'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Node = exports.Model = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _neo4jDriver = require('neo4j-driver');

var _neo4jDriver2 = _interopRequireDefault(_neo4jDriver);

var _Model = require('./Model');

var _Model2 = _interopRequireDefault(_Model);

var _Node = require('./Node');

var _Node2 = _interopRequireDefault(_Node);

var _Schema = require('./Schema');

var _Schema2 = _interopRequireDefault(_Schema);

var _TransactionError = require('./TransactionError');

var _TransactionError2 = _interopRequireDefault(_TransactionError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Neode = function () {

    /**
     * Constructor
     *
     * @param  {String} connection_string
     * @param  {String} username
     * @param  {String} password
     * @param  {Bool}   enterprise
     * @return {Neode}
     */
    function Neode(connection_string, username, password) {
        var enterprise = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

        _classCallCheck(this, Neode);

        var auth = username && password ? _neo4jDriver2.default.auth.basic(username, password) : null;
        this.driver = new _neo4jDriver2.default.driver(connection_string, auth);
        this.models = new Map();
        this.schema = new _Schema2.default(this);

        this.setEnterprise(enterprise);
    }

    /**
     * @static
     * Generate Neode instance using .env configuration
     *
     * @return {Neode}
     */


    _createClass(Neode, [{
        key: 'setEnterprise',


        /**
         * Set Enterprise Mode
         *
         * @param {Bool} enterprise
         */
        value: function setEnterprise(enterprise) {
            this._enterprise = enterprise;
        }

        /**
         * Are we running in enterprise mode?
         *
         * @return {Bool}
         */

    }, {
        key: 'enterprise',
        value: function enterprise() {
            this._enterprise;
        }

        /**
         * Define a new Model
         *
         * @param  {String} name
         * @param  {Object} schema
         * @return {Model}
         */

    }, {
        key: 'model',
        value: function model(name, schema) {
            if (schema instanceof Object) {
                var model = new _Model2.default(this, name, schema);
                this.models.set(name, model);
            }

            return this.models.get(name);
        }

        /**
         * Create a new Node of a type
         *
         * @param  {String} model
         * @param  {Object} properties
         * @return {Node}
         */

    }, {
        key: 'create',
        value: function create(model, properties) {
            return this.models.get(model).create(properties);
        }

        /**
         * Delete a Node from the graph
         *
         * @param  {Node} node
         * @return {Promise}
         */

    }, {
        key: 'delete',
        value: function _delete(node) {
            return node.delete();
        }

        /**
         * Delete all node labels
         *
         * @param  {String} label
         * @return {Promise}
         */

    }, {
        key: 'deleteAll',
        value: function deleteAll(model) {
            return this.models.get(model).deleteAll();
        }

        /**
         * Relate two nodes based on the type
         *
         * @param  {Node}   from        Origin node
         * @param  {Node}   to          Target node
         * @param  {String} type        Type of Relationship definition
         * @param  {Object} properties  Properties to set against the relationships
         * @return {Promise}
         */

    }, {
        key: 'relate',
        value: function relate(from, to, type, properties) {
            return from.relateTo(to, type, properties);
        }

        /**
         * Run a Cypher query
         *
         * @param  {String} query
         * @param  {Object} params
         * @return {Promise}
         */

    }, {
        key: 'cypher',
        value: function cypher(query, params) {
            var session = this.driver.session();

            return session.run(query, params).then(function (res) {
                session.close();

                return res;
            }).catch(function (err) {
                session.close();

                throw err;
            });
        }

        /**
         * Create a new Transaction
         *
         * @return {Transaction}
         */

    }, {
        key: 'transaction',
        value: function transaction() {
            var session = this.driver.session();
            var tx = session.beginTransaction();

            // Create an 'end' function to commit & close the session
            // TODO: Clean up
            tx.end = function () {
                tx.commit();
                session.close();
            };

            return tx;
        }

        /**
         * Run a batch of queries within a transaction
         *
         * @type {Array}
         * @return {Promise}
         */

    }, {
        key: 'batch',
        value: function batch() {
            var queries = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

            var tx = this.transaction();
            var output = [];
            var errors = [];

            return Promise.all(queries.map(function (query) {
                var params = (typeof query === 'undefined' ? 'undefined' : _typeof(query)) == 'object' ? query.params : {};
                query = (typeof query === 'undefined' ? 'undefined' : _typeof(query)) == 'object' ? query.query : query;

                try {
                    return tx.run(query, params).then(function (res) {
                        output.push(res);
                    }).catch(function (error) {
                        errors.push({ query: query, params: params, error: error });
                    });
                } catch (error) {
                    errors.push({ query: query, params: params, error: error });
                }
            })).then(function () {
                if (errors.length) {
                    tx.rollback();

                    var error = new _TransactionError2.default(errors);

                    throw error;
                }

                tx.end();

                return output;
            });
        }

        /**
         * Close Driver
         *
         * @return {void}
         */

    }, {
        key: 'close',
        value: function close() {
            this.driver.close();
        }
    }], [{
        key: 'fromEnv',
        value: function fromEnv() {
            require('dotenv').config();

            var connection_string = process.env.NEO4J_PROTOCOL + '://' + process.env.NEO4J_HOST + ':' + process.env.NEO4J_PORT;
            var username = process.env.NEO4J_USERNAME;
            var password = process.env.NEO4J_PASSWORD;
            var enterprise = !!process.env.NEO4J_ENTERPRISE;

            return new Neode(connection_string, username, password, enterprise);
        }
    }]);

    return Neode;
}();

exports.default = Neode;
exports.Model = _Model2.default;
exports.Node = _Node2.default;