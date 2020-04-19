// Listeners //
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'setPageInfo')
    setPageInfo(request.info);
});

document.addEventListener('DOMContentLoaded', () => {
  updatePageInfo();

  document.getElementById("rescanPage").addEventListener('click', () => {
    rescanPage();
  });

  document.getElementById("openCustomizePage").addEventListener('click', () => {
    getOrCreateSlackTab((tab) => {
      chrome.tabs.update(tab.id, {active: true}, () => {});
    });
  });

  document.getElementById("getSlackToken").addEventListener('click', () => {
    getSlackToken();
  });

  document.getElementById("getSlackEmoji").addEventListener('click', () => {
    getSlackEmoji();
  });

  document.getElementsByName("insertMode").forEach((node) => {
    node.addEventListener('click', () => {
      handleInsertModeChange();
    });
  })
});

// Actions //
function handleInsertModeChange(insertMode) {
  document.getElementsByName("insertMode").forEach((node) => {
    if (node.checked) {
      return chrome.storage.local.set({"insertMode": node.id});
    }
  });
}

function setPageInfo(info) {
  console.log(`setting pageInfo '${JSON.stringify(info)}'`)
  if (info) {
    document.getElementById("emojiFound").innerHTML = info.emojiFound;
    document.getElementById("emojiCount").innerHTML = info.emojiCount;
    document.getElementById("slackDomain").innerHTML = info.slackDomain;

    if (info.emojiCount == 0)
      chrome.browserAction.setBadgeText({text: info.emojiCount.toString()});
    else
      chrome.browserAction.setBadgeText({text: ''});

    chrome.storage.local.get("insertMode", (result) => {
      document.getElementById(result.insertMode).checked = true;
    });
  }
}

function updatePageInfo() {
  messageCurrentTab(
    {message: 'getPageInfo'}
  );
}

function rescanPage() {
  messageCurrentTab(
    {message: 'rescanPage'}
  );
}

function requestAlert(alertText) {
  messageCurrentTab(
    {message: 'requestingAlert', text: alertText},
  );
}

function getSlackToken() {
  chrome.runtime.sendMessage({message: 'getSlackToken', callback: 'alert'});
}

function getSlackEmoji() {
  chrome.runtime.sendMessage({message: 'getSlackToken', callback: 'getSlackEmoji'});
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
    if (typeof callback === 'undefined') {
      chrome.tabs.sendMessage(
        tab.id,
        Object.assign({}, {from: 'popup'}, message)
      );
    } else {
      chrome.tabs.sendMessage(
        tab.id,
        Object.assign({}, {from: 'popup'}, message),
        callback
      );
    }
  });
}

function getOrCreateSlackTab(callback) {
  chrome.tabs.query({
    url: "*://*.slack.com/customize/*"
  }, (existingTabs) => {
    if (existingTabs.length > 0)
      callback(existingTabs[0]);
    else
      chrome.tabs.create({'url': 'https://my.slack.com/customize/emoji'}, (tab) => {
        callback(tab);
      });
  });
}
