var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {
    "showTotalDurationIn": "header",
    "totalDurationFormat": "hms",
    "columnSettings": {
        "displayTime": true,
        "displayBrowser": true,
        "displaySessionId": false,
        "displayOS": true,
        "inlineScreenshots": false
    }
};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Test contacts list - 1.Get Darwin data 2.Verify it is displayed correctly|Contacts page tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00fb0075-00e6-007a-000e-006900fe0014.png",
        "timestamp": 1589299104576,
        "duration": 8713
    },
    {
        "description": "Test Comm Log - 1.Get Darwin data 2.Verify it is displayed correctly|Contacts page tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00ca00ad-00a9-0075-0027-004800a7008c.png",
        "timestamp": 1589299113852,
        "duration": 6950
    },
    {
        "description": "Test Hello Widget - 1.Get Darwin data 2.Verify it is displayed correctly|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00c50078-0029-00b8-007a-0039002300bd.png",
        "timestamp": 1589299121341,
        "duration": 8600
    },
    {
        "description": "Next Update Widget - 1.Get Darwin data 2.Verify it is displayed correctly|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/0063000d-0055-004a-0097-00c900ac0001.png",
        "timestamp": 1589299130400,
        "duration": 6935
    },
    {
        "description": "Test Settlement Progress Widget - 1.Get Darwin data 2.Verify it is displayed correctly 3.Click See All|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/0034003a-00e9-007a-0099-006d00b800d8.png",
        "timestamp": 1589299137787,
        "duration": 9330
    },
    {
        "description": "Test Todo Widget - 1.Get Darwin data 2.Verify it is displayed correctly 3.Click See All|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00600008-002e-009e-0041-0041002b0067.png",
        "timestamp": 1589299147602,
        "duration": 7959
    },
    {
        "description": "Test Comm Widget - 1.Get Darwin data 2.Verify it is displayed correctly 3.Click See All|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/003a0026-0066-0014-005d-00f400d1006b.png",
        "timestamp": 1589299156101,
        "duration": 8161
    },
    {
        "description": "Test Key Dates panel link leads to Key Dates page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/003d0017-009e-00a0-00bd-00420070006e.png",
        "timestamp": 1589299164849,
        "duration": 5991
    },
    {
        "description": "Test Help and Advice panel link leads to Help page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/007900cf-00ca-00ff-0028-001a002400f9.png",
        "timestamp": 1589299171346,
        "duration": 6171
    },
    {
        "description": "Test Items panel link leads to Item page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00fb00b3-00f9-00be-0044-005200fe007b.png",
        "timestamp": 1589299177966,
        "duration": 5717
    },
    {
        "description": "Test Contact Center panel link leads to Contacts page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00e30088-0043-00a9-002a-007900e00079.png",
        "timestamp": 1589299184202,
        "duration": 5690
    },
    {
        "description": "Test faqs list - 1.Get Admin data 2.Verify it is displayed correctly|Help page tests @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/005b0022-0071-00c9-00c3-00fb00840003.png",
        "timestamp": 1589299190403,
        "duration": 5300
    },
    {
        "description": "Test whats involved list - 1.Get Admin data 2.Verify it is displayed correctly|Help page tests @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/006e00c5-00e1-0043-004d-0097002b009f.png",
        "timestamp": 1589299196180,
        "duration": 4709
    },
    {
        "description": "Test important tips list - 1.Get Admin data 2.Verify it is displayed correctly|Help page tests @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00800075-001f-000d-00f1-006f00f30033.png",
        "timestamp": 1589299201351,
        "duration": 3816
    },
    {
        "description": "Test Outstanding items list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Items page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00ca006f-00fb-002b-00f9-009400c40082.png",
        "timestamp": 1589299205616,
        "duration": 4739
    },
    {
        "description": "Test Accepted items list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Items page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00220060-0081-00a8-00d2-000400ef0069.png",
        "timestamp": 1589299210862,
        "duration": 4415
    },
    {
        "description": "Test Add new item and verify it is displayed correctly @dev|Items page tests",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/00e40085-000c-00d3-00a6-00aa00b400dd.png",
        "timestamp": 1589299215742,
        "duration": 0
    },
    {
        "description": "Test Todo list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Todo page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/008c0024-00f5-00fd-009e-00ab00ea0036.png",
        "timestamp": 1589299215753,
        "duration": 2804
    },
    {
        "description": "Test Reviewed list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Todo page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images/009000cc-00bc-009e-008a-008800c20082.png",
        "timestamp": 1589299218987,
        "duration": 2713
    },
    {
        "description": "Test Todo list - Move todo item in done state @dev|Todo page tests",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/00fe0056-003a-002f-002b-00ad00030013.png",
        "timestamp": 1589299222161,
        "duration": 0
    },
    {
        "description": "Test upload - 1.Upload file 2.Verify it is uploaded correctly|Upload tests @dev",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/00010011-00e7-0076-0074-00dd00ea0055.png",
        "timestamp": 1589299222171,
        "duration": 0
    },
    {
        "description": "Test upload - 1.Open upload dialog 2.Click Cancel|Upload tests @dev",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/0084000d-000b-004c-0013-00c400ae0078.png",
        "timestamp": 1589299222181,
        "duration": 0
    },
    {
        "description": "Test upload - 1.Open upload dialog 2.Upload file 3. Click Remove file 4. Verify file is removed|Upload tests @dev",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "ca80c5b89a1b4202e95a18e3a252f1ed",
        "instanceId": 10486,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/00320078-0062-0029-00f7-00ea00e10042.png",
        "timestamp": 1589299222191,
        "duration": 0
    },
    {
        "description": "Test contacts list - 1.Get Darwin data 2.Verify it is displayed correctly|Contacts page tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00110073-00a9-003a-0000-001500bf009e.png",
        "timestamp": 1589299232412,
        "duration": 8913
    },
    {
        "description": "Test Comm Log - 1.Get Darwin data 2.Verify it is displayed correctly|Contacts page tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00e5006a-00bb-00af-0048-009f002d00d3.png",
        "timestamp": 1589299241850,
        "duration": 7375
    },
    {
        "description": "Test Hello Widget - 1.Get Darwin data 2.Verify it is displayed correctly|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/007e0089-00be-00a3-0099-00c8007c0073.png",
        "timestamp": 1589299249786,
        "duration": 8036
    },
    {
        "description": "Next Update Widget - 1.Get Darwin data 2.Verify it is displayed correctly|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/005400d4-0063-0033-00d7-00c000b800ac.png",
        "timestamp": 1589299258283,
        "duration": 6776
    },
    {
        "description": "Test Settlement Progress Widget - 1.Get Darwin data 2.Verify it is displayed correctly 3.Click See All|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/004600cd-0032-00fd-0088-00ef008b00ba.png",
        "timestamp": 1589299265523,
        "duration": 7673
    },
    {
        "description": "Test Todo Widget - 1.Get Darwin data 2.Verify it is displayed correctly 3.Click See All|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/009000b6-00b6-000d-007e-005700b1007e.png",
        "timestamp": 1589299273752,
        "duration": 7421
    },
    {
        "description": "Test Comm Widget - 1.Get Darwin data 2.Verify it is displayed correctly 3.Click See All|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/005c00d7-00b4-0060-006f-0089003900ea.png",
        "timestamp": 1589299281706,
        "duration": 7197
    },
    {
        "description": "Test Key Dates panel link leads to Key Dates page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00c300af-00d1-0093-00fa-0043004c0066.png",
        "timestamp": 1589299289500,
        "duration": 6804
    },
    {
        "description": "Test Help and Advice panel link leads to Help page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00ce001f-004f-0021-0044-008700a200a0.png",
        "timestamp": 1589299296860,
        "duration": 5870
    },
    {
        "description": "Test Items panel link leads to Item page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/007d0057-0067-00d7-00b9-00f3008d000b.png",
        "timestamp": 1589299303248,
        "duration": 5691
    },
    {
        "description": "Test Contact Center panel link leads to Contacts page|Dashboard Page Tests @dev @darwin",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00d70097-0099-00f9-0098-00c4005b000e.png",
        "timestamp": 1589299309454,
        "duration": 5760
    },
    {
        "description": "Test faqs list - 1.Get Admin data 2.Verify it is displayed correctly|Help page tests @darwin",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/00bd0047-00ef-00ea-00df-007d00690040.png",
        "timestamp": 1589299315734,
        "duration": 0
    },
    {
        "description": "Test whats involved list - 1.Get Admin data 2.Verify it is displayed correctly|Help page tests @darwin",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/00960094-0003-00c6-00a9-000900480008.png",
        "timestamp": 1589299315744,
        "duration": 0
    },
    {
        "description": "Test important tips list - 1.Get Admin data 2.Verify it is displayed correctly|Help page tests @darwin",
        "passed": false,
        "pending": true,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "images/0098000e-000a-0047-0078-0052004c0014.png",
        "timestamp": 1589299315755,
        "duration": 0
    },
    {
        "description": "Test Outstanding items list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Items page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00a50032-00a8-002f-00c8-007b00bb001b.png",
        "timestamp": 1589299315766,
        "duration": 3216
    },
    {
        "description": "Test Accepted items list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Items page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00e20077-00fd-00fe-001c-009400b500e5.png",
        "timestamp": 1589299319474,
        "duration": 2921
    },
    {
        "description": "Test Add new item and verify it is displayed correctly @dev|Items page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images/009700b8-00ed-0049-00b1-0008000c0043.png",
        "timestamp": 1589299322873,
        "duration": 10100
    },
    {
        "description": "Test Todo list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Todo page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://mysedgwick-backend-dev.azurewebsites.net/api/claims/f3a6b3fe-b5d7-4211-b238-7b62c8ca26f1/items - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1589299333565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://mysedgwick-dev.azurewebsites.net/main-es2015.bf0f84cba28cec4ea660.js 0:586643 \"ERROR\" E",
                "timestamp": 1589299333566,
                "type": ""
            }
        ],
        "screenShotFile": "images/003200bb-008c-00cf-0053-0050000300c5.png",
        "timestamp": 1589299333617,
        "duration": 2855
    },
    {
        "description": "Test Reviewed list - 1.Get Darwin data 2.Verify it is displayed correctly @dev @darwin|Todo page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/008600df-007c-00b8-00e0-008100b500d3.png",
        "timestamp": 1589299336924,
        "duration": 3550
    },
    {
        "description": "Test Todo list - Move todo item in done state @dev|Todo page tests",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/000200ee-00a9-009b-00a8-00d5003600a1.png",
        "timestamp": 1589299340972,
        "duration": 8407
    },
    {
        "description": "Test upload - 1.Upload file 2.Verify it is uploaded correctly|Upload tests @dev",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/0033005c-0029-0049-005f-00400057005a.png",
        "timestamp": 1589299349843,
        "duration": 5399
    },
    {
        "description": "Test upload - 1.Open upload dialog 2.Click Cancel|Upload tests @dev",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00ac0077-0049-00f7-009f-003000980064.png",
        "timestamp": 1589299355725,
        "duration": 2114
    },
    {
        "description": "Test upload - 1.Open upload dialog 2.Upload file 3. Click Remove file 4. Verify file is removed|Upload tests @dev",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "0a2bd32f7ceb55675a76f1b89d82108b",
        "instanceId": 10549,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "images/00e200fb-00aa-00b3-0093-006600360016.png",
        "timestamp": 1589299358325,
        "duration": 2850
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
