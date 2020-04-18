# Slack Emoji Anywhere - Chrome Extension

What if your slack emoji came with you on any webpage you went to? What if you could type :buttbrowdotpng: in your github commit and see ![buttbrowdotpng](https://emoji.slack-edge.com/T7ZGGRLGN/buttbrowdotpng/d923b0305524f93e.gif), just as sassy as you intended? That's a world I want to live in. Now you can too!

## What it does

The slack emoji anywhere extension finds slack-formatted emoji (e.g. `:hi:`) in any browser text and replaces that string with the image of the `:hi:` emoji from your slack instance.

To aid in this, the extension gives helpful shortcuts to grab a slack user token, update the extension's emoji cache, and open the emoji customization page for your signed-in slack instance.

The extension also allows you to search for and insert emoji using the chrome `omnibar`. Just type `cmd+l` to focus on the bar, then `:, tab` and you'll be able to search existing emoji. When you find what you're looking for, press enter to copy it to your clipboard and enter it under your cursor. You can paste them in either as the direct url, a markdown link to the url, a markdown image (works great on github PRs), or html image.

## Installation

At time of writing, the slack emoji anywhere extension is only available unpacked, not through the chrome web store. There are [all kinds](https://stackoverflow.com/a/24577660/5261045) of [guides](https://developer.chrome.com/extensions/getstarted#manifest) to get that done, but the short version is to download or clone this repository, open `chrome://extensions`, turn on `Developer Mode`, and click `Load Unpacked` in the upper right. Have fun! :goatbutt:
