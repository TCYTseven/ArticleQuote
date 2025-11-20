// background.js - Service Worker for ArticleQuote

// Create the context menu item upon installation.
// This menu item will only appear when text is selected.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "createArticleQuote",
    title: "ArticleQuote",
    contexts: ["selection"]
  });
});

// Listen for a click on the context menu item.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "createArticleQuote" && info.selectionText) {
    // Get the selected text, page URL, and page title.
    const selectionText = info.selectionText;
    const pageUrl = tab.url;
    const pageTitle = tab.title;

    // Construct the URL for our editor page, passing the captured data as URL parameters.
    // We must encode the components to handle special characters.
    const editorUrl = chrome.runtime.getURL('editor.html') +
      `?text=${encodeURIComponent(selectionText)}` +
      `&url=${encodeURIComponent(pageUrl)}` +
      `&title=${encodeURIComponent(pageTitle)}`;

    // Open the editor in a new tab.
    chrome.tabs.create({ url: editorUrl });
  }
});
