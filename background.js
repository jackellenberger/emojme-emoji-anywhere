// background.js
var emojiList, slackDomain, slackToken;

setDefaultSuggestion();

// Listeners //
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'openTab')
    openTab(request.url);

  if (request.message === 'requestingAlert')
    alert(request.text);

  if (request.message === 'getSlackToken') {
    getSlackToken((result) => {
      if (request.callback === 'alert')
        alert(result.slackToken);
      else if (request.callback === 'getSlackEmoji')
        getSlackEmoji(result.slackDomain, result.slackToken, sendResponse);
      else
        sendResponse(result);
    });
  }

  if (request.message === 'getSlackEmoji') {
    getStoredOrGlobal(['slackDomain', 'slackToken'], (result) => {
      getSlackEmoji(result.slackDomain, result.slackToken, sendResponse);
    });
  }
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  suggestEmojiMatchResult(text, suggest);
});

chrome.omnibox.onInputEntered.addListener((text) => {
  suggestEmojiMatchResult(text, (suggestions) => {
    if (suggestions.length > 0)
      copyAndPasteEmoji(suggestions[0].content.replace(/:/g, '').toLowerCase());
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

function getSlackToken(callback) {
  getOrCreateSlackTab((tab) => {
    chrome.tabs.executeScript(tab.id, {
      code: 'document.getElementsByTagName("html")[0].innerHTML'
    }, (result) => {
      if (! result) {
        return getSlackToken(callback);
      }
      slackToken = result[0].match(/xoxs-\w*-\w*-\w*-\w*/)[0];
      console.debug(`slackToken: ${slackToken}`)
      copyToClipboard(slackToken);
      // for some reason we need to re-query tabs to get the resolved url
      chrome.tabs.get(tab.id, (t) => {
        slackDomain = t.url.match(/https:\/\/(.*).slack.com\/customize\/emoji/)[1]
        console.debug(`slackDomain: ${slackDomain}`)
        chrome.storage.local.set(
          {slackToken, slackDomain},
          () => callback({slackToken, slackDomain})
        );
      });
    });
  });
}

function getSlackEmoji(slackDomain, slackToken, callback) {
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

function suggestEmojiMatchResult(partialEmoji, suggest) {
  getStoredOrGlobal('emojiList', (result) => {
    emojiList = result.emojiList;
    matchingEmojiResults = getEmojiMatchResults(emojiList, partialEmoji)
    if (matchingEmojiResults && (exactMatch = matchingEmojiResults[0]) && exactMatch.content === partialEmoji) {
      // This puts an additional copy of exact matches in the array of suggestions.
      // This is necessary because exact matches in the omnibox do not print
      // description hint text, which confuses the user (me) into thinking that
      // there is no exact match.
      matchingEmojiResults.unshift({...exactMatch, content: `:${exactMatch.content}:`});
    }

    getCurrentTab((tab) => {
      if (firstMatchingEmoji = matchingEmojiResults[0]) {
        setBrowserIconToUrl(emojiList[firstMatchingEmoji.content]);
      }
      suggest(matchingEmojiResults);
    });
  });
}

function copyAndPasteEmoji(emojiName) {
  getCurrentTab((tab) => {
    withInsertableEmoji(emojiList, emojiName, (payload) => {
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
  getDataFromUrl(url, (dataUrl) => {
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

function getDataFromUrl(url, callback){
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
