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
