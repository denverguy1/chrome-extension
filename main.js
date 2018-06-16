/**
 * @param {function()} callback - Called when the request results have been
 *  formatted for rendering
 * @param {function(string)} errorCallback - Called when the request fails
 */
function getJIRAFeed(callback, errorCallback){
    var user = document.getElementById("user").value;
    if(user == undefined) return;
    
    var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+"+user+"&providers=issues";
    make_request(url, "").then(function(response) {
      // empty response type allows the request.responseXML property to be returned in the makeRequest call
      callback(url, response);
    }, errorCallback);
}

/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {function(string)} callback - Called when the query results have been  
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
async function getQueryResults(s, callback, errorCallback) {
    try {
      var response = await make_request(s, "json");
      callback(createHTMLElementResult(response));
    } catch (error) {
      errorCallback(error);
    }
}

/**
 * @param {string} url - The url to request data from
 * @param {property} responseType - The type of the response
 * @returns - A Promise to fulfill a request
 */
function make_request(url, responseType) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = function() {
      var response = responseType ? req.response : req.responseXML;
      if(response && response.errorMessages && response.errorMessages.length > 0){
        reject(response.errorMessages[0]);
        return;
      }
      resolve(response);
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    }
    req.onreadystatechange = function() { 
      if(req.readyState == 4 && req.status == 401) { 
          reject("You must be logged in to JIRA to see this project.");
      }
    }

    // Make the request
    req.send();
  });
}

/**
 * Saves the query options to chrome storage
 */
function loadOptions(){
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, function(items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
  });
}

/**
 * @param {function()} callback - Called when the query has been built
 */
function buildJQL(callback) {
  var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  var project = document.getElementById("project").value;
  var status = document.getElementById("statusSelect").value;
  var inStatusFor = document.getElementById("daysPast").value
  var fullCallbackUrl = callbackBase;
  fullCallbackUrl += `project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;
  callback(fullCallbackUrl);
}

/**
 * @param {string} response - The response from a query
 * @returns {string} - A collection of fields for each entry in the
 *  response
 */
function createHTMLElementResult(response){

  var responseSummary = document.createElement('p');

  for(var index=response['startAt']; index<response['total']; index++) {
    var hr_elem = document.createElement('hr');
    var pSummary = document.createElement('p');
    var summaryStr = "";
    var issue = response['issues'][index]['fields'];

    // collect a summary of each entry
    summaryStr =
      "<b>Id:</b> " + response['issues'][index]['key'] + "<br>" +
      "<b>Summary:</b> " + issue['summary'] + "<br>" +
      "<b>Status:</b> " + issue['status']['description'] + "<br>" +
      "<b>Assignee:</b> ";
    
    // need to check if a ticket has been assigned before accessing its fields
    if(issue['assignee']) {
      summaryStr += 
        issue['assignee']['name'] + " - " +
        issue['assignee']['displayName'];
    }
    summaryStr += "<br>";

    pSummary.innerHTML = summaryStr;

    // append each entry to the responseSummary
    responseSummary.appendChild(pSummary);
    responseSummary.appendChild(hr_elem);

  }

  return responseSummary.outerHTML;
  
}

/**
 * @param {string} str - string to convert
 */
function domify(str){
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

/**
 * @returns - A Promise which checks if a project exists
 */
function checkProjectExists(){
  return make_request("https://jira.secondlife.com/rest/api/2/project/SUN", "json");  
}

/**
 * @param {string} message - The message to populate the status field with
 */
function updateStatus(message) {
  document.getElementById('status').innerHTML = message;
  document.getElementById('status').hidden = false;
}

/**
 * Collect and display the results of a JIRA search
 */
function performJIRASearch() {
  // build query
  buildJQL(function(url) {
    
    updateStatus('Performing JIRA search for ' + url);
    
    // perform the search
    getQueryResults(url, function(return_val) {
      // render the results
      updateStatus('<b>Query term:</b> ' + url + '\n');
      
      var jsonResultDiv = document.getElementById('query-result');
      jsonResultDiv.innerHTML = return_val;
      jsonResultDiv.hidden = false;

    }, function(errorMessage) {
        updateStatus('ERROR ' + errorMessage);
    });
  });   
}

/**
 * Collect and display the results of a JIRA feed query
 */
function collectJIRAFeed() {
  // get the xml feed
  getJIRAFeed(function(url, xmlDoc) {
          
  updateStatus('Activity query: ' + url + '\n');

  // render result
  var feed = xmlDoc.getElementsByTagName('feed');
  var entries = feed[0].getElementsByTagName("entry");
  var list = document.createElement('ul');

  for (var index = 0; index < entries.length; index++) {
    var html = entries[index].getElementsByTagName("title")[0].innerHTML;
    var updated = entries[index].getElementsByTagName("updated")[0].innerHTML;
    var item = document.createElement('li');
    item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
    list.appendChild(item);
  }

  var feedResultDiv = document.getElementById('query-result');
  if(list.childNodes.length > 0){
    feedResultDiv.innerHTML = list.outerHTML;
  } else {
    updateStatus('There are no activity results.');
  }
  
  feedResultDiv.hidden = false;

  }, function(errorMessage) {
  updateStatus('ERROR. ' + errorMessage);
  });
}

// Setup
document.addEventListener('DOMContentLoaded', function() {
  // if logged in, setup listeners
    checkProjectExists().then(function() {

      //load saved options
      loadOptions();

      // query click handler
      document.getElementById("query").onclick = performJIRASearch;

      // activity feed click handler
      document.getElementById("feed").onclick = collectJIRAFeed;        

    }).catch(function(errorMessage) {
        updateStatus('ERROR. ' + errorMessage);
    });   
});
