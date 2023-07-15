'use strict';

const https = require('node:https');
const { setTimeout } = require('node:timers');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { UserAgent } = require('../util/Constants');

const fs = require('fs')
const reqLogger = fs.createWriteStream('httprequests_2.txt', {
  flags: 'a' // 'a' means appending (old data will be preserved)
});

let agent = null;

class APIRequest {
  constructor(rest, method, path, options) {
    this._stack = new Error().stack;
    this.rest = rest;
    this.client = rest.client;
    this.method = method;
    this.route = options.route;
    this.options = options;
    this.retries = 0;

    const { userAgentSuffix } = this.client.options;
    this.fullUserAgent = `${UserAgent}${userAgentSuffix.length ? `, ${userAgentSuffix.join(', ')}` : ''}`;

    let queryString = '';
    if (options.query) {
      const query = Object.entries(options.query)
        .filter(([, value]) => value !== null && typeof value !== 'undefined')
        .flatMap(([key, value]) => (Array.isArray(value) ? value.map(v => [key, v]) : [[key, value]]));
      queryString = new URLSearchParams(query).toString();
    }
    this.path = `${path}${queryString && `?${queryString}`}`;
  }

  make() {
    agent ??= new https.Agent({ ...this.client.options.http.agent, keepAlive: true });

    const API =
      this.options.versioned === false
        ? this.client.options.http.api
        : `${this.client.options.http.api}/v${this.client.options.http.version}`;
    const url = API + this.path;

    let headers = {
      ...this.client.options.http.headers,
      'User-Agent': this.fullUserAgent,
    };

    if (this.options.auth !== false) headers.Authorization = this.rest.getAuth();
    if (this.options.reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(this.options.reason);
    if (this.options.headers) headers = Object.assign(headers, this.options.headers);

    let body;
    if (this.options.files?.length) {
      body = new FormData();
      for (const [index, file] of this.options.files.entries()) {
        if (file?.file) body.append(file.key ?? `files[${index}]`, file.file, file.name);
      }
      if (typeof this.options.data !== 'undefined') {
        if (this.options.dontUsePayloadJSON) {
          for (const [key, value] of Object.entries(this.options.data)) body.append(key, value);
        } else {
          body.append('payload_json', JSON.stringify(this.options.data));
        }
      }
      headers = Object.assign(headers, body.getHeaders());
      // eslint-disable-next-line eqeqeq
    } else if (this.options.data != null) {
      body = JSON.stringify(this.options.data);
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.client.options.restRequestTimeout).unref();
    return new Promise(async (resolve, reject) => {
     let fResult = await fetch(url, {
       method: this.method,
       headers,
       agent,
       body,
       signal: controller.signal,
     }).catch((err) => reject(err)).finally(() => clearTimeout(timeout));
     if (!`${fResult?.status}`.startsWith("2")) {
      reqLogger.write(`\n${new Date().toLocaleString()} | ${this.method} (${fResult?.status}): ${url} | ${simplifyStack(this._stack)}`);
     }
     resolve(fResult);
    });
  }
}

module.exports = APIRequest;

function simplifyStack(stack) {
 let stackSplit = stack.split("\n");
 stackSplit.shift();
 stackSplit.shift();
 stackSplit.shift();
 return stackSplit.map(s => s.match(/\((.+)\)/)?.[1] || "/").join(" > ");
}
