'use strict';

var jsdom = require("jsdom");
var http = require("https");
const Url = require('url');
const cookieJar = jsdom.createCookieJar();
const Promise = require('promise');
var fs = require("fs");
var zlib = require("zlib");
var urldecode =  require('urldecode');


// There are four types used throughout this module
// 		Url - As documented in the 'url' package
// 		HttpRequest - An object that describes a request
//		HttpResponse - An object describing the Http Response (headers, data, status, etc)
//		DomResponse - The DOM for an page and a JQuery object to manipulate it.

//  This is the form of an HttpRequest object
//  {
//    method: [String] <http method>
//    protocol: [String] <http or https>
//    hostname: [String] <url component, includes port#>
//    path: [String] <absolute path on host>
//    headers: [Object] <object with name-value pairs>
//    body: data (if any) to be written in the request
//	}

//  This is the form of an HttpResponse object
//  {
//		headers: [Object] Response headers as name-value pair object,
//		content: [Array] Content data,
//		statusCode: [int] Http Status Code,
//		statusMessage: [String] Textual status message (e.g. OK, Not Found),
//		urlData: [Url] The URL object for the request
//	}

//  This is the form of an LoadedPage object
//  {
//		window: [Object] The root of the DOM.  A JQuery object is availalble as 'window.$'
//		urlData: [Url] A URL object that was used to load this page
//	}

function setPoolSize(size) {
    const prev = http.globalAgent.maxSockets;
    http.globalAgent.maxSockets = size;
    console.log(`Changed Http Pool Size from ${prev} to ${http.globalAgent.maxSockets}`);
}

// Trim function for tag content. Removes leading and trailing whitespace and newlines
const RE_TRIM_LEFT = /^[\s\n]*/;
const RE_TRIM_RIGHT = /[\s\n]*$/;
function myTrim(s) {
    // const rs = reTrim[Symbol.match](s);
    var begin = 0;
    var end = null;
    const left = RE_TRIM_LEFT[Symbol.match](s);
    if(left) {
        begin = left[0].length;
    }
    const right = RE_TRIM_RIGHT[Symbol.match](s);
    if(right) {
        end = right.index;
    }
    return s.slice(begin, end);
}


const BaseRequest = {
    method: "GET",
    headers: {
        accept: "*/*",
        "Cache-Control": "no-cache",
		// "Accept-Encoding":"gzip, deflate, sdch, br",
		"Accept-Encoding":"gzip",
        Connection: "keep-alive",
        "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36"
    },

    create: function(url, urlReferer)  {
        const pageRequest = Object.assign({}, this);
        if( !urlReferer ) {
            // One arg -- the target Url
            if(typeof url === 'string') {
                pageRequest.urlData = Url.parse(url);
            } else {
                pageRequest.urlData = url;
            }
        } else {
            pageRequest.urlData = relativeUrl(urlReferer, url);
            pageRequest.headers.Referer = Url.format(urlReferer);
        }
        return pageRequest;
    }
};

function newRequest(url, urlReferer) {
    return BaseRequest.create(url, urlReferer);
}

function urlFilename(url) {
    const path = (typeof url === 'string') ? url : url.path;
    const index = path.lastIndexOf('/');
    return urldecode(path.substr(index+1))
}

// Returns a fully resolved URL object
//  urlReferer [Url | String] - the 'referer' page
//  urlstr [Url | String] - A relative URL from that page
function relativeUrl(urlReferer, urlstr) {
    if(typeof urlReferer === 'Url') {
        urlReferer = Url.format(urlReferer);
    }
    if(typeof urlstr === 'Url') {
        urlstr = Url.format(urlstr);
    }
    return Url.parse( Url.resolve(urlReferer, urlstr) );
}

// Posts Form data from a form on a page
// Inputs:
//		page [LoadedPage]: The page containing the form
//		form [JQuery]: The form as a JQuery
//		formValues [Object]: The form field values to submit
function postFormHttp(page, form, formValues) {
    const $ = page.window.$;

    // Populate form fields from formValues object
    for( var name of Object.keys(formValues)) {
        form.find(`input[name=${name}]`).val(formValues[name]);
    }

    var data   = form.serialize();
    var url    = form.attr('action') || 'get';
    var type   = form.attr('enctype') || 'application/x-www-form-urlencoded';
    var method = form.attr('method') || "GET";

    const referer = Url.format(page.urlData);
    const urlData = relativeUrl(page.urlData, url); // Url.parse( Url.resolve(referer, url) );
    const origin = `${urlData.protocol}//${urlData.host}`;
    return executeHttpRequest({
        urlData: urlData,
        method: method,
        headers: {
            'Content-Type': type,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Cache-Control": "no-cache",
            // "Accept-Encoding":"gzip, deflate, sdch, br",
            Connection: "keep-alive",
            Origin: origin,
            Referer: referer,
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36"
        },
        body: data
    });
}

// Returns a Promise fulfilled with a LoadedPage (see above) from a PageRequest
//  Input:
//      page
//   pageRequest [PageRequest] - A PageReqest object describing the request(see above)
//  Output:
//   Promise<LoadedPage>
function requestPageFromForm(page, form, formValues) {
    return postFormHttp(page, form, formValues).then(
        (httpResponse) => {
            return domFromHttpResponse(httpResponse);
        }
    );
}


// Returns a Promise fulfilled with a LoadedPage (see above) from a PageRequest
//  Input:
//   pageRequest [PageRequest] - A PageReqest object describing the request(see above)
//  Output:
//   Promise<LoadedPage>
function requestPage(pageRequest) {
    return executeHttpRequest(pageRequest).then(
        (httpResponse) => {
            return domFromHttpResponse(httpResponse);
        }
    );
}

// Returns a Promise fulfilled with a LoadedPage (see above)
//  Input:
//   httpResponse [HttpResponse] - The result from an Http request
//  Output:
//    Promise<LoadedPage>
function domFromHttpResponse(httpResponse) {
    return domRequest(httpResponse.content).then(
        (window) => {
            return {
                window: window,
                urlData: httpResponse.urlData
            }
        }
    );
}

// Parses an HTML page and returns a DOM that includes a JQuery object
//  Input:
//   html content
//  Output:
//   Promise<window>
function domRequest(html) {
    var deferred = function (resolve, reject) {
         jsdom.env( {
            cookieJar: cookieJar,
            scripts: ["http://code.jquery.com/jquery.js"],
            html: html,
            done: (error, window) => {
                if(error) {
                    reject(error);
                }
                resolve(window);
            }
        });
    };
    return new Promise(deferred);
}

// Performs an HttpRequest
// Input: pageRequest object as follows:
//  {
//    method: <http method>
//    protocol: <http or https>
//    hostname: <url component, includes port#>
//    path: <absolute path on host>
//    headers: <object with name-value pairs>
//    body: data (if any) to be written in the request
//
//  Output: httpResponse object as follows:
//		{
//			headers: Response headers as name-value pair object,
//			content: Content data,
//			statusCode: Http Status Code,
//			statusMessage: Textual status message (e.g. OK, Not Found),
//			urlData: The URL object for the request
//		}
//  }
function executeHttpRequest(pageRequest) {
    var deferred = function (resolve, reject) {
        const options = {
            method: pageRequest.method || "GET",
            protocol: pageRequest.urlData.protocol,
            hostname: pageRequest.urlData.hostname,
            path: pageRequest.urlData.path,
            headers: pageRequest.headers
        };
        const body =  pageRequest.body;

		// Add Cookie Header
        var inputCookies = cookieJar.getCookiesSync(pageRequest.urlData);
        if(inputCookies.length > 0) {
            var cs = "";
            for(var cookie of inputCookies) {
                if(cs) {
                    cs += "; ";
                }
                cs += cookie.cookieString();
            }
            // console.log("Request Cookies: "+cs);
            options.headers['cookie'] = cs;
        }
        // Add the host header
        options.headers['Host'] = pageRequest.urlData.host;

        console.log(`[${options.method}] ${options.path} requested`);
        // if(body) {
        //     console.log("Body size is:" + body.length);
        // }
        // for(var hn of Object.keys(options.headers)) {
        //     console.log(`  request header| ${hn} : ${options.headers[hn]}`);
        // }
        var req = http.request(
            options,
            (res) => {
                const statusCode = res.statusCode;
                // console.log(`[${options.method}] ${options.path} -> [${statusCode} ${res.statusMessage}]`);
                // for(var hn of Object.keys(res.headers)) {
                //     console.log(`  response header| ${hn} : ${res.headers[hn]}`);
                // }


                // Handle the response
                var setCookiesVal = res.headers["set-cookie"];
                if(setCookiesVal) {
                    if(typeof setCookiesVal === 'string') {
                        setCookiesVal = [ setCookiesVal ];
                    }
                    for(var cookiestr of setCookiesVal) {
                        var cookie = cookieJar.setCookieSync(cookiestr, pageRequest.urlData);
                        // console.log("Setting Cookie:"+cookie);
                    }
                }

                let error;
                if (statusCode >= 400) {
                    error = new Error(`Request Failed.\n` +
                        `Status Code: ${statusCode}`);
                }
                if (error) {
                    console.log(`[${options.method}] ${options.path} -> [${statusCode} ${res.statusMessage}] ${error.message}`);
                    // console.log(error.message);
                    // consume response data to free up memory
                    res.resume();
                    reject(error);
                    return;
                }

				var contentEncoding = res.headers["content-encoding"] || "";
				if(contentEncoding == "gzip") {
					// Setup Handling of GZIP content .....
					var buffer = [];
					// pipe the response into the gunzip to decompress
					var gunzip = zlib.createGunzip();
					res.pipe(gunzip);

					gunzip.on('data', function(data) {
						// decompression chunk ready, add it to the buffer
						buffer.push(data.toString())

					}).on("end", function() {
						// response and decompression complete, join the buffer and return
						const rawData = buffer.join("");
						const httpResponse = {
							headers: res.headers,
							content: rawData,
							statusCode: res.statusCode,
							statusMessage: res.statusMessage,
							urlData: pageRequest.urlData
						}
						// console.log(`[${options.method}] ${options.path} -> [${statusCode} ${res.statusMessage}] ${rawData.length}`);
						resolve(httpResponse);

					}).on("error", function(e) {
						reject(e);
					})
				} else {
					// Handle unencoded content
					res.setEncoding('utf8');
					let rawData = '';
					res.on(
						'data',
						(chunk) => {
							rawData += chunk
						});
					res.on('end', () => {
						if(statusCode == 302 && ! pageRequest.noFollowRedirect) {
							const newPageRequest = Object.assign({}, pageRequest);
							newPageRequest.urlData = Url.parse(res.headers.location);
							newPageRequest.method = "GET";
							resolve(executeHttpRequest(newPageRequest));
						} else {
							const httpResponse = {
								headers: res.headers,
								content: rawData,
								statusCode: res.statusCode,
								statusMessage: res.statusMessage,
								urlData: pageRequest.urlData
							}
							console.log(`[${options.method}] ${options.path} -> [${statusCode} ${res.statusMessage}] ${rawData.length}`);
							resolve(httpResponse);
						}
					});
				}

            }
        ).on('error', (e) => {
            console.log(`[${options.method}] ${options.path} -> Error: ${e.message}`);
            reject(e);
         });

        // req.on(
        //     'socket',
        //     (s) => {
        //         var ix = s._pendingData.indexOf(" HTTP/");
        //         var path = s._pendingData.substring(0, ix);
        //         console.log(`Got Socket ${id}: ${path}`);
        //     }
        // );

        if(body) {
            req.write(body);
        }
        req.end();
    }
    return new Promise(deferred);
}

module.exports.executeHttpRequest = executeHttpRequest;
module.exports.requestPage = requestPage;
module.exports.newRequest = newRequest;
module.exports.requestPageFromForm = requestPageFromForm;
module.exports.relativeUrl = relativeUrl;
module.exports.urlFilename = urlFilename;
module.exports.myTrim = myTrim;
module.exports.setPoolSize = setPoolSize;

// Set Default Pool Size
setPoolSize(5);
