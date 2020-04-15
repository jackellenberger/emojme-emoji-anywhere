// background.js
var emojiList, slackDomain, slackToken;

// Listeners //
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'openTab')
    openTab(request.url);

  if (request.message === 'requestEmojiFileLoad')
    loadEmojiListFromDisk(sendResponse);

  if (request.message === 'requestingAlert')
    alert(request.text);

  if (request.message === 'getSlackToken') {
    getSlackToken((result) => {
      if (request.callback === 'alert')
        alert(result.slackToken);
      if (request.callback === 'getSlackEmoji')
        getSlackEmoji(result.slackDomain, result.slackToken, sendResponse);

      sendResponse(result);
    });
  }

  if (request.message === 'getSlackEmoji') {
    chrome.storage.local.get(['slackDomain', 'slackToken'], (result) => {
      getSlackEmoji(result.slackDomain, result.slackToken, sendResponse);
    });
  }
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  suggestMatchingEmoji(text, suggest);
});

chrome.omnibox.onInputEntered.addListener((text) => {
  // TODO check if emoji is emoji and not a url, if so swap it to url
  text = text.replace(/:/, '');
  insertEmoji(text);
});


// Actions
function openTab(url) {
  chrome.tabs.create({url});
}

function clearEmojiList() {
  chrome.storage.local.remove('emojiList', () => console.log('cleared emojilist'));
}

function loadEmojiListFromDisk(callback) {
  let url = chrome.runtime.getURL('emojilist.json');
  fetch(url).then((result) => result.json()).then((emojilist) => {
    emojiList = emojilist;
    emojiCount = Object.keys(emojilist).length;

    chrome.storage.local.set(
      {emojiList},
      () => {
        console.debug(`emojme list updated; found ${emojiCount}`);
        return callback({complete: true});
      }
    );
  });
}

function getSlackToken(callback) {
  chrome.tabs.create({'url': 'https://my.slack.com/customize/emoji'}, (tab) => {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, changedTab) => {
      if (tabId == tab.id && changeInfo.status === 'complete') {
        chrome.tabs.executeScript(tab.id, {
          code: 'document.getElementsByTagName("html")[0].innerHTML'
        }, (result) => {
          slackToken = result[0].match(/xoxs-\w*-\w*-\w*-\w*/)[0];
          console.debug(`slackToken: ${slackToken}`)
          // for some reason we need to re-query tabs to get the resolved url
          chrome.tabs.get(tab.id, (t) => {
            slackDomain = t.url.match(/https:\/\/(.*).slack.com\/customize\/emoji/)[1]
            console.debug(`slackDomain: ${slackDomain}`)
            chrome.storage.local.set(
              {slackToken, slackDomain},
              () => {
                return callback({slackToken, slackDomain});
              }
            );
          });
        })
      }
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
      {emojiList},
      () => {
        console.debug(`emojme list updated; found ${emojiCount}`);
        return callback({complete: true});
      }
    );
  });
}

function suggestMatchingEmoji(partialEmoji, suggest) {
  if (! emojiList) {
    chrome.storage.local.get('emojiList', (result) => {
      emojiList = result.emojiList;
      suggest(matchingEmoji(emojiList, partialEmoji));
    });
  } else {
    suggest(matchingEmoji(emojiList, partialEmoji));
  }
}

function insertEmoji(emojiUrl) {
  getCurrentTab((tab) => {
    var tArea = document.createElement('textarea');
    document.body.appendChild(tArea);
    tArea.value = emojiUrl;
    tArea.focus();
    tArea.select();
    document.execCommand('copy');

    chrome.tabs.executeScript(tab.id, {matchAboutBlank: true, code:
      "document.execCommand('paste');"
    }, function() {
      if (chrome.runtime.lastError) console.log(chrome.runtime.lastError);
      document.body.removeChild(tArea);
    });
  });
}

// Helpers //
function matchingEmoji(emojiList, text) {
  return Object.keys(emojiList)
    .reduce((results, emojiName) => {
      if ((index = emojiName.indexOf(text)) > -1)
        results.push({
          index: index,
          content: emojiList[emojiName],
          description: emojiName
        });
      return results;
    }, []).sort((a, b) => {
      return a.index - b.index
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
