'use strict';


var fs = require("fs");
const Path = require("path");
var scraper = require("./scraper-utils");
const Url = require('url');
const moment = require("moment-timezone");
var Promise = require('promise');
const readFile = Promise.denodeify(fs.readFile);
const writeFile = Promise.denodeify(fs.writeFile);
var decode = require('html-entities').AllHtmlEntities.decode;

function main() {
    scrapeSite().then(
		(array) => {
			console.log(JSON.stringify(array, null, 2));
			System.exit(1);
		},
        (err) => {
            console.log("Error: "+err + "\n" + err.trace);
        }
	);
}

// --------------
// Scraping Code
// --------------
// Flattens a multi-promise list if there are 0 or 1 entries.
function promiseAll(promiseList) {
    switch( promiseList.length ) {
        case 0: return Promise.resolve(true);
        case 1: return promiseList[0];
        default: return Promise.all(promiseList);
    }
}

// Load the top level page and extract URL's from links
// Invoke a load of each of the linked pages
// The returned promise is resolved when ALL pages are loaded and processed
function scrapeSite() {
	const urlstr = "https://rpsc.energy.gov/handbooks?items_per_page=All";
	// const urlData = Url.parse(urlstr);

	// Do the main page
    const pageRequest = scraper.BaseRequest.create(urlstr);
	return scraper.requestPage( pageRequest ).then(
		(loadedPage) => {
			const $ = loadedPage.window.$;
			const links = $("a.handbook");
			console.log(`found ${links.length} links\n`);
			// Loop through urls and fetch each page
            const promiseList = [];
			$.each(
				links,
				(index, obj) => {
                    promiseList.push(
                        loadHandbookPage(index, obj.href, loadedPage.urlData)
                    );
				}
			);
			return Promise.all(promiseList);
			// return loadedPage.urlData;
		},
		showError
	)
}

// Loads the Handbook Page and extracts any links to content (PDF in this case)
// For each link to content, invokes a download and save of the content
// Returns a Promise which is resolved when all content has been saved.
function loadHandbookPage(index, urlstr, referer) {
    // Do the login page
    const pageRequest = scraper.BaseRequest.create(urlstr, referer);
    return scraper.requestPage( pageRequest ).then(
        (loadedPage) => {
            const $ = loadedPage.window.$;
            console.log("Handbook Page Loaded: "+loadedPage.urlData.path);
            const links = $("a.print-pdf");
            if(links.length >= 0) {
                const promiseList = [];
                $.each(
                    links,
                    (index, obj) => {
                        promiseList.push(
                            loadContent(index, obj.href, loadedPage.urlData)
                        );
                    }
                );
                return promiseAll(promiseList);
            } else {
                console.log(`No Link for :${urlstr}`);
                return "no pdf";
            }
        }
    )
}

// Downloads content from a URL
// Returns a Promise which is resolved when the content has been downloaded and saved
function loadContent(index, urlstr, referer) {
    const pageRequest = scraper.BaseRequest.create(urlstr, referer);
    pageRequest.headers["accept-encoding"] = "gzip";

    const url = Url.format(pageRequest.urlData);
    const filename = scraper.urlFilename(url);
    const pathname = `../data/${filename}.pdf`;
    const indexEntry = {
        url: url,
        referer: Url.format(referer),
        pathname: pathname
    };

    return scraper.executeHttpRequest(pageRequest).then(
        (httpResponse) => {
            console.log(`Saving PDF to ${pathname}`);
            return writeFile(pathname, httpResponse.content).then(
                (ok) => {
                    return indexEntry;
                },
                (err) => {
                    console.log(`Write Failure for ${filename}`);
                    indexEntry.err = err;
                    return indexEntry;
                }
            );
        },
        (err) => {
            console.log(`Load Failure for ${url}`);
            indexEntry.err = err;
            return indexEntry;
        }
    )
}

function showError(err) {
	console.log("Error: " + err.trace);
}


main();