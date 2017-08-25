'use strict';

var routeMap = {
    static: {
        '/': 'index.html',
        'index.html': 'index.html',
        '*.html': 'static/*.html',
        'favicon.ico': 'favicon.ico',

        'static/css/*.css': 'dest/css/*.css',
        'static/css/images/*': 'dest/css/images/*',
        'static/js/*.js': 'dest/js/*.js',
        'static/js/jquery.js': 'lib/jquery.js'
        
    },
    dynamic: {
        'test.grid.get': function (params) {
            if (params.random) {
                var ret = {
                    "error_code": 0,
                    "result": {}
                };
                ret.result.list = Random.array(Random.integer(3, 10));
                var arr = ret.result.list;
                arr.map(function (a, i) {
                    arr[i] = {};
                    arr[i].name = Random.sentence(2);
                    arr[i].age = Random.integer(12, 30);
                    arr[i].location = Random.sentence(2, 5);
                });
                return ret;
            } else {
                return 'test.grid.json';
            }
        },
        'video.*': 'data/video/*.json',
        '*': 'data/*.json'
    }
};

var Random = (function () {
    // 用于产生各种'伪'随机测试数据
    var collection = 'FIiytskdjnUeHpYUQhfqowUFPzxmiecvbareugWfgeHwUwqfghnSn';
    var collectionZH = '热哦是看不傲络科的奇是无课江接几网夫看为在体拳府额东温道文夹而镜的阿耳金山人脚了就偶骄这松节机反二三技件些光';
    var collectionLength = collection.length;
    var collectionZHLength = collectionZH.length;
    collection += collection;
    collectionZH += collectionZH;
    return {
        integer: function (min, max) {
            var temp;
            if (max === undefined) {
                max = min;
                min = 0;
            }
            if (min > max) {
                temp = min;
                min = max;
                max = temp;
            }
            return parseInt(Math.random() * (max - min) + min, 10);
        },
        word: function (lengthMin, lengthMax, zh) {
            var length = 0;
            if (lengthMin === undefined) {
                length = Random.integer(3, 10);
            } else if (lengthMax === undefined) {
                length = lengthMin;
            } else {
                length = Random.integer(lengthMin, lengthMax);
            }
            var start = parseInt(Math.random() * (zh ? collectionZHLength : collectionLength), 10);
            return (zh ? collectionZH : collection).slice(start, start + length);
        },
        sentence: function (lengthMin, lengthMax) {
            var length = 0;
            if (lengthMin === undefined) {
                length = Random.integer(2, 12);
            } else if (lengthMax === undefined) {
                length = lengthMin;
            } else {
                length = Random.integer(lengthMin, lengthMax);
            }
            var arr = Random.array(length);
            arr.map(function (a, i) {
                arr[i] = Random.word();
            });
            return arr.join(' ');
        },
        array: function (length) {
            return Array.apply(0, {length: length});
        },
        option: function (arr) {
            if (!Array.isArray(arr)) {
                arr = [].slice.call(arguments);
            }
            return arr[this.integer(arr.length)];
        }
    };
})();

module.exports = routeMap;
