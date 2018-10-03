"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebirdLst;

function _load_bluebirdLst() {
    return _bluebirdLst = require("bluebird-lst");
}

var _builderUtil;

function _load_builderUtil() {
    return _builderUtil = require("builder-util");
}

var _BaseS3Publisher;

function _load_BaseS3Publisher() {
    return _BaseS3Publisher = require("./BaseS3Publisher");
}

class SpacesPublisher extends (_BaseS3Publisher || _load_BaseS3Publisher()).BaseS3Publisher {
    constructor(context, info) {
        super(context, info);
        this.info = info;
        this.providerName = "Spaces";
    }
    static checkAndResolveOptions(options, channelFromAppVersion) {
        return (0, (_bluebirdLst || _load_bluebirdLst()).coroutine)(function* () {
            if (options.name == null) {
                throw new Error(`Please specify "name" for "spaces" publish provider (see https://www.electron.build/configuration/publish#spacesoptions)`);
            }
            if (options.region == null) {
                throw new Error(`Please specify "region" for "spaces" publish provider (see https://www.electron.build/configuration/publish#spacesoptions)`);
            }
            if (options.channel == null && channelFromAppVersion != null) {
                options.channel = channelFromAppVersion;
            }
        })();
    }
    getBucketName() {
        return this.info.name;
    }
    createClientConfiguration() {
        const configuration = super.createClientConfiguration();
        configuration.endpoint = `${this.info.region}.digitaloceanspaces.com`;
        const accessKeyId = process.env.DO_KEY_ID;
        const secretAccessKey = process.env.DO_SECRET_KEY;
        if ((0, (_builderUtil || _load_builderUtil()).isEmptyOrSpaces)(accessKeyId)) {
            throw new Error("Please set env DO_KEY_ID (see https://www.electron.build/configuration/publish#spacesoptions)");
        }
        if ((0, (_builderUtil || _load_builderUtil()).isEmptyOrSpaces)(secretAccessKey)) {
            throw new Error("Please set env DO_SECRET_KEY (see https://www.electron.build/configuration/publish#spacesoptions)");
        }
        configuration.credentials = { accessKeyId, secretAccessKey };
        return configuration;
    }
    configureS3Options(s3Options) {
        super.configureS3Options(s3Options);
    }
}
exports.default = SpacesPublisher; //# sourceMappingURL=spacesPublisher.js.map