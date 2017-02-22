# Node-JS Scraper 

This is [arnyepstein](https://github.com/arnyepstein)'s scraping script for the
2017 DataRescueMIT event.

There's a base package (scrape-utils) with Promise-based methods for Http and HTML manipulation. 
 Just uncomment the section that
you need and start coding!


## Setup:

in the 'tools' directory:
```
 npm update
 node scrape
```
This will scrape all files and place them into the data directory

## Package: scraper-utils
This package exports a number of functions that help with scraping.  There are four object
types used by this API.
* Url - As documented in the 'url' package
* HttpRequest - An object that describes a request
```
{
    method: [String] <http method>
    protocol: [String] <http or https>
    hostname: [String] <url component, includes port#>
    path: [String] <absolute path on host>
    headers: [Object] <object with name-value pairs>
    body: data (if any) to be written in the request
}
```

* HttpResponse - An object describing the Http Response (headers, data, status, etc)
```
{
    headers: [Object] Response headers as name-value pair object,
    content: [Array] Content data,
    statusCode: [int] Http Status Code,
    statusMessage: [String] Textual status message (e.g. OK, Not Found),
    urlData: [Url] The URL object for the request
}
```
* DomResponse - The DOM for an page and a JQuery object to manipulate it.
```
{
    window: [Object] The root of the DOM.  A JQuery object is availalble as 'window.$'
    urlData: [Url] A URL object that was used to load this page
}
```

#### Exported Methods


###### executeHttpRequest - Perform an Http Request
```
executeHttpRequest(httpRequest)
Input:
    httpRequest - An HttpRequest object describing thedesired content (see newRequest())
Output:
    An Promise that resolves to an HttpResponse objevct
```

###### myTrim - Remove whitespace AND new-lines from both ends of a string.  (Enhanced over String.trim to remove NL as well)
```
myTrim(htmlContent)
Input:
    htmlContent - A String containing HTNL content
Output:
    The trimmed string
```
###### newRequest - Create a new HttpRequest object for a target URL with optional referer URL
```
newRequest(targetUrl, refererUrl)
Input:
    targetUrl - A String or URL describing the target content for the request 
    
    refererUrl - (optional) A String or URL specifying the URL making the request.  The refererUrl is
        required if the targetUrl is a relative URL.  If present, the returned request will include
        a 'referer' header
Output:
    An HttpRequest that can be further modified before executing a request.
```

###### requestPage - Perform an Http request for HTML and return a JQuery-enabled window.
```
requestPage(httpRequest)
Input:
    httpRequest - An HttpRequest object describing thedesired content (see newRequest())
Output:
    An Promise that resolves to an DomResponse objevct
```

###### requestPageFromForm - Submit a form from the provided page using provided values
```
requestPageFromForm(dom, form, formValues )
Input:
    dom - A DomResponse object for the page containing the form
    form - A JQuery object (from the DOM) selecting the form to submit.  
    formValues - Name-value pairs that will popyulate form input fields before submission
Output:
    An Promise that resolves to an DomResponse objevct
```

###### setPoolSize - Specify the number of parallel requests to allow during processing
It may be necessary to limit the number of parallel requests in order to be a good citizen and avoid
any throttling that the target site may apply.  A typical indication that this limit is too high would be a 
'temporary unavailable' response from the site.

```
setPoolSize(count)
Input:
    count - the number of parallel requests to allow during processing
Output:
    <void>
```

###### urlFilename - Utility function that extracts and decodes the last component of the specified URL
```
urlFilename(url)
Input:
    url - A Url or a String value for a Url
Output:
    A String containing the rightmost, UrlDecoded componenent of the URL's path
```