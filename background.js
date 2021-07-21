// background.js
const slackCookieName = 'd'; // Slack why??
var emojiList, slackDomain, slackToken;

setDefaultSuggestion();

// Listeners //
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'openTab')
    openTab(request.url);

  if (request.message === 'requestingAlert')
    alert(request.text);

  if (request.message === 'getSlackAuth') {
    getSlackAuth((slackAuth) => {
      if (request.callback === 'alert')
        prompt(`An authJSON for use with emojme has been placed on your clipboard.\nFor your convenience, it is printed below.`,
        JSON.stringify(slackAuth));
      else if (request.callback === 'getSlackEmoji')
        getSlackEmoji(slackAuth.domain, slackAuth.token, sendResponse);
      else
        sendResponse(slackAuth);
    });
  }

  if (request.message === 'getSlackEmoji') {
    getStoredOrGlobal(['slackDomain', 'slackToken'], (result) => {
      getSlackEmoji(result.slackDomain, result.slackToken, sendResponse);
    });
  }
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  suggestMatchingEmoji(text, suggest);
});

chrome.omnibox.onInputEntered.addListener((text) => {
  suggestMatchingEmoji(text, (suggestions) => {
    if (suggestions.length > 0)
      insertEmoji(suggestions[0].content.replace(/:/g, ''));
  });
});


// Actions
function openTab(url) {
  chrome.tabs.create({url});
}

function clearEmojiList() {
  chrome.storage.local.remove('emojiList', () => console.log('cleared emojilist'));
}

function setDefaultSuggestion() {
  chrome.omnibox.setDefaultSuggestion({
    description: '<url>Search your emoji</url> <dim>Press [enter] to copy emoji to clipboard and paste under cursor <match>see extension icon for preview</match></dim>'
  });
}

function getSlackAuth(callback) {
  getOrCreateSlackTab((tab) => {
    chrome.tabs.executeScript(tab.id, {
      code: 'document.getElementsByTagName("html")[0].innerHTML'
    }, (pageContents) => {
      var slackAuth = {};

      if (! pageContents) {
        return getSlackAuth(callback);
      }

      slackToken = (pageContents[0].match(/xoxs-\w*-\w*-\w*-\w*/) ||
        pageContents[0].match(/xoxc-\w*-\w*-\w*-\w*/))[0];

      if (! slackToken) {
        console.debug('unable to access slackToken!');
        return callback(slackAuth);
      } else {
        console.debug(`slackToken: ${slackToken}`)
        slackAuth.token = slackToken;
      }

      // for some reason we need to re-query tabs to get the resolved url
      chrome.tabs.get(tab.id, (t) => {
        slackDomain = t.url.match(/https:\/\/(.*).slack.com\/customize\/emoji/)[1]

        if (! slackDomain) {
          console.debug('unable to access slackDomain!');
          return callback(slackAuth);
        } else {
          console.debug(`slackDomain: ${slackDomain}`)
          slackAuth.domain = slackDomain;
        }


        getSlackCookie(slackDomain, (slackCookie) => {
          if (! slackCookie) {
            console.debug(`Unable to access slack "${slackCookieName}" cookie.`);
            return callback(slackAuth);
          } else {
            slackAuth.cookie = slackCookie;
          }

          copyToClipboard(JSON.stringify(slackAuth));
          console.debug(`slackAuth: ${slackAuth}`)

          chrome.storage.local.set(
            {slackAuth, slackToken, slackCookie, slackDomain},
            () => callback(slackAuth)
          );
        });
      });
    });
  });
}

function getSlackCookie(slackDomain, callback) {
  chrome.cookies.get({
    url: `https://${slackDomain}.slack.com`,
    name: slackCookieName,
  }, (slackCookie) => {
    callback(slackCookie.value);
  });
}

function getSlackEmoji(slackDomain, slackToken, callback) {
  // This works without adding an explicitly supplied cookie
  // because we're already on the page, with the real cookie.
  fetch("https://" + slackDomain + ".slack.com/api/emoji.list", {
		"headers": {
			"accept": "*/*",
			"accept-language": "en-US,en;q=0.9",
			"content-type": "multipart/form-data; boundary=----WebKitFormBoundary",
			"sec-fetch-dest": "empty",
			"sec-fetch-mode": "cors",
			"sec-fetch-site": "same-origin"
		},
		"referrerPolicy": "no-referrer",
		"body": "------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"page\"\r\n\r\n1\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"count\"\r\n\r\n100\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"token\"\r\n\r\n"+slackToken+"\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"_x_reason\"\r\n\r\ncustomize-emoji-new-query\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"_x_mode\"\r\n\r\nonline\r\n------WebKitFormBoundary--\r\n",
		"method": "POST",
		"mode": "cors",
		"credentials": "include"
  }).then((response) => response.json()).then((body) => {
    compactedEmojiList = body.emoji;
    emojiList = Object.fromEntries(
      Object.entries(compactedEmojiList).map(([emojiName, emojiValue]) => {
        if (aliasForMatch = emojiValue.match(/alias:(.*)/)) {
          // TODO: this filters out aliases for default emoji. Re-add support.
          if (emojiUrl = compactedEmojiList[aliasForMatch[1]])
            return [emojiName, emojiUrl];
        } else {
          return [emojiName, emojiValue];
        }
      }).filter(Boolean)
    );
    emojiCount = Object.keys(emojiList).length;

    chrome.storage.local.set(
      {emojiList, emojiCount},
      () => {
        console.debug(`emojme list updated; found ${emojiCount}`);
        messageCurrentTab({message: 'rescanPage'}, () => {
          return callback({complete: true});
        });
      }
    );
  });
}

function suggestMatchingEmoji(partialEmoji, suggest) {
  getStoredOrGlobal('emojiList', (result) => {
    emojiList = result.emojiList;
    matchingEmoji = getMatchingEmoji(emojiList, partialEmoji)
    if (matchingEmoji && (exactMatch = matchingEmoji[0]) && exactMatch.content === partialEmoji) {
      // This puts an additional copy of exact matches in the array of suggestions.
      // This is necessary because exact matches in the omnibox do not print
      // description hint text, which confuses the user (me) into thinking that
      // there is no exact match.
      matchingEmoji.unshift({...exactMatch, content: `:${exactMatch.content}:`});
    }

    getCurrentTab((tab) => {
      if (firstMatchingEmoji = matchingEmoji[0]) {
        setBrowserIconToUrl(emojiList[firstMatchingEmoji.content]);
      }
      suggest(matchingEmoji);
    });
  });
}

function insertEmoji(emojiName) {
  getCurrentTab((tab) => {
    var emojiUrl = emojiList[emojiName]
    chrome.storage.local.get('insertMode', (result) => {
      switch (result.insertMode) {
        case "insertMdImage":
          payload = `![${emojiName}](${emojiUrl})`
          break;
        case "insertMdLink":
          payload = `[${emojiName}](${emojiUrl})`
          break;
        case "insertHtmlImageSmall":
          payload = `<img src="${emojiUrl}" alt="${emojiName}" title="${emojiName}" aria-label=":${emojiName}:" height="21" align="top">`
          break;
        case "insertHtmlImageFull":
          payload = `<img src="${emojiUrl}" alt="${emojiName}" title="${emojiName}" aria-label=":${emojiName}:">`
          break;
        default: //insertUrl || undefined
          payload = `${emojiUrl}`
          break;
      }

      copyToClipboard(payload);

      chrome.tabs.executeScript(tab.id, {matchAboutBlank: true, code:
        "document.execCommand('paste');"
      }, function() {
        if (chrome.runtime.lastError) console.log(chrome.runtime.lastError);
      });
    });
  });
}

function copyToClipboard(str) {
  var textArea = document.createElement('textarea');
  document.body.appendChild(textArea);
  textArea.value = str;
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

// From https://stackoverflow.com/a/42916772
function setBrowserIconToUrl(url) {
  urlToData(url, (dataUrl) => {
    img = new Image();
    img.onload = (() => {
      canvas = document.createElement('canvas');
      canvas.getContext('2d').drawImage(img, 0,0);
      imageData = canvas.getContext('2d').getImageData(0, 0, img.width, img.height);

      getCurrentTab((tab) => {
        iconData = { imageData }
        if (tab)
          iconData.tabId = tab.id

        chrome.browserAction.setIcon(iconData);
      });
    });
    img.src = dataUrl;
  });
}

// Helpers //
function getMatchingEmoji(emojiList, text) {
  return Object.keys(emojiList)
    .reduce((results, emojiName) => {
      if ((index = emojiName.indexOf(text)) > -1) {
        emojiUrl = emojiList[emojiName]
        content = emojiName
        description = `<match>${emojiName}</match> - <dim>${emojiUrl}</dim>`
        results.push({
          index: index,
          content: content,
          description: description
        });
      }
      return results;
    }, []).sort((a, b) => {
      return a.index - b.index;
    }).map((result) => {
      // This sucks there must be a way to do this more efficiently
      delete result.index;
      return result;
    });
}

function getCurrentTab(callback) {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, (tabs) => {
    return callback(tabs[0]);
  });
}

function messageCurrentTab(message, callback) {
  getCurrentTab((tab) => {
    chrome.tabs.sendMessage(
      tab.id,
      Object.assign({}, {from: 'background'}, message),
      callback
    )
  });
}

function urlToData(url, callback){
  var xhr = new XMLHttpRequest();
  xhr.open('get', url);
  xhr.responseType = 'blob';
  xhr.onload = function(){
    var fr = new FileReader();

    fr.onload = function(){
      callback(this.result);
    };

    fr.readAsDataURL(xhr.response); // async call
  };

  xhr.send();
}

function getStoredOrGlobal(variables, callback) {
  var globalResults = {};

  getFromStorage = [variables].flat().reduce((acc, v) => {
    if (val = this[v])
      globalResults[v] = val;
    else
      acc.push(v)
    return acc;
  }, [])

  if (getFromStorage.length > 0) {
    chrome.storage.local.get(getFromStorage, (storedResults) => {
      callback(Object.assign({}, globalResults, storedResults));
    });
  } else {
    callback(globalResults);
  }
}

function getOrCreateSlackTab(callback) {
  chrome.tabs.query({
    url: "*://*.slack.com/customize/*"
  }, (existingTabs) => {
    if (existingTabs.length > 0)
      callback(existingTabs[0]);
    else
      chrome.tabs.create({'url': 'https://my.slack.com/customize/emoji'}, (tab) => {
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, changedTab) => {
          if (tabId == tab.id && changeInfo.status === 'complete')
            callback(tab);
        });
      });
  });
}
