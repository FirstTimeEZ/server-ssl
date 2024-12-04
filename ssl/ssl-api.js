/**
 * Copyright © 2024 FirstTimeEZ
 * https://github.com/FirstTimeEZ
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Defines an Api which has a route that will attempt to direct requests towards an Endpoint
 * An Api contains Endpoints which will match against requests
 * 
 * @see Endpoint
 */
export class Api {
    constructor(apiRoute) {
        this.apiRoute = apiRoute;
        this.endpoints = [];
    }

    /**
     * Add an Endpoint to this Api
    */
    addEndpoint(endpoint) {
        this.endpoints.push(endpoint);
    }

    /**
     * Determines whether a url is on the route of this Api
     * 
     * @returns true if the url is on the Api Route; false otherwise
    */
    checkRoute(url) {
        return url.startsWith(this.apiRoute);
    }

    /**
     * Determines whether the endpoint is the next part of the url and finds the Endpoint
     * 
     * @returns the Endpoint if found; undefined otherwise
    */
    findEndpoint(endpointPath) {
        const fp = endpointPath.replace(this.apiRoute, "");

        for (let index = 0; index < this.endpoints.length; index++) {
            if (fp.startsWith(this.endpoints[index].path)) {
                return this.endpoints[index];
            }
        }

        return undefined;
    }

    /**
     * Determines whether the endpoint is the next part of the url, finds the Endpoint and checks the Method
     * 
     * @returns the Endpoint if found; undefined otherwise
    */
    findEndpointCheckMethod(req) {
        const ep = this.findEndpoint(req.url);

        if (ep != undefined) {
            if (ep.checkMethod(req.method)) {
                return ep;
            }
        }

        return undefined;
    }

    /**
     * Determines whether a url is on the route of this Api, determines whether the endpoint is the next part of the url, finds the Endpoint and checks the Method
     * 
     * @returns true if executing the handler was attempted; false otherwise
    */
    checkFindExecute(req, res) {
        if (req.url.startsWith(this.apiRoute)) {
            const ep = this.findEndpointCheckMethod(req);
            if (ep != undefined) {
                ep.executeHandler(req, res);
                return true;
            }

        }
        return false;
    }
}

/**
 * Defines an Endpoint within an Api that executes a handler when a request matches its path
 */
export class Endpoint {
    constructor(path, method, handler) {
        this.path = path;
        this.method = method;
        this.handler = handler;
    }

    /**
     * Determines whether the Method is correct
     * 
     * @returns true if the Method is correct; false otherwise
    */
    checkMethod(method) {
        return method == this.method;
    }

    /**
     * Execute the Endpoint handler
     * 
    */
    executeHandler(req, res) {
        this.handler(req, res);
    }

    /**
     * Execute the Endpoint handler with extra arguments
     * 
    */
    executeHandlerArgs(req, res, ...args) {
        this.handler(req, res, ...args);
    }
}