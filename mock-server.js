'use strict';

var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    path = require('path'),
    routeMap = require('./server-router'),
    argv = require('optimist').argv;


var HttpServer = (function () {
    var logger = (function () {
        function toString(o) {
            if (o == undefined) return 'undefined';
            if (utils.isString(o)) return o;
            if (utils.isArray(o)) return o.toString();

            var arr = [];
            var fmt = function (s) {
                if (typeof s == 'object' && s != null) return toString(s);
                return /^(string|number)$/.test(typeof s) ? "'" + s + "'" : s;
            };

            for (var i in o)
                arr.push("'" + i + "':" + (utils.isFunction(o[i])
                    ? '[FUNCTION]'
                    : (utils.isArray(o[i]) ? o[i].toString() : fmt(o[i]))));

            return '{' + arr.join(',') + '}';
        }

        return {
            info: function (obj) {
                console.log('[' + new Date().format('yyyy-MM-dd hh:mm:ss') + ']: ' + toString(obj));
            }
        }
    })();
    var utils = {
        toString: Object.prototype.toString,
        hasOwn: Object.prototype.hasOwnProperty,
        push: Array.prototype.push,
        slice: Array.prototype.slice,
        trim: String.prototype.trim,
        indexOf: Array.prototype.indexOf,
        class2type: {
            "[object Boolean]": "boolean",
            "[object Number]": "number",
            "[object String]": "string",
            "[object Function]": "function",
            "[object Array]": "array",
            "[object Date]": "date",
            "[object RegExp]": "regexp",
            "[object Object]": "object"
        },
        isFunction: function (obj) {
            return this.type(obj) === "function";
        },
        isArray: Array.isArray || function (obj) {
            return this.type(obj) === "array";
        },
        isString: function (obj) {
            return this.type(obj) == "string";
        },
        isNumeric: function (obj) {
            return !isNaN(parseFloat(obj)) && isFinite(obj);
        },
        type: function (obj) {
            return obj == null ? String(obj) : this.class2type[toString.call(obj)] || "object";
        },
        isPlainObject: function (obj) {
            if (!obj || this.type(obj) !== "object" || obj.nodeType) {
                return false
            }
            try {
                if (obj.constructor && !this.hasOwn.call(obj, "constructor") && !this.hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
                    return false
                }
            } catch (e) {
                return false
            }
            var key;
            for (key in obj) {
            }
            return key === undefined || this.hasOwn.call(obj, key)
        }
    };
    Date.prototype.format = function (fmt) {
        var o = {
            "M+": this.getMonth() + 1, //月份
            "d+": this.getDate(), //日
            "h+": this.getHours() % 12 == 0 ? 12 : this.getHours() % 12, //小时
            "H+": this.getHours(), //小时
            "m+": this.getMinutes(), //分
            "s+": this.getSeconds(), //秒
            "q+": Math.floor((this.getMonth() + 3) / 3), //季度
            "S": this.getMilliseconds() //毫秒
        };
        var week = {
            "0": "/u65e5",
            "1": "/u4e00",
            "2": "/u4e8c",
            "3": "/u4e09",
            "4": "/u56db",
            "5": "/u4e94",
            "6": "/u516d"
        };
        if (/(y+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
        }
        if (/(E+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "/u661f/u671f" : "/u5468") : "") + week[this.getDay() + ""]);
        }
        for (var k in o) {
            if (new RegExp("(" + k + ")").test(fmt)) {
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            }
        }
        return fmt;
    };

    function getContentType(ext) {
        ext = ext.toLowerCase();

        ext = /.*(\.\w+)$/.exec(ext);
        if (!ext)
            return 'text/plain';
        else
            ext = ext[1];

        if (ext === '.htm' || ext === '.html')
            return 'text/html';
        else if (ext === '.js')
            return 'application/x-javascript';
        else if (ext === '.json')
            return 'application/json';
        else if (ext === '.css')
            return 'text/css';
        else if (ext === '.jpe' || ext === '.jpeg' || ext === '.jpg')
            return 'image/jpeg';
        else if (ext === '.png')
            return 'image/png';
        else if (ext === '.ico')
            return 'image/x-icon';
        else if (ext === '.zip')
            return 'application/zip';
        else if (ext === '.doc')
            return 'application/msword';
        else
            return 'text/plain';
    };

    function extend() {
        var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {},
            i = 1,
            length = arguments.length,
            deep = false;

        if (typeof target === "boolean") {
            deep = target;
            target = arguments[1] || {};
            i = 2;
        }
        if (typeof target !== "object" && !utils.isFunction(target)) {
            target = {}
        }
        if (length === i) {
            target = this;
            --i;
        }
        for (i; i < length; i++) {
            if ((options = arguments[i]) != null) {
                for (name in options) {
                    src = target[name];
                    copy = options[name];
                    if (target === copy) {
                        continue
                    }
                    if (deep && copy && (utils.isPlainObject(copy) || (copyIsArray = utils.isArray(copy)))) {
                        if (copyIsArray) {
                            copyIsArray = false;
                            clone = src && utils.isArray(src) ? src : []
                        } else {
                            clone = src && utils.isPlainObject(src) ? src : {};
                        }
                        // WARNING: RECURSION
                        target[name] = extend(deep, clone, copy);
                    } else if (copy !== undefined) {
                        target[name] = copy;
                    }
                }
            }
        }
        return target;
    }

    function processorFactory(context) {
        var context = context,
            processorChain = [],
            cursor = 0;

        return {
            push: function (proc) {
                processorChain.push(proc);
                return this;
            },
            step: function () {
                if (cursor >= processorChain.length) return;
                processorChain[cursor++].apply(context);
            }
        };
    }

    function dispatch(context) {
        context = context || this;

        var pathname = context.url.pathname;
        // logger.info("URL : " + pathname);
        // var result = context.config.apiReg.exec(pathname);
        var result = pathname;
        // logger.info("result:"+result)
        if (result) {
            // context.token = result[1];
            context.processor.push(apiResource).step();
            return;
        }

        //Cookie判断
        // if (!context.cookie['t'] && !(pathname.indexOf("/static/") == 0)) {
        //     context.url.pathname = "/login.html";
        // }
        result = getStaticRouteResult(context);
        if (result) {
            context.result.set({
                status: 200,
                content: result,
                contentType: getContentType(result)
            });
            context.processor.push(staticResource).step();
            return;
        }

        context.result.set({status: 404, contentType: getContentType(pathname)});
        context.processor.push(errorProcess).step();
    }

    function getStaticRouteResult(context) {
        var pathname = context.url.pathname,
            staticPage = context.routeMap.static;

        var result = staticPage[pathname] || staticPage[pathname.substring(1)];
        if (!result) {
            for (var v in staticPage) {
                if (v.indexOf('*') < 0) continue;
                result = new RegExp(v.replace("*", "(.*)")).exec(pathname);
                if (result) {
                    result = utils.isFunction(staticPage[v]) ? staticPage[v] : staticPage[v].replace("*", result[1]);
                    break;
                }
            }
        }

        return utils.isFunction(result) ? result.apply(context) : result;
    }

    function apiResource_copy(context) {
        context = context || this;

        var params = context.params;
        if (!params || !params.target || !params.method) {
            apiResult({error_code: 2, error_msg: 'Undefined API'});
            return;
        }

        if (!context.token && !params.target.startsWith("login")) {
            apiResult({error_code: 9002, error_msg: 'Token is invalid or timed out.'});
            return;
        }

        var target = params.target + '.' + params.method,
            dynamic = context.routeMap.dynamic,
            result = dynamic[target];

        logger.info(context.req.method + ' ' + context.req.url + '  TARGET:[' + result + "]");

        function apiResult(content) {
            context.result.set({
                status: 200, content: content, contentType: 'application/json'
            });
            context.processor.push(processEnd).step();
        }

        if (!result) {
            var re = false;
            for (var v in dynamic) {
                if (v.indexOf('*') < 0) continue;
                var match = new RegExp('^' + v.replace('.', '\\.').replace("*", "(.*)")).exec(target);
                if (match) {
                    re = utils.isFunction(dynamic[v]) ? dynamic[v] : dynamic[v].replace("*", match[1]);
                    break;
                }
            }
            if (!re) {
                apiResult({error_code: -1, error_msg: 'Undefined API'});
                return;
            }

            result = re;
        }


        if (utils.isFunction(result)) {
            apiResult(result.apply(context));
        } else {
            var staticFilePath = path.join(context.config.root, result);
            fs.readFile(staticFilePath, function (err, file) {
                if (!err) {
                    context.result.set({
                        status: 200,
                        content: file,
                        contentType: getContentType(result)
                    });
                    context.processor.push(processEnd).step();
                } else {
                    apiResult({error_code: -1, error_msg: result + ' : LOST'});
                }
            });
        }
    }

    function apiResource(context) {
        context = context || this;

        var method = context.params.method;

        logger.info("Data from client :: \n" + JSON.stringify(context.params));
        var target = method,
            dynamic = context.routeMap.dynamic,
            result = dynamic[target];

        // logger.info(context.req.method + ' ' + context.req.url + '  TARGET:[' + result + "]");
        function apiResult(content) {
            context.result.set({
                status: 200, content: content, contentType: 'application/json'
            });
            context.processor.push(processEnd).step();
        }

        if (!result) {
            var re = false;
            for (var v in dynamic) {
                if (v.indexOf('*') < 0) continue;
                var match = new RegExp('^' + v.replace('.', '\\.').replace("*", "(.*)")).exec(target);
                if (match) {
                    re = utils.isFunction(dynamic[v]) ? dynamic[v] : dynamic[v].replace("*", match[1]);
                    break;
                }
            }
            if (!re) {
                apiResult({error_code: -1, error_msg: 'Undefined API'});
                return;
            }

            result = re;
        }


        if (utils.isFunction(result)) {
            apiResult(result.apply(context));
        } else {
            var staticFilePath = path.join(context.config.root, result);
            fs.readFile(staticFilePath, function (err, file) {
                if (!err) {
                    context.result.set({
                        status: 200,
                        content: file,
                        contentType: getContentType(result)
                    });
                    context.processor.push(processEnd).step();
                } else {
                    apiResult({error_code: -1, error_msg: result + ' : LOST'});
                }
            });
        }
    }

    function staticResource(context) {
        context = context || this;

        logger.info(context.req.method + ' ' + context.req.url + '  TARGET:[' + context.result.content + "]");

        var staticFilePath = path.join(context.config.root, context.result.content);
        fs.readFile(staticFilePath, function (err, file) {
            context.result.set('content', file);
            context.processor.push(err ? errorProcess : processEnd).step();
        })
    }

    function errorProcess(context) {
        context = context || this;

        var staticPage = context.routeMap.static,
            errPage = staticPage[context.result.status + '.html']
                || ("static/" + context.result.status + ".html");

        logger.info(path.join(context.config.root, errPage));

        fs.readFile(path.join(context.config.root, errPage), function (err, file) {
            var result = context.result;
            context.res.writeHead(result.status, {reason: {'Content-type': result.contentType}});
            context.res.end(file);
        })
    }

    function processEnd(context) {
        context = context || this;

        var result = context.result;
        context.res.writeHead(result.status, {'Content-type': result.contentType});
        context.res.end(utils.isPlainObject(result.content) ? JSON.stringify(result.content) : result.content);
    }

    var httpServer = extend({}, {
        defaultContext: {
            routeMap: {},
            req: null,
            res: null,
            url: null,
            result: {
                status: 200,
                type: null,
                content: null,
                contentType: 'text/html',

                set: function (type, value) {
                    if (utils.isString(type)) {
                        this[type] = value;
                    } else if (utils.isPlainObject(type)) {
                        extend(this, type);
                    }
                }
            },
            processor: null
        },
        config: {
            port: 80,
            // apiVersion: 1,
            // apiReg: /.*/,
            root: __dirname
        },
        init: function (routeMap, argv) {
            extend(this.defaultContext.routeMap, routeMap);

            if (argv.p) {
                this.config.port = argv.p;
            }
            // if (argv.apiv) {
            //     this.config.apiVersion = argv.apiv;
            // }
            // this.config.apiReg = new RegExp('^/openapi/v' + this.config.apiVersion
            //     + '(/t=(\\w+)?)?$');

            return this;
        },
        start: function (config) {
            extend(this.config, config);
            var defaultConfig = this.config,
                defaultContext = this.defaultContext;

            http.createServer(function (req, res) {
                var Cookies = {};
                req.headers.cookie && req.headers.cookie.split(';').forEach(function (Cookie) {
                    var parts = Cookie.split('=');
                    Cookies[parts[0].trim()] = ( parts[1] || '' ).trim();
                });

                var context = extend(true, {}, defaultContext, {
                    config: defaultConfig,
                    req: req,
                    res: res,
                    cookie: Cookies,
                    params: null,
                    url: url.parse(req.url, true)
                });

                req.on('data', function (data) {
                    context.params = JSON.parse(data);
                });

                req.on('end', function () {
                    context.processor = processorFactory(context);
                    context.processor.push(dispatch).step();
                })
            }).listen(defaultConfig.port, function () {
                logger.info('Start @ ' + defaultConfig.port);
            })
        }
    });

    return httpServer;
})
();

HttpServer.init(routeMap, argv).start();
