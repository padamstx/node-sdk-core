/**
 * (C) Copyright IBM Corp. 2014, 2021.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { CookieJar } from 'tough-cookie';
import { OutgoingHttpHeaders } from 'http';
import { AuthenticatorInterface, checkCredentials, readExternalSources } from '../auth';
import { stripTrailingSlash } from './helper';
import logger from './logger';
import { RequestWrapper, RetryOptions } from './request-wrapper';

/**
 * Configuration values for a service.
 */
export interface UserOptions {
  /** The Authenticator object used to authenticate requests to the service */
  authenticator?: AuthenticatorInterface;
  /** The base url to use when contacting the service. The base url may differ between IBM Cloud regions. */
  serviceUrl?: string;
  /** Default headers that shall be included with every request to the service. */
  headers?: OutgoingHttpHeaders;
  /** The API version date to use with the service, in "YYYY-MM-DD" format. */
  version?: string;
  /** Set to `true` to allow unauthorized requests - not recommended for production use. */
  disableSslVerification?: boolean;
  /** Set your own cookie jar object */
  jar?: CookieJar | boolean;
  /** Deprecated. Use `serviceUrl` instead. */
  url?: string;
  /** Allow additional request config parameters */
  [propName: string]: any;
}

/**
 * Additional service configuration.
 */
export interface BaseServiceOptions extends UserOptions {
  /** Querystring to be sent with every request. If not a string will be stringified. */
  qs?: any;
  enableRetries?: boolean;
  maxRetries?: number;
  retryInterval?: number;
}

/**
 * Common functionality shared by generated service classes.
 *
 * The base service authenticates requests via its authenticator, and sends
 * them to the service endpoint.
 */
export class BaseService {
  static DEFAULT_SERVICE_URL: string;

  static DEFAULT_SERVICE_NAME: string;

  protected baseOptions: BaseServiceOptions;

  private authenticator: AuthenticatorInterface;

  private requestWrapperInstance: RequestWrapper;

  /**
   * Configuration values for a service.
   * @param {Authenticator} userOptions.authenticator Object used to authenticate requests to the service.
   * @param {string} [userOptions.serviceUrl] The base url to use when contacting the service.
   *   The base url may differ between IBM Cloud regions.
   * @param {object<string, string>} [userOptions.headers] Default headers that shall be
   *   included with every request to the service.
   * @param {string} [userOptions.version] The API version date to use with the service,
   *   in "YYYY-MM-DD" format.
   * @param {boolean} [userOptions.disableSslVerification] A flag that indicates
   *   whether verification of the token server's SSL certificate should be
   *   disabled or not.
   */
  constructor(userOptions: UserOptions) {
    if (!(this instanceof BaseService)) {
      const err = 'the "new" keyword is required to create service instances';
      logger.error(`Error creating an instance of BaseService: ${err}`);
      throw new Error(err);
    }

    const baseServiceOptions = {} as BaseServiceOptions;
    const options = { ...userOptions };

    // for compatibility
    if (options.url && !options.serviceUrl) {
      options.serviceUrl = options.url;
    }

    if (options.serviceUrl) {
      baseServiceOptions.serviceUrl = stripTrailingSlash(options.serviceUrl);
    }

    // check serviceUrl for common user errors
    const credentialProblems = checkCredentials(options, ['serviceUrl']);
    if (credentialProblems) {
      logger.error(credentialProblems.message);
      throw credentialProblems;
    }

    // if disableSslVerification is not explicity set to the boolean value `true`,
    // force it to be false
    if (options.disableSslVerification !== true) {
      options.disableSslVerification = false;
    }

    const serviceClass = this.constructor as typeof BaseService;
    this.baseOptions = {
      qs: {},
      serviceUrl: serviceClass.DEFAULT_SERVICE_URL,
      ...options,
      ...baseServiceOptions,
    };

    this.requestWrapperInstance = new RequestWrapper(this.baseOptions);

    // enforce that an authenticator is set
    if (!options.authenticator) {
      throw new Error('Authenticator must be set.');
    }

    this.authenticator = options.authenticator;
  }

  /**
   * Get the instance of the authenticator set on the service.
   *
   * @returns {Authenticator}
   */
  public getAuthenticator(): any {
    return this.authenticator;
  }

  /**
   * Set the service URL to send requests to.
   *
   * @param {string} url The base URL for the service.
   */
  public setServiceUrl(url: string): void {
    if (url) {
      this.baseOptions.serviceUrl = stripTrailingSlash(url);
    }
  }

  /**
   * Set the HTTP headers to be sent in every request.
   *
   * @param {OutgoingHttpHeaders} headers The map of headers to include in requests.
   */
  public setDefaultHeaders(headers: OutgoingHttpHeaders): void {
    if (typeof headers !== 'object') {
      // do nothing, for now
      return;
    }

    this.baseOptions.headers = headers;
  }

  /**
   * Turn request body compression on or off.
   *
   * @param {boolean} setting Will turn it on if 'true', off if 'false'.
   */
  public setEnableGzipCompression(setting: boolean): void {
    this.requestWrapperInstance.setCompressRequestData(setting);

    // persist setting so that baseOptions accurately reflects the state of the flag
    this.baseOptions.enableGzipCompression = setting;
  }

  /**
   * Get the Axios instance set on the service.
   * All requests will be made using this instance.
   */
  public getHttpClient() {
    return this.requestWrapperInstance.getHttpClient();
  }

  /**
   * Enable retries for unfulfilled requests.
   *
   * @param {RetryOptions} retryOptions configuration for retries
   */
  public enableRetries(retryOptions?: RetryOptions): void {
    this.requestWrapperInstance.enableRetries(retryOptions);
  }

  /**
   * Disables retries.
   */
  public disableRetries(): void {
    this.requestWrapperInstance.disableRetries();
  }

  /**
   * Configure the service using external configuration
   *
   * @param {string} serviceName The name of the service. Will be used to read from external
   * configuration.
   */
  protected configureService(serviceName: string): void {
    if (!serviceName) {
      const err = 'Error configuring service. Service name is required.';
      logger.error(err);
      throw new Error(err);
    }

    Object.assign(this.baseOptions, this.readOptionsFromExternalConfig(serviceName));
    // overwrite the requestWrapperInstance with the new base options if applicable
    this.requestWrapperInstance = new RequestWrapper(this.baseOptions);
  }

  /**
   * Wrapper around `sendRequest` that enforces the request will be authenticated.
   *
   * @param {object} parameters Service request options passed in by user.
   * @param {string} parameters.options.method The http method.
   * @param {string} parameters.options.url The path portion of the URL to be appended to the serviceUrl.
   * @param {object} [parameters.options.path] The path parameters to be inserted into the URL.
   * @param {object} [parameters.options.qs] The querystring to be included in the URL.
   * @param {object} [parameters.options.body] The data to be sent as the request body.
   * @param {object} [parameters.options.form] An object containing the key/value pairs for a www-form-urlencoded request.
   * @param {object} [parameters.options.formData] An object containing the contents for a multipart/form-data request
   * The following processing is performed on formData values:
   * - string: no special processing -- the value is sent as is
   * - object: the value is converted to a JSON string before insertion into the form body
   * - NodeJS.ReadableStream|Buffer|FileWithMetadata: sent as a file, with any associated metadata
   * - array: each element of the array is sent as a separate form part using any special processing as described above
   * @param {object} parameters.defaultOptions
   * @param {string} parameters.defaultOptions.serviceUrl The base URL of the service.
   * @param {OutgoingHttpHeaders} parameters.defaultOptions.headers Additional headers to be passed on the request.
   * @returns {Promise<any>}
   */
  protected createRequest(parameters): Promise<any> {
    // validate serviceUrl parameter has been set
    const serviceUrl = parameters.defaultOptions && parameters.defaultOptions.serviceUrl;
    if (!serviceUrl || typeof serviceUrl !== 'string') {
      return Promise.reject(new Error('The service URL is required'));
    }

    return this.authenticator.authenticate(parameters.defaultOptions).then(() =>
      // resolve() handles rejection as well, so resolving the result of sendRequest should allow for proper handling later
      this.requestWrapperInstance.sendRequest(parameters)
    );
  }

  // eslint-disable-next-line class-methods-use-this
  private readOptionsFromExternalConfig(serviceName: string): BaseServiceOptions {
    const results: BaseServiceOptions = {};
    const properties = readExternalSources(serviceName);

    if (properties !== null) {
      // the user can define the following client-level variables in the credentials file:
      // - url
      // - disableSsl
      // - enableGzip

      const { url, disableSsl, enableGzip, enableRetries, maxRetries, retryInterval } = properties;

      if (url) {
        results.serviceUrl = stripTrailingSlash(url);
      }
      if (disableSsl === true) {
        results.disableSslVerification = disableSsl;
      }
      if (enableGzip === true) {
        results.enableGzipCompression = enableGzip;
      }
      if (enableRetries !== undefined) {
        results.enableRetries = enableRetries;
      }
      if (maxRetries !== undefined) {
        results.maxRetries = maxRetries;
      }
      if (retryInterval !== undefined) {
        results.retryInterval = retryInterval;
      }
    }

    return results;
  }
}
