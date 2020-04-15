# Slack Emoji Anywhere - Chrome Plugin

What if your slack emoji came with you on any webpage you went to? What if you could type :buttbrowdotpng: in your github commit and see ![buttbrowdotpng](https://emoji.slack-edge.com/T7ZGGRLGN/buttbrowdotpng/d923b0305524f93e.gif), just as sassy as you intended? That's a world I want to live in. Now you can too!

## What it does

* Finds emoji that look like `:hi:` and replaces that text with the image of the `:hi:` emoji from your slack instance.
* Updates itself with the emoji from your slack instance whenever you tell it to.
* Allows you to search for and insert emoji using the chrome `omnibar`. Just type `cmd+l, :, tab` and you'll be able to search. When you find what you're looking for, press enter to copy it to your clipboard and enter it under your cursor.

## Todo

* prevent emoji from being applied to text boxes
* Add support for emoji composition, i.e. typing ":buttbr" and getting :buttbrow:
  * add slack emoji picker while typing
  * add ability to choose between plaintext `:emoji:`, `![mardown](emoji.png)` and `<img src="emoji.png" alt="html>`
