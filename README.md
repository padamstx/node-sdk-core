![Build Status](https://github.com/padamstx/node-sdk-core/actions/workflows/build.yaml/badge.svg?branch=main)
[![npm-version](https://img.shields.io/npm/v/ibm-cloud-sdk-core.svg)](https://www.npmjs.com/package/ibm-cloud-sdk-core)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![CLA assistant](https://cla-assistant.io/readme/badge/ibm/node-sdk-core)](https://cla-assistant.io/ibm/node-sdk-core)

# IBM Node.js SDK Core
This project contains core functionality required by Node.js code generated by the IBM Cloud OpenAPI SDK Generator
(openapi-sdkgen).

## Installation
```bash
`npm install ibm-cloud-sdk-core`
```

## Prerequisites
- Node.js version 12 or newer

## Usage
This package exports a single object containing a number of modules as top level properties.

Example:
```js
// this is TypeScript, since the `openapi-sdkgen` project generates TypeScript
import { BaseService } from 'ibm-cloud-sdk-core';

class YourSDK extends BaseService { ... }
```

## Authentication
This library provides a set of Authenticators used to authenticate requests from an SDK. There are authenticators for the following authentication schemes:
- No Auth
- Basic
- Bearer Token
- IAM
- CP4D
- Container

There are two ways to create an authenticator:
1. Creating an instance and providing credentials programmatically
2. Using the `getAuthenticatorFromEnvironment` function to create an authenticator from externally-provided configuration

For more information about the various authentication types and how to use them with your services, click [here](Authentication.md).

### Examples

#### Programmatic
```js
import { IamAuthenticator } from 'ibm-cloud-sdk-core';

const authenticator = new IamAuthenticator({
  apikey: '{apikey}',
});
```

#### External configuration
```js
import { getAuthenticatorFromEnvironment } from 'ibm-cloud-sdk-core';

// env vars
// MY_SERVICE_AUTH_TYPE=iam
// MY_SERVICE_APIKEY=<apikey>
const iamAuthenticator = getAuthenticatorFromEnvironment('my-service');
```

## Logging
This package uses [debug](https://www.npmjs.com/package/debug) for logging.

- Logging is disabled by default.
- Logging has been configured to use log levels which are assumed to be numerically ascending from most important to least important.
- In order to see the log output, set the environment variable ``DEBUG`` including the desired log level.
  - ```DEBUG=ibm-cloud-sdk-core:error``` enables error logs
  - ```DEBUG=ibm-cloud-sdk-core:warning``` enables warning logs and below
  - ```DEBUG=ibm-cloud-sdk-core:info``` enables info logs and below
  - ```DEBUG=ibm-cloud-sdk-core:verbose``` enables verbose logs and below
  - ```DEBUG=ibm-cloud-sdk-core:debug``` enables debug logs and below

To see the output from all of the debugging levels you can use:

``DEBUG=ibm-cloud-sdk-core*``

The debug logger can be configured to be used for more than one library. In example, you can set a comma-separated string:

``DEBUG=ibm-cloud-sdk-core:debug,other-lib:debug``

## Cookie Jar Support
By default, cookies are not supported in the SDK requests.  If your SDK would benefit from this functionality, simply edit your code to instantiate a cookie jar (or instruct your users to do so) and pass it in the object containing configuration options to the `BaseService` class, as shown below. If the Boolean value `true` is given for the `jar` field, the SDK core will create a default instance of a [Tough Cookie](https://www.npmjs.com/package/tough-cookie).

```ts
import tough = require('tough-cookie');

class MyClass extends BaseService {
  constructor(options: MyOptions) {
    // pass the cookie jar object or simply pass the value `true`
    // and a tough-cookie instance will be created by default
    options.jar = new tough.CookieJar();
    super(options);
  }
}
```

## Issues
If you encounter an issue with this project, you are welcome to submit a [bug report](https://github.com/IBM/node-sdk-core/issues).
Before opening a new issue, please search for similar issues. It's possible that someone has already reported it.

## Tests
Run all test suites:
```bash
npm test
```

## Contributing
See [CONTRIBUTING](CONTRIBUTING.md).

## License
This library is licensed under Apache 2.0. Full license text is
available in [LICENSE](LICENSE.md).
